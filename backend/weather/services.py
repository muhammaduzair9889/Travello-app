"""
Weather service layer for fetching and caching weather data.
Uses OpenWeatherMap API with local caching.
"""
import logging
import requests
from django.core.cache import cache
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
from .models import WeatherCache

logger = logging.getLogger('weather')

# OpenWeatherMap API endpoint
OPENWEATHER_API_URL = "https://api.openweathermap.org/data/2.5/weather"
CACHE_TIMEOUT_MINUTES = 10
CACHE_TIMEOUT_SECONDS = CACHE_TIMEOUT_MINUTES * 60


class WeatherService:
    """Service for fetching and caching weather data."""

    @staticmethod
    def get_weather(city='Lahore', country_code='PK'):
        """
        Get weather for a city.
        Uses cache first (10 min), then external API.

        Args:
            city: City name
            country_code: ISO country code

        Returns:
            dict: Weather data or None if failed
        """
        cache_key = f"weather_{city.lower()}_{country_code.lower()}"

        # Check memory cache first (fastest)
        cached_data = cache.get(cache_key)
        if cached_data:
            logger.info(f"Cache hit for {city} (memory cache)")
            return cached_data

        # Check database cache (still fast, persists across restarts)
        try:
            db_cache = WeatherCache.objects.get(city__iexact=city)
            if db_cache.is_fresh(minutes=CACHE_TIMEOUT_MINUTES):
                logger.info(f"Cache hit for {city} (database cache)")
                cache.set(cache_key, WeatherService._format_weather_data(db_cache), CACHE_TIMEOUT_SECONDS)
                return WeatherService._format_weather_data(db_cache)
        except WeatherCache.DoesNotExist:
            pass

        # Fetch from external API
        try:
            logger.info(f"Fetching weather for {city} from OpenWeatherMap API")
            weather_data = WeatherService._fetch_from_api(city, country_code)

            if weather_data:
                # Update database cache
                WeatherService._update_db_cache(city, weather_data)
                # Update memory cache
                cache.set(cache_key, weather_data, CACHE_TIMEOUT_SECONDS)
                return weather_data
        except Exception as e:
            logger.error(f"Error fetching weather: {str(e)}")
            # Fall back to stale database cache if available
            try:
                db_cache = WeatherCache.objects.get(city__iexact=city)
                logger.warning(f"Using stale cache for {city} (API failed)")
                return WeatherService._format_weather_data(db_cache)
            except WeatherCache.DoesNotExist:
                return None

        return None

    @staticmethod
    def _fetch_from_api(city, country_code):
        """Fetch weather from OpenWeatherMap API."""
        api_key = settings.OPENWEATHER_API_KEY
        if not api_key:
            logger.error("OPENWEATHER_API_KEY not configured")
            return None

        try:
            params = {
                'q': f"{city},{country_code}",
                'appid': api_key,
                'units': 'metric'  # Celsius
            }

            response = requests.get(
                OPENWEATHER_API_URL,
                params=params,
                timeout=5
            )
            response.raise_for_status()

            data = response.json()
            return {
                'city': data['name'],
                'temperature': data['main']['temp'],
                'condition': data['weather'][0]['main'],
                'description': data['weather'][0]['description'],
                'humidity': data['main']['humidity'],
                'wind_speed': data['wind']['speed'],
                'icon_code': data['weather'][0]['icon'],
                'country': data['sys']['country'],
                'timestamp': timezone.now().isoformat()
            }
        except Exception as e:
            logger.error(f"API request failed: {str(e)}")
            return None

    @staticmethod
    def _update_db_cache(city, weather_data):
        """Update or create database cache entry."""
        try:
            db_cache, created = WeatherCache.objects.update_or_create(
                city=city,
                defaults={
                    'temperature': weather_data['temperature'],
                    'condition': weather_data['condition'],
                    'humidity': weather_data['humidity'],
                    'wind_speed': weather_data['wind_speed'],
                    'icon_code': weather_data['icon_code'],
                }
            )
            action = "Created" if created else "Updated"
            logger.info(f"{action} database cache for {city}")
        except Exception as e:
            logger.error(f"Failed to update database cache: {str(e)}")

    @staticmethod
    def _format_weather_data(db_cache):
        """Format database cache object to API response format."""
        return {
            'city': db_cache.city,
            'temperature': db_cache.temperature,
            'condition': db_cache.condition,
            'humidity': db_cache.humidity,
            'wind_speed': db_cache.wind_speed,
            'icon_code': db_cache.icon_code,
            'timestamp': db_cache.updated_at.isoformat()
        }

    @staticmethod
    def clear_cache(city='Lahore'):
        """Clear cache for a specific city."""
        cache_key = f"weather_{city.lower()}_pk"
        cache.delete(cache_key)
        logger.info(f"Cache cleared for {city}")
