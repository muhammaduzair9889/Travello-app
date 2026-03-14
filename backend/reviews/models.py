import uuid
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
from authentication.models import User
from hotels.models import Hotel, Booking


class Review(models.Model):
    """Main review model - one review per completed booking."""
    STATUS_CHOICES = [
        ('published', 'Published'),
        ('draft', 'Draft'),
        ('flagged', 'Flagged'),
        ('removed', 'Removed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reviews')
    hotel = models.ForeignKey(Hotel, on_delete=models.CASCADE, related_name='reviews')
    booking = models.OneToOneField(Booking, on_delete=models.CASCADE, related_name='review')

    # Overall rating 1-5
    overall_rating = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )

    # Aspect ratings 1-5, optional
    cleanliness_rating = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)], null=True, blank=True
    )
    service_rating = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)], null=True, blank=True
    )
    location_rating = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)], null=True, blank=True
    )
    value_rating = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)], null=True, blank=True
    )
    amenities_rating = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)], null=True, blank=True
    )

    # Review text
    title = models.CharField(max_length=200)
    content = models.TextField(max_length=5000)

    # Trip context
    TRIP_TYPE_CHOICES = [
        ('business', 'Business'),
        ('couple', 'Couple'),
        ('family', 'Family'),
        ('friends', 'Friends'),
        ('solo', 'Solo'),
    ]
    trip_type = models.CharField(max_length=20, choices=TRIP_TYPE_CHOICES, blank=True)

    # Sentiment (computed by backend service)
    SENTIMENT_CHOICES = [
        ('positive', 'Positive'),
        ('neutral', 'Neutral'),
        ('negative', 'Negative'),
    ]
    sentiment = models.CharField(max_length=10, choices=SENTIMENT_CHOICES, blank=True)
    sentiment_score = models.FloatField(null=True, blank=True)

    # Status & moderation
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default='published')
    is_verified_stay = models.BooleanField(default=True)

    # Counters
    helpful_count = models.PositiveIntegerField(default=0)
    report_count = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['hotel', '-created_at']),
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['status']),
            models.Index(fields=['overall_rating']),
        ]

    def __str__(self):
        return f"Review by {self.user.email} for {self.hotel.name} ({self.overall_rating}★)"

    @property
    def aspect_average(self):
        """Average of all non-null aspect ratings."""
        aspects = [
            self.cleanliness_rating, self.service_rating,
            self.location_rating, self.value_rating, self.amenities_rating,
        ]
        filled = [a for a in aspects if a is not None]
        return round(sum(filled) / len(filled), 1) if filled else None


class ReviewPhoto(models.Model):
    """Photos attached to a review."""
    review = models.ForeignKey(Review, on_delete=models.CASCADE, related_name='photos')
    image_url = models.URLField(max_length=500)
    caption = models.CharField(max_length=200, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['uploaded_at']

    def __str__(self):
        return f"Photo for review {self.review_id}"


class ReviewHelpful(models.Model):
    """Track which users found a review helpful (one vote per user per review)."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='helpful_votes')
    review = models.ForeignKey(Review, on_delete=models.CASCADE, related_name='helpful_votes')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['user', 'review']

    def __str__(self):
        return f"{self.user.email} → helpful on {self.review_id}"


class ReviewReply(models.Model):
    """Staff / hotel manager replies to reviews."""
    review = models.ForeignKey(Review, on_delete=models.CASCADE, related_name='replies')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='review_replies')
    content = models.TextField(max_length=2000)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Reply by {self.user.email} on review {self.review_id}"
