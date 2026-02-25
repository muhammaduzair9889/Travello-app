"""
Payment views for handling Stripe payment processing
"""
import stripe
import logging
import json
import os
from decimal import Decimal
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.db import transaction
from dotenv import load_dotenv

from .models import Booking, Payment
from .payment_serializers import (
    PaymentSerializer, CreatePaymentSessionSerializer,
    BookingPaymentStatusSerializer
)
from .permissions import CanAccessPayments
from travello_backend.utils import get_safe_error_response, validate_api_key

logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Configure Stripe - Using settings with validation
STRIPE_SECRET_KEY = settings.STRIPE_SECRET_KEY or os.getenv('STRIPE_SECRET_KEY', '')
STRIPE_PUBLISHABLE_KEY = settings.STRIPE_PUBLISHABLE_KEY or os.getenv('STRIPE_PUBLISHABLE_KEY', '')
STRIPE_WEBHOOK_SECRET = settings.STRIPE_WEBHOOK_SECRET or os.getenv('STRIPE_WEBHOOK_SECRET', '')

# Validate Stripe keys are configured
if not all([STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET]):
    logger.warning('Stripe keys not properly configured in settings or environment')

if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY

# Currency settings
STRIPE_CURRENCY_PRIMARY = getattr(settings, 'STRIPE_CURRENCY_PRIMARY', 'PKR').lower()
STRIPE_CURRENCY_FALLBACK = getattr(settings, 'STRIPE_CURRENCY_FALLBACK', 'USD').lower()

# Frontend URLs - Must be set in production
FRONTEND_SUCCESS_URL = getattr(settings, 'FRONTEND_PAYMENT_SUCCESS_URL', 'http://localhost:3000/payment-success')
FRONTEND_CANCEL_URL = getattr(settings, 'FRONTEND_PAYMENT_CANCEL_URL', 'http://localhost:3000/payment-cancel')

# Validate frontend URLs are set
if not settings.DEBUG and not (FRONTEND_SUCCESS_URL and FRONTEND_CANCEL_URL):
    logger.warning('Frontend payment URLs not configured for production')

logger.info(f"Stripe payment URLs configured - Success: {FRONTEND_SUCCESS_URL}, Cancel: {FRONTEND_CANCEL_URL}")


class CreatePaymentSessionView(APIView):
    """
    POST /api/payments/create-session/
    
    Create Stripe Checkout Session for a booking
    - Validates booking exists and can be paid
    - Creates Payment record (status: PENDING)
    - Creates Stripe Checkout Session
    - Returns session URL for frontend redirect
    """
    permission_classes = [IsAuthenticated, CanAccessPayments]
    
    def post(self, request):
        """Create Stripe payment session"""
        # Validate Stripe keys are configured
        if not STRIPE_SECRET_KEY or not STRIPE_WEBHOOK_SECRET:
            logger.error(f'Stripe configuration missing. Secret: {bool(STRIPE_SECRET_KEY)}, Webhook: {bool(STRIPE_WEBHOOK_SECRET)}')
            return Response(
                {
                    'success': False,
                    'error': 'Payment service is not properly configured. Please contact administrator.',
                    'details': {
                        'stripe_configured': bool(STRIPE_SECRET_KEY),
                        'webhook_configured': bool(STRIPE_WEBHOOK_SECRET)
                    }
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        
        serializer = CreatePaymentSessionSerializer(data=request.data)
        
        if not serializer.is_valid():
            logger.warning(f"Invalid session creation request: {serializer.errors}")
            return get_safe_error_response(
                'Invalid request parameters',
                status.HTTP_400_BAD_REQUEST
            )
        
        booking = serializer.validated_data['booking']
        
        # Verify user is the booking owner or is staff
        if booking.user != request.user and not request.user.is_staff:
            logger.warning(f"Unauthorized payment attempt for booking {booking.id}")
            return Response(
                {'success': False, 'error': 'You do not own this booking'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            with transaction.atomic():
                # Get or create payment record
                payment, created = Payment.objects.get_or_create(
                    booking=booking,
                    defaults={
                        'amount': booking.total_price,
                        'currency': STRIPE_CURRENCY_PRIMARY,
                        'status': 'PENDING',
                    }
                )
                
                # Prevent creating multiple sessions for same booking
                if not created and payment.status in ['PROCESSING', 'SUCCEEDED']:
                    logger.warning(f"Attempt to create session for already paid booking {booking.id}")
                    return Response(
                        {'success': False, 'error': 'Payment already initiated or completed'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                currency = STRIPE_CURRENCY_PRIMARY
                amount_cents = int(float(booking.total_price) * 100)
                
                # Build Checkout Session parameters — Stripe creates
                # its own PaymentIntent automatically in mode='payment'.
                session_kwargs = dict(
                    mode='payment',
                    payment_method_types=['card'],
                    line_items=[{
                        'price_data': {
                            'currency': currency,
                            'product_data': {
                                'name': f'Booking at {booking.hotel.name}',
                                'description': (
                                    f'{booking.room_type.get_type_display()} room - '
                                    f'{booking.number_of_nights} nights'
                                ),
                            },
                            'unit_amount': amount_cents,
                        },
                        'quantity': 1,
                    }],
                    payment_intent_data={
                        'metadata': {
                            'booking_id': str(booking.id),
                            'user_id': str(booking.user.id),
                            'hotel_id': str(booking.hotel.id),
                        },
                    },
                    metadata={
                        'booking_id': str(booking.id),
                        'payment_id': str(payment.id),
                    },
                    success_url=f'{FRONTEND_SUCCESS_URL}?session_id={{CHECKOUT_SESSION_ID}}&booking_id={booking.id}',
                    cancel_url=f'{FRONTEND_CANCEL_URL}?booking_id={booking.id}',
                )
                
                try:
                    session = stripe.checkout.Session.create(**session_kwargs)
                except stripe.error.InvalidRequestError as e:
                    # Fallback to USD if primary currency not supported
                    logger.warning(
                        f"Stripe currency {currency} not supported, "
                        f"falling back to {STRIPE_CURRENCY_FALLBACK}: {str(e)}"
                    )
                    currency = STRIPE_CURRENCY_FALLBACK
                    payment.currency = currency
                    session_kwargs['line_items'][0]['price_data']['currency'] = currency
                    session = stripe.checkout.Session.create(**session_kwargs)
                
                # Update payment record with session info
                payment.stripe_payment_intent = session.payment_intent or ''
                payment.stripe_session_id = session.id
                payment.status = 'PROCESSING'
                payment.save()
                
                logger.info(
                    f"Payment session created - Booking: {booking.id}, "
                    f"Session: {session.id}, URL: {session.url}, "
                    f"Amount: {booking.total_price} {currency}"
                )
                
                return Response({
                    'success': True,
                    'message': 'Payment session created',
                    'session_id': session.id,
                    'session_url': session.url,
                    'payment_id': payment.id,
                    'publishable_key': STRIPE_PUBLISHABLE_KEY,
                }, status=status.HTTP_201_CREATED)
        
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error creating session: {str(e)}")
            error_message = str(e)
            
            # Provide specific error guidance based on error type
            if 'No such plan' in error_message or 'Invalid' in error_message:
                user_message = f'Payment configuration error: {error_message}. Please contact support.'
            elif 'rate limit' in error_message.lower():
                user_message = 'Too many payment requests. Please wait a moment and try again.'
            elif 'api_key' in error_message.lower() or 'authentication' in error_message.lower():
                user_message = 'Payment service authentication failed. Please try again later.'
            else:
                user_message = f'Payment error: {error_message}'
            
            return Response(
                {
                    'success': False,
                    'error': user_message
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"Unexpected error creating payment session: {str(e)}", exc_info=True)
            return Response(
                {
                    'success': False,
                    'error': f'Unexpected payment error: {str(e)}'
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class StripeWebhookView(APIView):
    """
    POST /api/payments/webhook/
    
    Handle Stripe webhook events
    - Verifies Stripe signature with webhook secret
    - Updates booking status on successful payment
    - Creates/updates Payment record
    
    Security:
    - Requires valid Stripe signature verification
    - Does not reveal internal error details
    """
    permission_classes = [AllowAny]
    
    @csrf_exempt
    def post(self, request):
        """Handle Stripe webhook"""
        # Validate webhook secret is configured
        if not STRIPE_WEBHOOK_SECRET:
            logger.error('Stripe webhook secret not configured')
            return Response(
                {'error': 'Webhook not configured'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        
        payload = request.body
        sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
        
        # Verify signature is provided
        if not sig_header:
            logger.warning('Webhook request missing Stripe signature')
            return Response(
                {'error': 'Invalid request'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            # Verify webhook signature - this is critical for security
            event = stripe.Webhook.construct_event(
                payload, sig_header, STRIPE_WEBHOOK_SECRET
            )
        except ValueError as e:
            logger.warning(f"Invalid webhook payload: {str(e)}")
            return get_safe_error_response(
                'Invalid webhook data',
                status.HTTP_400_BAD_REQUEST
            )
        except stripe.error.SignatureVerificationError as e:
            logger.warning(f"Invalid webhook signature from IP: {request.META.get('REMOTE_ADDR')}")
            return get_safe_error_response(
                'Invalid webhook signature',
                status.HTTP_403_FORBIDDEN
            )
        
        try:
            # Handle checkout.session.completed event
            if event['type'] == 'checkout.session.completed':
                session = event['data']['object']
                handle_checkout_session_completed(session)
            
            # Handle payment_intent.succeeded event
            elif event['type'] == 'payment_intent.succeeded':
                payment_intent = event['data']['object']
                handle_payment_intent_succeeded(payment_intent)
            
            # Handle payment_intent.payment_failed event
            elif event['type'] == 'payment_intent.payment_failed':
                payment_intent = event['data']['object']
                handle_payment_intent_failed(payment_intent)
            
            # Handle charge.refunded event
            elif event['type'] == 'charge.refunded':
                charge = event['data']['object']
                handle_charge_refunded(charge)
            
            logger.info(f"Webhook processed successfully: {event['type']}")
            return Response({'status': 'success'}, status=status.HTTP_200_OK)
        
        except Exception as e:
            logger.error(f"Error processing webhook: {str(e)}")
            return Response(
                {'error': 'Webhook processing error'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


def handle_checkout_session_completed(session):
    """Handle checkout.session.completed event"""
    booking_id = session['metadata'].get('booking_id')
    payment_id = session['metadata'].get('payment_id')
    
    if not booking_id:
        logger.warning("Webhook received without booking_id metadata")
        return
    
    try:
        booking = Booking.objects.get(id=booking_id)
        
        # Update booking status to PAID
        booking.status = 'PAID'
        booking.save()
        
        # Update payment record
        payment = Payment.objects.get(id=payment_id)
        payment.status = 'SUCCEEDED'
        payment.save()
        
        logger.info(
            f"Booking {booking_id} marked as PAID via webhook - "
            f"Session: {session['id']}"
        )
    
    except Booking.DoesNotExist:
        logger.error(f"Booking {booking_id} not found for webhook")
    except Payment.DoesNotExist:
        logger.error(f"Payment {payment_id} not found for webhook")
    except Exception as e:
        logger.error(f"Error handling checkout session: {str(e)}")


def handle_payment_intent_succeeded(payment_intent):
    """Handle payment_intent.succeeded event"""
    booking_id = payment_intent['metadata'].get('booking_id')
    
    if not booking_id:
        logger.warning("Payment intent webhook without booking_id")
        return
    
    try:
        booking = Booking.objects.get(id=booking_id)
        
        # Only update if not already paid (prevent double-payment)
        if booking.status != 'PAID':
            booking.status = 'PAID'
            booking.save()
            
            try:
                payment = booking.payment
                payment.status = 'SUCCEEDED'
                payment.stripe_payment_intent = payment_intent['id']
                payment.save()
            except Payment.DoesNotExist:
                logger.warning(f"Payment record not found for booking {booking_id}")
            
            logger.info(f"Booking {booking_id} marked as PAID (payment_intent.succeeded)")
    
    except Booking.DoesNotExist:
        logger.error(f"Booking {booking_id} not found in webhook")
    except Exception as e:
        logger.error(f"Error handling payment intent: {str(e)}")


def handle_payment_intent_failed(payment_intent):
    """Handle payment_intent.payment_failed event"""
    booking_id = payment_intent['metadata'].get('booking_id')
    
    if not booking_id:
        return
    
    try:
        payment = Payment.objects.get(booking_id=booking_id)
        payment.status = 'FAILED'
        payment.error_message = payment_intent.get('last_payment_error', {}).get('message', 'Payment failed')
        payment.save()
        
        logger.warning(f"Payment failed for booking {booking_id}: {payment.error_message}")
    except Payment.DoesNotExist:
        logger.warning(f"Payment record not found for failed booking {booking_id}")
    except Exception as e:
        logger.error(f"Error handling failed payment intent: {str(e)}")


def handle_charge_refunded(charge):
    """Handle charge.refunded event"""
    payment_intent_id = charge.get('payment_intent')
    
    if not payment_intent_id:
        return
    
    try:
        payment = Payment.objects.get(stripe_payment_intent=payment_intent_id)
        payment.status = 'REFUNDED'
        payment.save()
        
        # Update booking status back to PENDING
        booking = payment.booking
        if booking.status == 'PAID':
            booking.status = 'PENDING'
            booking.save()
        
        logger.info(f"Payment {payment.id} refunded for booking {booking.id}")
    except Payment.DoesNotExist:
        logger.warning(f"Payment not found for refund: {payment_intent_id}")
    except Exception as e:
        logger.error(f"Error handling refund: {str(e)}")


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_booking_payment_status(request, booking_id):
    """
    GET /api/payments/booking/{booking_id}/status/
    
    Get payment status for a booking
    """
    try:
        booking = Booking.objects.get(id=booking_id)
        
        # Verify user is booking owner or staff
        if booking.user != request.user and not request.user.is_staff:
            return Response(
                {'error': 'You do not have permission to view this booking'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = BookingPaymentStatusSerializer(booking)
        return Response({
            'success': True,
            'data': serializer.data
        })
    
    except Booking.DoesNotExist:
        return Response(
            {'success': False, 'error': 'Booking not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f"Error getting payment status: {str(e)}")
        return Response(
            {'success': False, 'error': 'Error retrieving payment status'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
