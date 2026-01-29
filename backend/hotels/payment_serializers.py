"""
Payment serializers for handling Stripe payments
"""
from rest_framework import serializers
from .models import Payment, Booking
from decimal import Decimal


class PaymentSerializer(serializers.ModelSerializer):
    """Serializer for Payment model"""
    booking_id = serializers.IntegerField(source='booking.id', read_only=True)
    
    class Meta:
        model = Payment
        fields = [
            'id', 'booking_id', 'amount', 'currency', 'status',
            'payment_method_type', 'last4', 'brand', 'created_at'
        ]
        read_only_fields = fields


class CreatePaymentSessionSerializer(serializers.Serializer):
    """
    Serializer for creating Stripe payment session
    Accepts booking_id and validates the booking
    """
    booking_id = serializers.IntegerField()
    
    def validate_booking_id(self, value):
        """Validate that booking exists and can be paid"""
        try:
            booking = Booking.objects.get(id=value)
        except Booking.DoesNotExist:
            raise serializers.ValidationError("Booking not found")
        
        # Only ONLINE payment bookings should reach Stripe
        if booking.payment_method != 'ONLINE':
            raise serializers.ValidationError(
                "This booking uses on-arrival payment, not online payment"
            )
        
        # Don't allow payment for already paid bookings
        if booking.status == 'PAID':
            raise serializers.ValidationError("This booking is already paid")
        
        # Don't allow payment for cancelled bookings
        if booking.status == 'CANCELLED':
            raise serializers.ValidationError("Cannot pay for cancelled bookings")
        
        return value
    
    def validate(self, data):
        """Additional validation"""
        booking_id = data.get('booking_id')
        try:
            booking = Booking.objects.get(id=booking_id)
            # Store booking for use in views
            data['booking'] = booking
        except Booking.DoesNotExist:
            pass
        
        return data


class ConfirmPaymentSerializer(serializers.Serializer):
    """
    Serializer for confirming payment after Stripe webhook
    """
    booking_id = serializers.IntegerField()
    stripe_payment_intent = serializers.CharField()
    
    def validate_booking_id(self, value):
        """Validate that booking exists"""
        try:
            Booking.objects.get(id=value)
        except Booking.DoesNotExist:
            raise serializers.ValidationError("Booking not found")
        
        return value


class BookingPaymentStatusSerializer(serializers.ModelSerializer):
    """
    Serializer showing payment status for a booking
    """
    payment_status = serializers.SerializerMethodField()
    payment_required = serializers.SerializerMethodField()
    stripe_session_id = serializers.SerializerMethodField()
    
    class Meta:
        model = Booking
        fields = [
            'id', 'payment_method', 'status', 'total_price',
            'payment_status', 'payment_required', 'stripe_session_id'
        ]
    
    def get_payment_status(self, obj):
        """Get current payment status"""
        if obj.payment_method == 'ARRIVAL':
            return 'PAY_ON_ARRIVAL'
        
        try:
            payment = obj.payment
            return payment.status
        except Payment.DoesNotExist:
            return 'NOT_INITIATED'
    
    def get_payment_required(self, obj):
        """Check if payment is required"""
        return obj.payment_method == 'ONLINE' and obj.status != 'PAID'
    
    def get_stripe_session_id(self, obj):
        """Get Stripe session ID if available"""
        try:
            payment = obj.payment
            return getattr(payment, 'stripe_session_id', None)
        except Payment.DoesNotExist:
            return None
