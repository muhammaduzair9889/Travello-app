from django.test import TestCase
from django.core.cache import cache
from .services import WeatherService
from .models import WeatherCache


class WeatherServiceTestCase(TestCase):
    """Test cases for Weather Service"""

    def setUp(self):
        """Clear cache before each test"""
        cache.clear()

    def test_weather_cache_model(self):
        """Test WeatherCache model creation"""
        weather = WeatherCache.objects.create(
            city='Lahore',
            temperature=28.5,
            condition='Sunny',
            humidity=65,
            wind_speed=12.3,
            icon_code='01d'
        )
        self.assertEqual(weather.city, 'Lahore')
        self.assertEqual(weather.temperature, 28.5)
        self.assertTrue(weather.is_fresh(minutes=10))

    def test_weather_cache_fresh(self):
        """Test fresh cache detection"""
        weather = WeatherCache.objects.create(
            city='Lahore',
            temperature=28.5,
            condition='Sunny',
            humidity=65,
            wind_speed=12.3,
            icon_code='01d'
        )
        # Newly created cache should be fresh
        self.assertTrue(weather.is_fresh(minutes=10))
        self.assertTrue(weather.is_fresh(minutes=1))

