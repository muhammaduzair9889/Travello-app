from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone
from datetime import timedelta


class User(AbstractUser):
    email = models.EmailField(unique=True)
    is_email_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']
    
    def __str__(self):
        return self.email
    
    class Meta:
        ordering = ['-created_at']


class Notification(models.Model):
    """User notification model — supports booking, payment, system, and promo notifications."""
    CATEGORY_CHOICES = [
        ('booking',  'Booking'),
        ('payment',  'Payment'),
        ('itinerary','Itinerary'),
        ('review',   'Review'),
        ('promo',    'Promotion'),
        ('system',   'System'),
    ]
    PRIORITY_CHOICES = [
        ('low',    'Low'),
        ('normal', 'Normal'),
        ('high',   'High'),
    ]

    user      = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    title     = models.CharField(max_length=200)
    message   = models.TextField()
    category  = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='system')
    priority  = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='normal')
    is_read   = models.BooleanField(default=False)
    link      = models.CharField(max_length=500, blank=True, default='')
    icon      = models.CharField(max_length=10, blank=True, default='🔔')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes  = [
            models.Index(fields=['user', 'is_read']),
            models.Index(fields=['user', '-created_at']),
        ]

    def __str__(self):
        return f"[{self.category}] {self.title} → {self.user.email}"

    @classmethod
    def create_for_user(cls, user, title, message, category='system', priority='normal', link='', icon='🔔'):
        """Factory method to create a notification."""
        return cls.objects.create(
            user=user, title=title, message=message,
            category=category, priority=priority, link=link, icon=icon,
        )

    @classmethod
    def booking_confirmed(cls, user, booking_id, hotel_name):
        return cls.create_for_user(
            user,
            title='Booking Confirmed',
            message=f'Your booking at {hotel_name} has been confirmed! Booking #{booking_id}',
            category='booking', priority='high', icon='✅',
            link=f'/bookings/{booking_id}',
        )

    @classmethod
    def payment_received(cls, user, amount, booking_id):
        return cls.create_for_user(
            user,
            title='Payment Received',
            message=f'Payment of PKR {amount:,.0f} received for booking #{booking_id}.',
            category='payment', priority='high', icon='💰',
            link=f'/bookings/{booking_id}',
        )

    @classmethod
    def itinerary_ready(cls, user, city):
        return cls.create_for_user(
            user,
            title='Itinerary Ready',
            message=f'Your AI-generated itinerary for {city} is ready to explore!',
            category='itinerary', priority='normal', icon='🗺️',
            link='/itinerary',
        )

    @classmethod
    def review_published(cls, user, hotel_name):
        return cls.create_for_user(
            user,
            title='Review Published',
            message=f'Your review for {hotel_name} has been published. Thank you for sharing your experience!',
            category='review', priority='normal', icon='⭐',
            link='/my-reviews',
        )


class OTP(models.Model):
    """OTP model for email verification and login"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='otp')
    otp_code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    attempts = models.IntegerField(default=0)
    is_used = models.BooleanField(default=False)
    purpose = models.CharField(
        max_length=20,
        choices=[
            ('signup', 'Sign Up'),
            ('login', 'Login'),
            ('password_reset', 'Password Reset'),
        ],
        default='signup'
    )
    
    def __str__(self):
        return f"OTP for {self.user.email} - {self.purpose}"
    
    def is_expired(self):
        """Check if OTP has expired"""
        return timezone.now() > self.expires_at
    
    def is_valid(self):
        """Check if OTP is valid (not expired, not used, attempts < 5)"""
        return not self.is_expired() and not self.is_used and self.attempts < 5
    
    def increment_attempts(self):
        """Increment failed attempts"""
        self.attempts += 1
        self.save()
    
    def mark_as_used(self):
        """Mark OTP as used"""
        self.is_used = True
        self.save()
    
    class Meta:
        ordering = ['-created_at']




