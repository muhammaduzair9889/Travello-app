import uuid
from decimal import Decimal

from django.db import models
from django.core.validators import MinValueValidator


class HotelScrapeRun(models.Model):
    class Status(models.TextChoices):
        SUCCESS = 'SUCCESS', 'SUCCESS'
        FAILED = 'FAILED', 'FAILED'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    city = models.CharField(max_length=120, db_index=True)
    dest_id = models.CharField(max_length=32, blank=True, null=True)
    dest_type = models.CharField(max_length=32, default='city')

    checkin = models.DateField(db_index=True)
    checkout = models.DateField(db_index=True)
    adults = models.PositiveIntegerField(default=2)
    rooms = models.PositiveIntegerField(default=1)
    children = models.PositiveIntegerField(default=0)

    source_url = models.URLField(max_length=1000)

    reported_count = models.PositiveIntegerField(blank=True, null=True)
    scraped_count = models.PositiveIntegerField(default=0)
    meta = models.JSONField(default=dict, blank=True)

    status = models.CharField(max_length=10, choices=Status.choices, default=Status.SUCCESS, db_index=True)
    error_message = models.TextField(blank=True)

    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = 'scraper_hotel_scrape_run'
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['city', 'checkin', 'checkout']),
            models.Index(fields=['status', 'started_at']),
        ]

    def __str__(self):
        return f"{self.city} {self.checkin}->{self.checkout} ({self.status})"


class ScrapedHotelResult(models.Model):
    run = models.ForeignKey(HotelScrapeRun, on_delete=models.CASCADE, related_name='hotels')

    hotel_uid = models.CharField(max_length=64, db_index=True)
    name = models.CharField(max_length=255, db_index=True)

    location_area = models.CharField(max_length=255, blank=True, null=True)
    location = models.TextField(blank=True, null=True)
    distance_from_center = models.CharField(max_length=255, blank=True, null=True)

    property_type = models.CharField(max_length=80, blank=True, null=True)
    room_type = models.CharField(max_length=255, blank=True, null=True)

    price_per_night = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        blank=True,
        null=True,
        validators=[MinValueValidator(Decimal('0.00'))],
    )
    total_stay_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        blank=True,
        null=True,
        validators=[MinValueValidator(Decimal('0.00'))],
    )

    review_rating = models.FloatField(blank=True, null=True)
    review_count = models.PositiveIntegerField(blank=True, null=True)

    availability_status = models.CharField(max_length=255, blank=True, null=True)
    image_url = models.URLField(max_length=1000, blank=True, null=True)
    booking_url = models.URLField(max_length=1000, blank=True, null=True)

    raw = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'scraper_scraped_hotel_result'
        unique_together = [('run', 'hotel_uid')]
        indexes = [
            models.Index(fields=['run', 'hotel_uid']),
            models.Index(fields=['run', 'name']),
        ]

    def __str__(self):
        return f"{self.name} ({self.run.city})"

