"""
Payment URLs
"""
from django.urls import path
from .payment_views import (
    CreatePaymentSessionView,
    StripeWebhookView,
    get_booking_payment_status
)

urlpatterns = [
    # Create Stripe payment session for a booking
    path('create-session/', CreatePaymentSessionView.as_view(), name='create-payment-session'),
    
    # Stripe webhook handler
    path('webhook/', StripeWebhookView.as_view(), name='stripe-webhook'),
    
    # Get payment status for a booking
    path('booking/<int:booking_id>/status/', get_booking_payment_status, name='booking-payment-status'),
]
