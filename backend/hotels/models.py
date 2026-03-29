import uuid
import random
import string
from django.db import models
from django.core.validators import MinValueValidator
from django.utils import timezone
from decimal import Decimal, ROUND_HALF_UP
from authentication.models import User

# Tax constants for Pakistan
GST_RATE = Decimal('0.16')   # 16% GST
SERVICE_CHARGE_RATE = Decimal('0.05')  # 5% service charge


class Hotel(models.Model):
    """
    Hotel model - Stores hotel information
    """
    name = models.CharField(max_length=255, db_index=True)
    city = models.CharField(max_length=100, db_index=True)
    address = models.TextField(default='Unknown')
    description = models.TextField()
    
    # Additional fields (keeping backward compatibility)
    image = models.URLField(max_length=500, blank=True, null=True)
    rating = models.FloatField(default=0.0, validators=[MinValueValidator(0.0)])
    wifi_available = models.BooleanField(default=False)
    parking_available = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'hotels_hotel'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['city']),
            models.Index(fields=['name']),
        ]
    
    def __str__(self):
        return f"{self.name} - {self.city}"
    
    @property
    def total_rooms(self):
        """Calculate total rooms across all room types"""
        return sum(room_type.total_rooms for room_type in self.room_types.all())
    
    @property
    def available_rooms(self):
        """Calculate available rooms across all room types"""
        return sum(room_type.available_rooms for room_type in self.room_types.all())


class RoomType(models.Model):
    """
    Room Type model - Different room types for each hotel
    """
    ROOM_TYPE_CHOICES = [
        ('single', 'Single'),
        ('double', 'Double'),
        ('triple', 'Triple'),
        ('quad', 'Quad'),
        ('quint', 'Quint'),
        ('family', 'Family'),
        ('suite', 'Suite'),
        ('deluxe', 'Deluxe'),
        ('dormitory', 'Dormitory'),
        ('entire', 'Entire Property'),
    ]
    
    hotel = models.ForeignKey(
        Hotel, 
        on_delete=models.CASCADE, 
        related_name='room_types'
    )
    type = models.CharField(
        max_length=20, 
        choices=ROOM_TYPE_CHOICES,
        db_index=True
    )
    price_per_night = models.DecimalField(
        max_digits=10, 
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    total_rooms = models.IntegerField(
        validators=[MinValueValidator(1)]
    )
    max_occupancy = models.IntegerField(
        default=2,
        validators=[MinValueValidator(1)]
    )
    description = models.TextField(blank=True)
    amenities = models.TextField(
        blank=True,
        help_text="Comma-separated amenities (e.g., TV, Mini-bar, Balcony)"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'hotels_roomtype'
        ordering = ['price_per_night']
        unique_together = ['hotel', 'type']
        indexes = [
            models.Index(fields=['hotel', 'type']),
        ]
    
    def __str__(self):
        return f"{self.hotel.name} - {self.get_type_display()} (${self.price_per_night}/night)"
    
    def get_available_rooms(self, check_in=None, check_out=None):
        """
        Calculate available rooms for a specific date range.
        
        Args:
            check_in: Check-in date (defaults to today)
            check_out: Check-out date (defaults to tomorrow)
        
        Returns:
            Number of available rooms for the specified period
        """
        from django.db.models import Sum
        from django.utils import timezone
        
        if check_in is None:
            check_in = timezone.now().date()
        if check_out is None:
            check_out = check_in + timezone.timedelta(days=1)
        
        # Find overlapping bookings using the rule:
        # A booking overlaps if: check_in < selected_check_out AND check_out > selected_check_in
        overlapping_bookings = Booking.objects.filter(
            room_type=self,
            status__in=['PENDING', 'PAID', 'CONFIRMED'],
            check_in__lt=check_out,  # Booking starts before our checkout
            check_out__gt=check_in   # Booking ends after our checkin
        )
        
        # Sum all rooms booked in overlapping periods
        booked = overlapping_bookings.aggregate(
            total=Sum('rooms_booked')
        )['total'] or 0
        
        # Available = total - booked (handle None value)
        total = self.total_rooms or 0
        return max(0, total - booked)
    
    @classmethod
    def check_availability_for_hotel(cls, hotel, check_in, check_out):
        """
        Check availability for all room types in a hotel.
        
        Args:
            hotel: Hotel instance
            check_in: Check-in date
            check_out: Check-out date
        
        Returns:
            dict: Room type availability mapping
        """
        availability = {}
        for room_type in hotel.room_types.all():
            available = room_type.get_available_rooms(check_in, check_out)
            availability[room_type.id] = {
                'type': room_type.type,
                'type_display': room_type.get_type_display(),
                'price_per_night': room_type.price_per_night,
                'total_rooms': room_type.total_rooms,
                'available_rooms': available,
                'is_available': available > 0,
            }
        return availability
    
    @property
    def available_rooms(self):
        """
        Get currently available rooms (from today onwards).
        This is a convenience property for admin/display purposes.
        """
        return self.get_available_rooms()


class Booking(models.Model):
    """
    Booking model - Stores hotel booking information
    """
    PAYMENT_METHOD_CHOICES = [
        ('ONLINE', 'Online Payment'),
        ('ARRIVAL', 'Pay on Arrival'),
    ]
    
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('PAID', 'Paid'),
        ('CONFIRMED', 'Confirmed'),
        ('CANCELLED', 'Cancelled'),
        ('COMPLETED', 'Completed'),
    ]
    
    user = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='hotel_bookings'
    )
    hotel = models.ForeignKey(
        Hotel, 
        on_delete=models.CASCADE, 
        related_name='bookings'
    )
    room_type = models.ForeignKey(
        RoomType,
        on_delete=models.PROTECT,
        related_name='bookings'
    )
    rooms_booked = models.IntegerField(
        default=1,
        validators=[MinValueValidator(1)]
    )
    adults = models.IntegerField(
        default=2,
        validators=[MinValueValidator(1)]
    )
    children = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0)]
    )
    check_in = models.DateField(db_index=True, null=True, blank=False)
    check_out = models.DateField(db_index=True, null=True, blank=False)
    total_price = models.DecimalField(
        max_digits=10, 
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    payment_method = models.CharField(
        max_length=10,
        choices=PAYMENT_METHOD_CHOICES,
        default='ONLINE'
    )
    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default='PENDING',
        db_index=True
    )
    
    # Booking reference (human-friendly ID like TRV-A5K9M)
    booking_reference = models.CharField(
        max_length=12,
        unique=True,
        blank=True,
        null=True,
        db_index=True,
        help_text='Human-friendly booking reference (e.g. TRV-A5K9M)'
    )
    
    # Price breakdown
    base_price = models.DecimalField(
        max_digits=10, decimal_places=2,
        blank=True, null=True,
        help_text='Room price before tax'
    )
    tax_amount = models.DecimalField(
        max_digits=10, decimal_places=2,
        blank=True, null=True,
        help_text='GST (16%)'
    )
    service_charge = models.DecimalField(
        max_digits=10, decimal_places=2,
        blank=True, null=True,
        help_text='Service charge (5%)'
    )
    
    # Room lock system — temporary hold during payment
    room_locked_until = models.DateTimeField(
        blank=True, null=True,
        help_text='Room is held until this time during payment'
    )
    
    # Invoice
    invoice_number = models.CharField(
        max_length=20, blank=True, null=True, unique=True,
        help_text='Invoice number (e.g. INV-20260227-001)'
    )
    
    # Additional information
    guest_name = models.CharField(max_length=255, blank=True)
    guest_email = models.EmailField(blank=True)
    guest_phone = models.CharField(max_length=20, blank=True)
    special_requests = models.TextField(blank=True)
    
    # Cancellation tracking
    cancelled_at = models.DateTimeField(blank=True, null=True)
    cancellation_reason = models.TextField(
        blank=True,
        help_text='Reason for cancellation'
    )
    cancelled_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        blank=True, null=True,
        related_name='cancelled_bookings',
        help_text='Staff/user who cancelled the booking'
    )
    refund_amount = models.DecimalField(
        max_digits=10, decimal_places=2,
        blank=True, null=True,
        help_text='Amount refunded (if any)'
    )
    refund_status = models.CharField(
        max_length=15,
        choices=[
            ('NONE', 'No Refund'),
            ('PENDING', 'Refund Pending'),
            ('PROCESSED', 'Refund Processed'),
            ('FAILED', 'Refund Failed'),
        ],
        default='NONE',
        blank=True,
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'hotels_booking'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['hotel', 'check_in']),
            models.Index(fields=['status', 'created_at']),
        ]
    
    def __str__(self):
        return f"Booking #{self.id} - {self.user.email} - {self.hotel.name}"
    
    def clean(self):
        """Validate booking dates and room availability"""
        from django.core.exceptions import ValidationError
        from django.utils import timezone
        
        if self.check_in and self.check_out:
            # Validate date order
            if self.check_in >= self.check_out:
                raise ValidationError({
                    'check_out': 'Check-out date must be after check-in date'
                })
            
            # Validate check-in is not in the past (only for new bookings)
            if not self.pk and self.check_in < timezone.now().date():
                raise ValidationError({
                    'check_in': 'Check-in date cannot be in the past'
                })
        
        # Validate room availability (prevent overbooking)
        if self.room_type and self.check_in and self.check_out and self.rooms_booked:
            available = self.room_type.get_available_rooms(self.check_in, self.check_out)
            
            # If updating existing booking, add back the rooms from this booking
            if self.pk:
                try:
                    old_booking = Booking.objects.get(pk=self.pk)
                    # Only add back if dates haven't changed significantly
                    if (old_booking.room_type == self.room_type and 
                        old_booking.check_in == self.check_in and 
                        old_booking.check_out == self.check_out):
                        available += old_booking.rooms_booked
                except Booking.DoesNotExist:
                    pass
            
            if self.rooms_booked > available:
                raise ValidationError({
                    'rooms_booked': f'Only {available} rooms available for {self.room_type.get_type_display()} '
                                   f'from {self.check_in} to {self.check_out}. '
                                   f'Cannot book {self.rooms_booked} rooms.'
                })
    
    def check_availability(self):
        """
        Check if this booking can be made without overbooking.
        
        Returns:
            tuple: (is_available: bool, available_rooms: int, message: str)
        """
        if not all([self.room_type, self.check_in, self.check_out, self.rooms_booked]):
            return False, 0, "Missing required booking information"
        
        available = self.room_type.get_available_rooms(self.check_in, self.check_out)
        
        # If updating, add back current booking's rooms
        if self.pk:
            try:
                old_booking = Booking.objects.get(pk=self.pk)
                if (old_booking.room_type == self.room_type and 
                    old_booking.check_in == self.check_in and 
                    old_booking.check_out == self.check_out):
                    available += old_booking.rooms_booked
            except Booking.DoesNotExist:
                pass
        
        is_available = self.rooms_booked <= available
        message = (
            f"Available" if is_available 
            else f"Only {available} rooms available, cannot book {self.rooms_booked}"
        )
        
        return is_available, available, message
    
    @staticmethod
    def generate_booking_reference():
        """Generate a unique human-friendly booking reference like TRV-A5K9M"""
        chars = string.ascii_uppercase + string.digits
        while True:
            ref = 'TRV-' + ''.join(random.choices(chars, k=5))
            if not Booking.objects.filter(booking_reference=ref).exists():
                return ref

    @staticmethod
    def generate_invoice_number():
        """Generate a unique invoice number like INV-20260227-001"""
        today = timezone.now().strftime('%Y%m%d')
        prefix = f'INV-{today}-'
        last = Booking.objects.filter(
            invoice_number__startswith=prefix
        ).order_by('-invoice_number').first()
        if last and last.invoice_number:
            try:
                seq = int(last.invoice_number.split('-')[-1]) + 1
            except (ValueError, IndexError):
                seq = 1
        else:
            seq = 1
        return f'{prefix}{seq:03d}'

    def calculate_price_breakdown(self):
        """Calculate base price, tax, service charge, total"""
        if not self.room_type or not self.check_in or not self.check_out:
            return
        nights = max(1, (self.check_out - self.check_in).days)
        self.base_price = (self.room_type.price_per_night * nights * self.rooms_booked).quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP
        )
        self.tax_amount = (self.base_price * GST_RATE).quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP
        )
        self.service_charge = (self.base_price * SERVICE_CHARGE_RATE).quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP
        )
        self.total_price = self.base_price + self.tax_amount + self.service_charge

    def lock_room(self, minutes=15):
        """Temporarily lock the room for payment processing"""
        self.room_locked_until = timezone.now() + timezone.timedelta(minutes=minutes)
        self.save(update_fields=['room_locked_until'])

    @property
    def is_room_locked(self):
        """Check if room is still locked (within hold period)"""
        if not self.room_locked_until:
            return False
        return timezone.now() < self.room_locked_until

    @property
    def price_breakdown(self):
        """Return price breakdown dict"""
        return {
            'base_price': float(self.base_price or 0),
            'tax_rate': float(GST_RATE * 100),
            'tax_amount': float(self.tax_amount or 0),
            'service_charge_rate': float(SERVICE_CHARGE_RATE * 100),
            'service_charge': float(self.service_charge or 0),
            'total_price': float(self.total_price or 0),
            'currency': 'PKR',
            'nights': self.number_of_nights,
            'rooms': self.rooms_booked,
            'price_per_night': float(self.room_type.price_per_night) if self.room_type else 0,
        }

    def save(self, *args, **kwargs):
        """Auto-calculate prices and generate reference"""
        # Generate booking reference
        if not self.booking_reference:
            self.booking_reference = Booking.generate_booking_reference()
        # Calculate price breakdown
        if not self.total_price and self.room_type and self.check_in and self.check_out:
            self.calculate_price_breakdown()
        # Generate invoice on payment
        if self.status == 'PAID' and not self.invoice_number:
            self.invoice_number = Booking.generate_invoice_number()
        super().save(*args, **kwargs)
    
    @property
    def number_of_nights(self):
        """Calculate number of nights"""
        if self.check_in and self.check_out:
            return (self.check_out - self.check_in).days
        return 0
    
    @property
    def is_past(self):
        """Check if booking is in the past"""
        from django.utils import timezone
        return self.check_out < timezone.now().date()
    
    @property
    def is_active(self):
        """Check if booking is currently active"""
        from django.utils import timezone
        today = timezone.now().date()
        return (
            self.check_in <= today <= self.check_out and 
            self.status in ['PAID', 'CONFIRMED']
        )


class Payment(models.Model):
    """
    Payment model - Stores payment information for bookings
    """
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('PROCESSING', 'Processing'),
        ('SUCCEEDED', 'Succeeded'),
        ('FAILED', 'Failed'),
        ('REFUNDED', 'Refunded'),
        ('CANCELLED', 'Cancelled'),
    ]
    
    CURRENCY_CHOICES = [
        ('USD', 'US Dollar'),
        ('EUR', 'Euro'),
        ('GBP', 'British Pound'),
        ('PKR', 'Pakistani Rupee'),
    ]
    
    booking = models.OneToOneField(
        Booking,
        on_delete=models.CASCADE,
        related_name='payment'
    )
    stripe_payment_intent = models.CharField(
        max_length=255,
        unique=True,
        blank=True,
        null=True,
        help_text="Stripe Payment Intent ID"
    )
    stripe_session_id = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Stripe Checkout Session ID"
    )
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    currency = models.CharField(
        max_length=3,
        choices=CURRENCY_CHOICES,
        default='USD'
    )
    status = models.CharField(
        max_length=15,
        choices=STATUS_CHOICES,
        default='PENDING',
        db_index=True
    )
    
    # Additional payment metadata
    payment_method_type = models.CharField(
        max_length=50,
        blank=True,
        help_text="e.g., card, bank_transfer"
    )
    last4 = models.CharField(
        max_length=4,
        blank=True,
        help_text="Last 4 digits of card"
    )
    brand = models.CharField(
        max_length=20,
        blank=True,
        help_text="Card brand (Visa, Mastercard, etc.)"
    )
    
    error_message = models.TextField(blank=True)
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional payment metadata"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'hotels_payment'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['stripe_payment_intent']),
        ]
    
    def __str__(self):
        return f"Payment #{self.id} - Booking #{self.booking.id} - {self.status}"
    
    @property
    def is_successful(self):
        """Check if payment was successful"""
        return self.status == 'SUCCEEDED'