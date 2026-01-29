from django.db import models
from django.core.validators import MinValueValidator
from decimal import Decimal
from authentication.models import User


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
        ('family', 'Family'),
        ('suite', 'Suite'),
        ('deluxe', 'Deluxe'),
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
        
        # Available = total - booked
        return max(0, self.total_rooms - booked)
    
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
    
    # Additional information
    guest_name = models.CharField(max_length=255, blank=True)
    guest_email = models.EmailField(blank=True)
    guest_phone = models.CharField(max_length=20, blank=True)
    special_requests = models.TextField(blank=True)
    
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
    
    def save(self, *args, **kwargs):
        """Auto-calculate total price if not set"""
        if not self.total_price and self.room_type and self.check_in and self.check_out:
            nights = (self.check_out - self.check_in).days
            self.total_price = self.room_type.price_per_night * nights * self.rooms_booked
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