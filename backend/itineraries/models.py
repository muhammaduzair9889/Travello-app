from django.conf import settings
from django.db import models


class Place(models.Model):
    class Budget(models.TextChoices):
        LOW = 'LOW', 'Low'
        MEDIUM = 'MEDIUM', 'Medium'
        LUXURY = 'LUXURY', 'Luxury'

    city = models.CharField(max_length=120, db_index=True, default='Lahore')
    name = models.CharField(max_length=255, db_index=True)
    category = models.CharField(max_length=80, db_index=True)
    tags = models.JSONField(default=list, blank=True)

    estimated_visit_minutes = models.PositiveIntegerField(default=90)
    budget_level = models.CharField(max_length=10, choices=Budget.choices, default=Budget.LOW, db_index=True)

    latitude = models.FloatField()
    longitude = models.FloatField()
    average_rating = models.FloatField(default=0.0)

    # 24h clock, local time
    ideal_start_hour = models.PositiveIntegerField(default=9)
    ideal_end_hour = models.PositiveIntegerField(default=18)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'itineraries_place'
        unique_together = [('city', 'name')]
        ordering = ['city', 'category', 'name']
        indexes = [
            models.Index(fields=['city', 'category']),
            models.Index(fields=['city', 'budget_level']),
        ]

    def __str__(self):
        return f"{self.name} ({self.city})"


class Itinerary(models.Model):
    class Budget(models.TextChoices):
        LOW = 'LOW', 'Low'
        MEDIUM = 'MEDIUM', 'Medium'
        LUXURY = 'LUXURY', 'Luxury'

    class Pace(models.TextChoices):
        RELAXED = 'RELAXED', 'Relaxed'
        BALANCED = 'BALANCED', 'Balanced'
        PACKED = 'PACKED', 'Packed'

    class Mood(models.TextChoices):
        RELAXING = 'RELAXING', 'Relaxing'
        SPIRITUAL = 'SPIRITUAL', 'Spiritual'
        HISTORICAL = 'HISTORICAL', 'Historical'
        FOODIE = 'FOODIE', 'Foodie'
        FUN = 'FUN', 'Fun & Entertainment'
        SHOPPING = 'SHOPPING', 'Shopping'
        NATURE = 'NATURE', 'Nature'
        ROMANTIC = 'ROMANTIC', 'Romantic'
        FAMILY = 'FAMILY', 'Family'

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='itineraries')
    city = models.CharField(max_length=120, db_index=True, default='Lahore')

    start_date = models.DateField(db_index=True)
    end_date = models.DateField(db_index=True)
    travelers = models.PositiveIntegerField(default=1)

    budget_level = models.CharField(max_length=10, choices=Budget.choices, default=Budget.MEDIUM)
    interests = models.JSONField(default=list, blank=True)
    pace = models.CharField(max_length=10, choices=Pace.choices, default=Pace.BALANCED)
    mood = models.CharField(max_length=12, choices=Mood.choices, blank=True, default='', help_text='Primary mood for trip')

    # Stored structure:
    # [
    #   { "date": "YYYY-MM-DD", "title": "...", "items": [ {place...}, ... ] }
    # ]
    days = models.JSONField(default=list, blank=True)

    # Customization
    locked_place_ids = models.JSONField(default=list, blank=True, help_text='Place IDs locked by user (survive regeneration)')
    excluded_place_ids = models.JSONField(default=list, blank=True, help_text='Place IDs excluded from regeneration (history)')

    saved = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'itineraries_itinerary'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['user', 'city', 'start_date']),
        ]

    def __str__(self):
        return f"Itinerary {self.city} {self.start_date}->{self.end_date} ({self.user_id})"


class JournalEntry(models.Model):
    """
    Travel journal for notes and photos during the trip.
    """
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='journal_entries')
    itinerary = models.ForeignKey(Itinerary, on_delete=models.CASCADE, related_name='journal_entries', null=True, blank=True)
    
    title = models.CharField(max_length=255)
    content = models.TextField()
    date = models.DateField(auto_now_add=True)
    
    # Store photo URLs as JSON list for simplicity
    photos = models.JSONField(default=list, blank=True)
    
    # Optional category or tag
    category = models.CharField(max_length=50, blank=True, default='General')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'itineraries_journalentry'
        ordering = ['-date', '-created_at']
        indexes = [
            models.Index(fields=['user', 'date']),
            models.Index(fields=['itinerary']),
        ]

    def __str__(self):
        return f"Journal: {self.title} ({self.date})"

