"""
Payment URLs — includes Stripe (real) and Simulation endpoints
"""
from django.urls import path
from .payment_views import (
    CreatePaymentSessionView,
    StripeWebhookView,
    get_booking_payment_status,
    SimulatedPaymentView,
    BookingPriceBreakdownView,
    BookingInvoiceView,
    BookingConfirmationEmailView,
)

urlpatterns = [
    # Stripe (real) payment endpoints
    path('create-session/', CreatePaymentSessionView.as_view(), name='create-payment-session'),
    path('webhook/', StripeWebhookView.as_view(), name='stripe-webhook'),
    
    # Simulated payment (MVP — works without Stripe keys)
    path('simulate/', SimulatedPaymentView.as_view(), name='simulate-payment'),
    
    # Generic payment status + breakdown
    path('booking/<int:booking_id>/status/', get_booking_payment_status, name='booking-payment-status'),
    path('booking/<int:booking_id>/breakdown/', BookingPriceBreakdownView.as_view(), name='booking-price-breakdown'),
    path('booking/<int:booking_id>/invoice/', BookingInvoiceView.as_view(), name='booking-invoice'),
    path('booking/<int:booking_id>/send-confirmation/', BookingConfirmationEmailView.as_view(), name='booking-send-confirmation'),
]
