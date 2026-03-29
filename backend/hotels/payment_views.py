"""
Payment views for handling Stripe payment processing
  - Idempotency keys prevent duplicate PaymentIntents
  - Webhooks auto-confirm bookings (no manual admin confirm needed)
  - Duplicate payment_intent values are handled gracefully
"""
import stripe
import logging
import json
import hashlib
import os
from math import ceil
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
from django.db import transaction, IntegrityError
from dotenv import load_dotenv

from .models import Booking, Payment
from .payment_serializers import (
    PaymentSerializer, CreatePaymentSessionSerializer,
    BookingPaymentStatusSerializer
)
from .permissions import CanAccessPayments
from travello_backend.utils import get_safe_error_response, validate_api_key

# Notification helper — import lazily to avoid circular imports
def _notify_payment(user, booking, amount=None):
    """Create booking + payment notifications after successful payment."""
    try:
        from authentication.models import Notification
        hotel_name = getattr(booking, 'hotel_name', '') or getattr(booking, 'hotel', {}) or 'your hotel'
        if hasattr(hotel_name, 'name'):
            hotel_name = hotel_name.name
        Notification.booking_confirmed(user, booking.id, hotel_name)
        if amount:
            Notification.payment_received(user, float(amount), booking.id)
    except Exception as exc:
        logger.warning(f"Failed to create notification: {exc}")

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
                # Delete any failed Payment record for this booking
                from hotels.models import Payment
                Payment.objects.filter(booking=booking, status='FAILED').delete()
                # Always create a new Payment record for each booking if payment is not already processing or succeeded
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
                    # If already SUCCEEDED, return success idempotently
                    if payment.status == 'SUCCEEDED':
                        logger.info(f"Idempotent hit: booking {booking.id} already paid")
                        return Response({
                            'success': True,
                            'message': 'Payment already completed',
                            'payment_id': payment.id,
                            'status': 'SUCCEEDED',
                        }, status=status.HTTP_200_OK)
                    # PROCESSING — return existing session URL if available
                    if payment.stripe_session_id:
                        try:
                            existing_session = stripe.checkout.Session.retrieve(payment.stripe_session_id)
                            if existing_session.url and existing_session.status == 'open':
                                return Response({
                                    'success': True,
                                    'message': 'Payment session already active',
                                    'session_id': existing_session.id,
                                    'session_url': existing_session.url,
                                    'payment_id': payment.id,
                                    'publishable_key': STRIPE_PUBLISHABLE_KEY,
                                }, status=status.HTTP_200_OK)
                        except Exception:
                            pass  # session expired — create a new one below

                    # Reset to PENDING so we can create a new session
                    payment.status = 'PENDING'
                    payment.save(update_fields=['status'])

                currency = STRIPE_CURRENCY_PRIMARY
                amount_cents = int(float(booking.total_price) * 100)

                # Idempotency key: deterministic hash of booking + amount + user
                idempotency_key = hashlib.sha256(
                    f"{booking.user.id}:{booking.id}:{booking.total_price}:{currency}".encode()
                ).hexdigest()

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
                    session = stripe.checkout.Session.create(
                        **session_kwargs,
                        idempotency_key=idempotency_key,
                    )
                except stripe.error.InvalidRequestError as e:
                    if 'currency' in str(e).lower():
                        logger.warning(
                            f"Stripe currency {currency} not supported, "
                            f"falling back to {STRIPE_CURRENCY_FALLBACK}: {str(e)}"
                        )
                        currency = STRIPE_CURRENCY_FALLBACK
                        payment.currency = currency
                        session_kwargs['line_items'][0]['price_data']['currency'] = currency
                        idempotency_key_fb = hashlib.sha256(
                            f"{booking.user.id}:{booking.id}:{booking.total_price}:{currency}".encode()
                        ).hexdigest()
                        session = stripe.checkout.Session.create(
                            **session_kwargs,
                            idempotency_key=idempotency_key_fb,
                        )
                    else:
                        raise

                # Save payment record — handle duplicate stripe_payment_intent gracefully
                payment.stripe_payment_intent = session.payment_intent or ''
                payment.stripe_session_id = session.id
                payment.status = 'PROCESSING'
                try:
                    with transaction.atomic():  # nested savepoint
                        payment.save()
                except IntegrityError as ie:
                    # Another request already saved with this payment_intent.
                    # The nested savepoint was rolled back but the outer
                    # transaction is still usable.
                    logger.warning(f"Duplicate payment_intent race condition: {ie}")
                    existing = Payment.objects.filter(
                        stripe_payment_intent=session.payment_intent
                    ).exclude(pk=payment.pk).first()
                    if existing:
                        return Response({
                            'success': True,
                            'message': 'Payment session already exists',
                            'session_id': session.id,
                            'session_url': session.url,
                            'payment_id': existing.id,
                            'publishable_key': STRIPE_PUBLISHABLE_KEY,
                        }, status=status.HTTP_200_OK)
                    return Response(
                        {'success': False, 'error': 'Payment already in progress. Please refresh.'},
                        status=status.HTTP_409_CONFLICT,
                    )
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
    """Handle checkout.session.completed event — auto-confirms booking."""
    booking_id = session['metadata'].get('booking_id')
    payment_id = session['metadata'].get('payment_id')
    
    if not booking_id:
        logger.warning("Webhook received without booking_id metadata")
        return
    
    try:
        with transaction.atomic():
            booking = Booking.objects.select_for_update().get(id=booking_id)
            
            # Idempotency: skip if already paid
            if booking.status == 'PAID':
                logger.info(f"Webhook idempotent: booking {booking_id} already PAID")
                return

            booking.status = 'PAID'
            booking.save(update_fields=['status'])
            
            payment = Payment.objects.select_for_update().get(id=payment_id)
            if payment.status != 'SUCCEEDED':
                payment.status = 'SUCCEEDED'
                payment.save(update_fields=['status'])
            
            logger.info(f"Booking {booking_id} auto-confirmed as PAID via webhook")

            # Notify user
            _notify_payment(booking.user, booking, payment.amount)

    except Booking.DoesNotExist:
        logger.error(f"Booking {booking_id} not found for webhook")
    except Payment.DoesNotExist:
        logger.error(f"Payment {payment_id} not found for webhook")
    except Exception as e:
        logger.error(f"Error handling checkout session: {e}", exc_info=True)


def handle_payment_intent_succeeded(payment_intent):
    """Handle payment_intent.succeeded event — auto-confirms booking."""
    booking_id = payment_intent['metadata'].get('booking_id')
    
    if not booking_id:
        logger.warning("Payment intent webhook without booking_id")
        return
    
    try:
        with transaction.atomic():
            booking = Booking.objects.select_for_update().get(id=booking_id)
            
            # Idempotency: skip if already paid
            if booking.status == 'PAID':
                logger.info(f"payment_intent.succeeded idempotent: booking {booking_id} already PAID")
                return

            booking.status = 'PAID'
            booking.save(update_fields=['status'])
            
            try:
                payment = booking.payment
                if payment.status != 'SUCCEEDED':
                    payment.status = 'SUCCEEDED'
                    # Only update stripe_payment_intent if not already set
                    if not payment.stripe_payment_intent:
                        payment.stripe_payment_intent = payment_intent['id']
                    payment.save(update_fields=['status', 'stripe_payment_intent'])
            except Payment.DoesNotExist:
                logger.warning(f"Payment record not found for booking {booking_id}")
            
            logger.info(f"Booking {booking_id} auto-confirmed as PAID (payment_intent.succeeded)")

            # Notify user
            _notify_payment(booking.user, booking)
    
    except Booking.DoesNotExist:
        logger.error(f"Booking {booking_id} not found in webhook")
    except Exception as e:
        logger.error(f"Error handling payment intent: {e}", exc_info=True)


def handle_payment_intent_failed(payment_intent):
    """Handle payment_intent.payment_failed event."""
    booking_id = payment_intent['metadata'].get('booking_id')
    if not booking_id:
        return
    try:
        with transaction.atomic():
            payment = Payment.objects.select_for_update().get(booking_id=booking_id)
            if payment.status == 'FAILED':
                return  # idempotent
            payment.status = 'FAILED'
            payment.error_message = payment_intent.get('last_payment_error', {}).get('message', 'Payment failed')
            payment.save(update_fields=['status', 'error_message'])
        logger.warning(f"Payment failed for booking {booking_id}: {payment.error_message}")
    except Payment.DoesNotExist:
        logger.warning(f"Payment record not found for failed booking {booking_id}")
    except Exception as e:
        logger.error(f"Error handling failed payment intent: {e}", exc_info=True)


def handle_charge_refunded(charge):
    """Handle charge.refunded event."""
    payment_intent_id = charge.get('payment_intent')
    if not payment_intent_id:
        return
    try:
        with transaction.atomic():
            payment = Payment.objects.select_for_update().get(stripe_payment_intent=payment_intent_id)
            if payment.status == 'REFUNDED':
                return  # idempotent
            payment.status = 'REFUNDED'
            payment.save(update_fields=['status'])
            booking = payment.booking
            if booking.status == 'PAID':
                booking.status = 'PENDING'
                booking.save(update_fields=['status'])
        logger.info(f"Payment {payment.id} refunded for booking {payment.booking_id}")
    except Payment.DoesNotExist:
        logger.warning(f"Payment not found for refund: {payment_intent_id}")
    except Exception as e:
        logger.error(f"Error handling refund: {e}", exc_info=True)


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


# ─────────────────────────────────────────────────────────────
#  SIMULATION MODE  — Works without Stripe keys
# ─────────────────────────────────────────────────────────────

class SimulatedPaymentView(APIView):
    """
    POST /api/payments/simulate/
    
    Simulates a payment flow for MVP / development.
    Supports:
      - Credit/Debit Card (simulated validation)
      - Cash on Arrival
    
    Request Body:
    {
        "booking_id": 123,
        "payment_method": "card",   // "card" or "cash_on_arrival"
        "card_number": "4242424242424242",  // only for card
        "card_expiry": "12/28",            // only for card
        "card_cvv": "123",                 // only for card
        "card_holder": "John Doe"          // only for card
    }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        booking_id = request.data.get('booking_id')
        payment_method = request.data.get('payment_method', 'card')

        if not booking_id:
            return Response(
                {'success': False, 'error': 'booking_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            booking = Booking.objects.select_related('hotel', 'room_type', 'user').get(id=booking_id)
        except Booking.DoesNotExist:
            return Response(
                {'success': False, 'error': 'Booking not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Verify ownership
        if booking.user != request.user and not request.user.is_staff:
            return Response(
                {'success': False, 'error': 'Access denied'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Already paid?
        if booking.status == 'PAID':
            return Response(
                {'success': False, 'error': 'Booking is already paid'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if booking.status == 'CANCELLED':
            return Response(
                {'success': False, 'error': 'Cannot pay for a cancelled booking'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # ── PRE-PAYMENT VALIDATION ──────────────────────────

        # 1. Room still available?
        if booking.room_type:
            avail = booking.room_type.get_available_rooms(booking.check_in, booking.check_out)
            if avail < booking.rooms_booked:
                return Response({
                    'success': False,
                    'error': f'Room no longer available. Only {avail} left.',
                    'validation_error': 'room_unavailable'
                }, status=status.HTTP_409_CONFLICT)

        # 2. Price unchanged check — recalculate
        if booking.room_type and booking.check_in and booking.check_out:
            from decimal import Decimal, ROUND_HALF_UP
            from hotels.models import GST_RATE, SERVICE_CHARGE_RATE
            nights = max(1, (booking.check_out - booking.check_in).days)
            expected_base = (booking.room_type.price_per_night * nights * booking.rooms_booked)
            expected_base = expected_base.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            if booking.base_price and booking.base_price != expected_base:
                # Price has changed — update and notify
                old_total = float(booking.total_price or 0)
                booking.calculate_price_breakdown()
                booking.save()
                return Response({
                    'success': False,
                    'error': 'Price has been updated since booking was created.',
                    'validation_error': 'price_changed',
                    'old_total': old_total,
                    'new_total': float(booking.total_price),
                    'price_breakdown': booking.price_breakdown,
                }, status=status.HTTP_409_CONFLICT)

        # 3. Dates still valid?
        from django.utils import timezone as tz
        if booking.check_in and booking.check_in < tz.now().date():
            return Response({
                'success': False,
                'error': 'Check-in date is in the past',
                'validation_error': 'dates_invalid'
            }, status=status.HTTP_400_BAD_REQUEST)

        # 4. Guest count matches occupancy?
        if booking.room_type:
            total_adults = booking.adults or 0
            total_children = booking.children or 0
            total_guests = total_adults + total_children
            allowed_guests = (booking.room_type.max_occupancy or 0) * (booking.rooms_booked or 1)

            if total_guests > allowed_guests:
                # Scraped hotel entries are seeded with conservative occupancy.
                # Auto-align for existing scraped bookings so payment isn't blocked.
                hotel_desc = (booking.hotel.description or '').lower() if booking.hotel else ''
                is_scraped_booking = 'scraped hotel:' in hotel_desc
                if is_scraped_booking:
                    required_per_room = max(1, ceil(total_guests / max(1, booking.rooms_booked or 1)))
                    if required_per_room > (booking.room_type.max_occupancy or 0):
                        booking.room_type.max_occupancy = required_per_room
                        booking.room_type.save(update_fields=['max_occupancy'])
                        allowed_guests = (booking.room_type.max_occupancy or 0) * (booking.rooms_booked or 1)
                        logger.info(
                            f"Auto-adjusted occupancy for scraped booking {booking.id}: "
                            f"max_occupancy={booking.room_type.max_occupancy}, total_guests={total_guests}"
                        )

                if total_guests > allowed_guests:
                    return Response({
                        'success': False,
                        'error': f'Total guests ({total_guests}) exceed maximum occupancy for {booking.rooms_booked} room(s).',
                        'validation_error': 'occupancy_exceeded',
                        'total_guests': total_guests,
                        'adults': total_adults,
                        'children': total_children,
                        'max_occupancy': allowed_guests,
                    }, status=status.HTTP_400_BAD_REQUEST)

        # ── PROCESS PAYMENT ─────────────────────────────────

        if payment_method == 'card':
            # Simulated card validation
            card_number = str(request.data.get('card_number', '')).replace(' ', '').replace('-', '')
            card_expiry = request.data.get('card_expiry', '')
            card_cvv = request.data.get('card_cvv', '')
            card_holder = request.data.get('card_holder', '')

            errors = []
            if not card_number or len(card_number) < 13 or len(card_number) > 19:
                errors.append('Invalid card number')
            if not card_expiry or '/' not in card_expiry:
                errors.append('Invalid expiry date (use MM/YY)')
            if not card_cvv or len(card_cvv) < 3 or len(card_cvv) > 4:
                errors.append('Invalid CVV')
            if not card_holder or len(card_holder) < 2:
                errors.append('Card holder name is required')

            if errors:
                return Response(
                    {'success': False, 'error': '; '.join(errors), 'validation_errors': errors},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Determine card brand
            brand = 'Unknown'
            if card_number.startswith('4'):
                brand = 'Visa'
            elif card_number[:2] in ('51', '52', '53', '54', '55'):
                brand = 'Mastercard'
            elif card_number[:2] in ('34', '37'):
                brand = 'Amex'

            # Simulate successful payment
            with transaction.atomic():
                booking.status = 'PAID'
                booking.payment_method = 'ONLINE'
                if not booking.base_price:
                    booking.calculate_price_breakdown()
                booking.save()

                # Create Payment record
                payment, _ = Payment.objects.update_or_create(
                    booking=booking,
                    defaults={
                        'amount': booking.total_price,
                        'currency': 'PKR',
                        'status': 'SUCCEEDED',
                        'payment_method_type': 'card',
                        'last4': card_number[-4:],
                        'brand': brand,
                        'stripe_payment_intent': f'sim_pi_{booking.booking_reference}',
                        'metadata': {
                            'simulated': True,
                            'card_holder': card_holder,
                            'card_brand': brand,
                        }
                    }
                )

            logger.info(f"Simulated card payment for booking {booking.id} ({booking.booking_reference})")

            # Create notifications
            _notify_payment(request.user, booking, booking.total_price or booking.base_price)

            return Response({
                'success': True,
                'message': 'Payment successful (simulation mode)',
                'booking_id': booking.id,
                'booking_reference': booking.booking_reference,
                'invoice_number': booking.invoice_number,
                'payment_method': 'card',
                'card_brand': brand,
                'card_last4': card_number[-4:],
                'price_breakdown': booking.price_breakdown,
                'status': 'PAID'
            })

        elif payment_method == 'cash_on_arrival':
            with transaction.atomic():
                booking.status = 'CONFIRMED'
                booking.payment_method = 'ARRIVAL'
                if not booking.base_price:
                    booking.calculate_price_breakdown()
                booking.save()

            logger.info(f"Cash on arrival confirmed for booking {booking.id} ({booking.booking_reference})")

            # Create notification
            _notify_payment(request.user, booking)

            return Response({
                'success': True,
                'message': 'Booking confirmed. Pay at the hotel upon arrival.',
                'booking_id': booking.id,
                'booking_reference': booking.booking_reference,
                'payment_method': 'cash_on_arrival',
                'price_breakdown': booking.price_breakdown,
                'status': 'CONFIRMED'
            })

        else:
            return Response(
                {'success': False, 'error': f'Unsupported payment method: {payment_method}'},
                status=status.HTTP_400_BAD_REQUEST
            )


class BookingPriceBreakdownView(APIView):
    """
    GET /api/payments/booking/{booking_id}/breakdown/
    
    Returns the price breakdown for a booking.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, booking_id):
        try:
            booking = Booking.objects.select_related('hotel', 'room_type').get(id=booking_id)
        except Booking.DoesNotExist:
            return Response({'success': False, 'error': 'Booking not found'}, status=status.HTTP_404_NOT_FOUND)

        if booking.user != request.user and not request.user.is_staff:
            return Response({'success': False, 'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

        # Recalculate if missing
        if not booking.base_price:
            booking.calculate_price_breakdown()
            booking.save()

        return Response({
            'success': True,
            'booking_id': booking.id,
            'booking_reference': booking.booking_reference,
            'hotel_name': booking.hotel.name if booking.hotel else '',
            'room_type': booking.room_type.get_type_display() if booking.room_type else '',
            'check_in': str(booking.check_in),
            'check_out': str(booking.check_out),
            'price_breakdown': booking.price_breakdown,
        })


class BookingInvoiceView(APIView):
    """
    GET /api/payments/booking/{booking_id}/invoice/
    
    Returns a downloadable HTML invoice for a paid booking.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, booking_id):
        from django.http import HttpResponse
        import json
        from html import escape

        try:
            booking = Booking.objects.select_related('hotel', 'room_type', 'user').get(id=booking_id)
        except Booking.DoesNotExist:
            return Response({'success': False, 'error': 'Booking not found'}, status=status.HTTP_404_NOT_FOUND)

        if booking.user != request.user and not request.user.is_staff:
            return Response({'success': False, 'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

        if booking.status not in ('PAID', 'CONFIRMED', 'COMPLETED'):
            return Response({'success': False, 'error': 'Invoice only available for confirmed/paid bookings'}, status=status.HTTP_400_BAD_REQUEST)

        # Ensure price breakdown exists
        if not booking.base_price:
            booking.calculate_price_breakdown()
            booking.save()

        hotel_name = booking.hotel.name if booking.hotel else 'N/A'
        room_type = booking.room_type.get_type_display() if booking.room_type else 'N/A'
        guest = booking.guest_name or (booking.user.get_full_name() if booking.user else 'Guest')
        email = booking.guest_email or (booking.user.email if booking.user else '')
        guest_phone = booking.guest_phone or 'N/A'

        lead_pax = None
        passengers = []
        if booking.special_requests:
            try:
                details = json.loads(booking.special_requests)
                if isinstance(details, dict):
                    if isinstance(details.get('lead_pax'), dict):
                        lead_pax = details.get('lead_pax')
                    if isinstance(details.get('passengers'), list):
                        passengers = [p for p in details.get('passengers') if isinstance(p, dict)]
            except Exception:
                pass

        lead_pax_html = ''
        if lead_pax:
            lead_name = escape(str(lead_pax.get('name') or guest))
            lead_dob = escape(str(lead_pax.get('dob') or 'N/A'))
            lead_contact = escape(str(lead_pax.get('phone') or lead_pax.get('email') or guest_phone))
            lead_pax_html = (
                f'<div class="row"><span class="label">Lead Passenger</span><span class="value">{lead_name}</span></div>'
                f'<div class="row"><span class="label">Lead DOB</span><span class="value">{lead_dob}</span></div>'
                f'<div class="row"><span class="label">Lead Contact</span><span class="value">{lead_contact}</span></div>'
            )

        passengers_html = ''
        if passengers:
            items = []
            for idx, p in enumerate(passengers, 1):
                pax_name = escape(str(p.get('name') or 'N/A'))
                pax_type = escape(str(p.get('type') or 'guest'))
                items.append(f'<div class="row"><span class="label">Passenger {idx}</span><span class="value">{pax_name} ({pax_type})</span></div>')
            passengers_html = ''.join(items)

        html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Invoice {booking.invoice_number or booking.booking_reference}</title>
<style>
    body {{ font-family: 'Segoe UI', Arial, sans-serif; max-width: 700px; margin: 40px auto; padding: 20px; color: #1a1a2e; }}
    .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; }}
    .header h1 {{ margin: 0; font-size: 28px; }}
    .header p {{ margin: 5px 0 0; opacity: 0.9; }}
    .body {{ border: 1px solid #e2e8f0; border-top: none; padding: 30px; border-radius: 0 0 12px 12px; }}
    .section {{ margin-bottom: 24px; }}
    .section h3 {{ color: #667eea; margin-bottom: 8px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }}
    .row {{ display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }}
    .row:last-child {{ border-bottom: none; }}
    .label {{ color: #64748b; }}
    .value {{ font-weight: 600; }}
    .total-row {{ background: #f8fafc; padding: 12px; border-radius: 8px; margin-top: 8px; font-size: 18px; }}
    .total-row .value {{ color: #667eea; }}
    .badge {{ background: #10b981; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }}
    .footer {{ text-align: center; margin-top: 30px; color: #94a3b8; font-size: 12px; }}
</style>
</head>
<body>
    <div class="header">
        <h1>🧳 Travello</h1>
        <p>Booking Confirmation & Invoice</p>
    </div>
    <div class="body">
        <div class="section">
            <h3>Booking Details</h3>
            <div class="row"><span class="label">Booking Reference</span><span class="value">{booking.booking_reference}</span></div>
            <div class="row"><span class="label">Invoice Number</span><span class="value">{booking.invoice_number or 'Pending'}</span></div>
            <div class="row"><span class="label">Status</span><span class="badge">{booking.status}</span></div>
        </div>
        
        <div class="section">
            <h3>Guest Information</h3>
            <div class="row"><span class="label">Guest Name</span><span class="value">{escape(str(guest))}</span></div>
            <div class="row"><span class="label">Email</span><span class="value">{escape(str(email))}</span></div>
            <div class="row"><span class="label">Phone</span><span class="value">{escape(str(guest_phone))}</span></div>
            <div class="row"><span class="label">Adults</span><span class="value">{booking.adults or 0}</span></div>
            <div class="row"><span class="label">Children</span><span class="value">{booking.children or 0}</span></div>
            {lead_pax_html}
            {passengers_html}
        </div>
        
        <div class="section">
            <h3>Hotel & Room</h3>
            <div class="row"><span class="label">Hotel</span><span class="value">{hotel_name}</span></div>
            <div class="row"><span class="label">Room Type</span><span class="value">{room_type}</span></div>
            <div class="row"><span class="label">Rooms</span><span class="value">{booking.rooms_booked}</span></div>
            <div class="row"><span class="label">Check-in</span><span class="value">{booking.check_in}</span></div>
            <div class="row"><span class="label">Check-out</span><span class="value">{booking.check_out}</span></div>
            <div class="row"><span class="label">Nights</span><span class="value">{booking.number_of_nights}</span></div>
        </div>
        
        <div class="section">
            <h3>Price Breakdown</h3>
            <div class="row"><span class="label">Room Rate ({booking.number_of_nights} nights × {booking.rooms_booked} room(s))</span><span class="value">PKR {booking.base_price or booking.total_price}</span></div>
            <div class="row"><span class="label">GST (16%)</span><span class="value">PKR {booking.tax_amount or 0}</span></div>
            <div class="row"><span class="label">Service Charge (5%)</span><span class="value">PKR {booking.service_charge or 0}</span></div>
            <div class="row total-row"><span class="label">Total</span><span class="value">PKR {booking.total_price}</span></div>
        </div>
        
        <div class="section">
            <h3>Payment</h3>
            <div class="row"><span class="label">Payment Method</span><span class="value">{booking.get_payment_method_display()}</span></div>
            <div class="row"><span class="label">Date</span><span class="value">{booking.updated_at.strftime('%B %d, %Y %I:%M %p') if booking.updated_at else 'N/A'}</span></div>
        </div>
    </div>
    <div class="footer">
        <p>Thank you for booking with Travello! 🌍</p>
        <p>This is a system-generated invoice. No signature required.</p>
    </div>
</body>
</html>"""

        response = HttpResponse(html, content_type='text/html')
        response['Content-Disposition'] = f'inline; filename="invoice_{booking.booking_reference}.html"'
        return response


class BookingConfirmationEmailView(APIView):
    """
    POST /api/payments/booking/{booking_id}/send-confirmation/
    
    Sends a real booking confirmation email via SMTP.
    Falls back to simulation if email sending fails.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, booking_id):
        try:
            booking = Booking.objects.select_related('hotel', 'room_type', 'user').get(id=booking_id)
        except Booking.DoesNotExist:
            return Response({'success': False, 'error': 'Booking not found'}, status=status.HTTP_404_NOT_FOUND)

        if booking.user != request.user and not request.user.is_staff:
            return Response({'success': False, 'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

        from django.utils import timezone as tz
        from django.core.mail import send_mail
        from django.template.loader import render_to_string

        recipient = booking.guest_email or booking.user.email
        hotel_name = booking.hotel.name if booking.hotel else 'Your Hotel'
        room_display = booking.room_type.get_type_display() if booking.room_type else 'Standard Room'
        total_price = float(booking.total_price or 0)

        subject = f'Booking Confirmed - {booking.booking_reference}'

        # Build rich HTML email
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="margin:0;padding:0;background:#f4f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
          <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
            <div style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
              <!-- Header -->
              <div style="background:linear-gradient(135deg,#2563eb,#4f46e5);padding:32px;text-align:center;">
                <h1 style="color:white;margin:0;font-size:28px;">Booking Confirmed!</h1>
                <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Reference: {booking.booking_reference}</p>
              </div>
              
              <!-- Content -->
              <div style="padding:32px;">
                <p style="color:#374151;font-size:16px;margin:0 0 24px;">Hi {booking.user.first_name or booking.user.username},</p>
                <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 24px;">
                  Your booking has been confirmed. Here are the details:
                </p>
                
                <!-- Booking Details Card -->
                <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:24px;">
                  <table style="width:100%;border-collapse:collapse;">
                    <tr>
                      <td style="padding:8px 0;color:#6b7280;font-size:14px;">Hotel</td>
                      <td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600;text-align:right;">{hotel_name}</td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;color:#6b7280;font-size:14px;">Room Type</td>
                      <td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600;text-align:right;">{room_display}</td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;color:#6b7280;font-size:14px;">Check-in</td>
                      <td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600;text-align:right;">{booking.check_in}</td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;color:#6b7280;font-size:14px;">Check-out</td>
                      <td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600;text-align:right;">{booking.check_out}</td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;color:#6b7280;font-size:14px;">Nights</td>
                      <td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600;text-align:right;">{booking.number_of_nights}</td>
                    </tr>
                    <tr style="border-top:2px solid #e5e7eb;">
                      <td style="padding:12px 0 8px;color:#2563eb;font-size:16px;font-weight:700;">Total</td>
                      <td style="padding:12px 0 8px;color:#2563eb;font-size:16px;font-weight:700;text-align:right;">PKR {total_price:,.0f}</td>
                    </tr>
                  </table>
                </div>

                <p style="color:#6b7280;font-size:13px;line-height:1.6;">
                  Status: <strong style="color:#059669;">{booking.get_status_display()}</strong>
                </p>

                <!-- Support -->
                <div style="margin-top:24px;padding-top:20px;border-top:1px solid #e5e7eb;">
                  <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">
                    Need help? Contact our 24/7 support team.<br>
                    Travello — Your Smart Travel Companion
                  </p>
                </div>
              </div>
            </div>
          </div>
        </body>
        </html>
        """

        plain_text = (
            f"Booking Confirmed — {booking.booking_reference}\n\n"
            f"Hotel: {hotel_name}\n"
            f"Room: {room_display}\n"
            f"Check-in: {booking.check_in}\n"
            f"Check-out: {booking.check_out}\n"
            f"Total: PKR {total_price:,.0f}\n\n"
            f"Status: {booking.get_status_display()}\n"
        )

        email_sent = False
        try:
            send_mail(
                subject=subject,
                message=plain_text,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[recipient],
                html_message=html_content,
                fail_silently=False,
            )
            email_sent = True
            logger.info(f"Confirmation email SENT for booking {booking.booking_reference} to {recipient}")
        except Exception as email_err:
            logger.warning(f"Email sending failed for booking {booking.booking_reference}: {email_err}")

        email_data = {
            'to': recipient,
            'subject': subject,
            'hotel': hotel_name,
            'room': room_display,
            'check_in': str(booking.check_in),
            'check_out': str(booking.check_out),
            'total': total_price,
            'status': booking.status,
            'sent_at': tz.now().isoformat(),
            'email_sent': email_sent,
        }

        # Store in booking payment metadata
        try:
            payment = booking.payment
            meta = payment.metadata or {}
            meta['confirmation_email'] = email_data
            payment.metadata = meta
            payment.save(update_fields=['metadata'])
        except Payment.DoesNotExist:
            pass

        return Response({
            'success': True,
            'email_sent': email_sent,
            'message': f'Confirmation email {"sent" if email_sent else "queued"} to {recipient}',
            'email_data': email_data,
        })

