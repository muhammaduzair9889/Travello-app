from django.db import models
from django.utils import timezone


class WeatherCache(models.Model):
    """
    Cache weather data for cities to minimize external API calls.
    """
    city = models.CharField(max_length=100, unique=True, db_index=True)
    temperature = models.FloatField()
    condition = models.CharField(max_length=100)
    humidity = models.IntegerField()
    wind_speed = models.FloatField()
    icon_code = models.CharField(max_length=10)
    last_updated = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Weather Cache"
        verbose_name_plural = "Weather Caches"
        indexes = [
            models.Index(fields=['city', '-updated_at']),
        ]

    def __str__(self):
        return f"{self.city} - {self.temperature}°C ({self.condition})"

    def is_fresh(self, minutes=10):
        """Check if cached data is fresh (within specified minutes)."""
        time_diff = timezone.now() - self.updated_at
        return time_diff.total_seconds() < (minutes * 60)
