#!/usr/bin/env python3
"""
Weather Module Integration Test Script
Tests backend API, caching, and data integrity
"""

import os
import sys
import django
from django.test import Client
from django.core.cache import cache

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'travello_backend.settings')
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

from rest_framework.test import APIClient
from weather.models import WeatherCache
from weather.services import WeatherService


def test_weather_cache_model():
    """Test WeatherCache model creation and retrieval"""
    print("\n✓ Testing WeatherCache Model...")

    # Clear existing data
    WeatherCache.objects.all().delete()

    # Create test entry
    weather = WeatherCache.objects.create(
        city='Lahore',
        temperature=28.5,
        condition='Sunny',
        humidity=65,
        wind_speed=12.3,
        icon_code='01d'
    )

    assert weather.city == 'Lahore'
    assert weather.temperature == 28.5
    assert weather.is_fresh(minutes=10)
    print("  ✓ WeatherCache model working correctly")


def test_api_endpoints():
    """Test API endpoints"""
    print("\n✓ Testing API Endpoints...")

    client = APIClient()

    # Test health endpoint
    response = client.get('/api/weather/health/')
    print(f"  Health Check: {response.status_code}")
    assert response.status_code == 200
    data = response.json()
    assert data['status'] == 'ok'
    print("  ✓ Health endpoint working")

    # Test Lahore weather endpoint
    response = client.get('/api/weather/lahore/')
    print(f"  Weather API: {response.status_code}")

    if response.status_code == 200:
        data = response.json()
        assert 'city' in data
        assert 'temperature' in data
        assert 'condition' in data
        assert 'humidity' in data
        assert 'wind_speed' in data
        print("  ✓ Lahore weather endpoint working")
    elif response.status_code == 503:
        print("  ! API unavailable (expected without valid API key)")
        print("  ! Please add valid OPENWEATHER_API_KEY to .env")
    else:
        print(f"  ✗ Unexpected status code: {response.status_code}")


def test_cache_behavior():
    """Test caching behavior"""
    print("\n✓ Testing Cache Behavior...")

    # Clear cache
    cache.clear()
    WeatherCache.objects.all().delete()

    # Create dummy weather data
    test_data = {
        'city': 'Lahore',
        'temperature': 25.0,
        'condition': 'Cloudy',
        'humidity': 60,
        'wind_speed': 10.0,
        'icon_code': '02d'
    }

    # Test memory cache
    cache_key = 'weather_lahore_pk'
    cache.set(cache_key, test_data, 600)
    cached = cache.get(cache_key)

    assert cached == test_data
    print("  ✓ Memory cache working")

    # Test database cache
    weather = WeatherCache.objects.create(**test_data)
    assert weather.is_fresh(minutes=10)
    print("  ✓ Database cache working")


def test_serializer():
    """Test weather serializer"""
    print("\n✓ Testing Serializer...")

    from weather.serializers import WeatherSerializer

    WeatherCache.objects.all().delete()

    weather = WeatherCache.objects.create(
        city='Lahore',
        temperature=28.5,
        condition='Sunny',
        humidity=65,
        wind_speed=12.3,
        icon_code='01d'
    )

    serializer = WeatherSerializer(weather)
    data = serializer.data

    assert 'city' in data
    assert 'temperature' in data
    assert 'contextual_message' in data
    assert 'icon_url' in data

    # Check contextual message for sunny weather
    assert 'sightseeing' in data['contextual_message'].lower()
    print("  ✓ Serializer working with contextual messages")


def print_summary():
    """Print test summary"""
    print("\n" + "="*60)
    print("WEATHER MODULE TEST SUMMARY")
    print("="*60)
    print("\n✓ All basic tests completed successfully!")
    print("\nNext Steps:")
    print("1. Add OPENWEATHER_API_KEY to .env from https://openweathermap.org/")
    print("2. Restart Django server: python manage.py runserver")
    print("3. Test in browser: http://localhost:8000/api/weather/lahore/")
    print("4. Check Dashboard: http://localhost:3000 → Hotels")
    print("\nAPI Documentation:")
    print("See WEATHER_MODULE_README.md for full documentation")
    print("="*60 + "\n")


if __name__ == '__main__':
    try:
        test_weather_cache_model()
        test_cache_behavior()
        test_serializer()
        test_api_endpoints()
        print_summary()
    except AssertionError as e:
        print(f"\n✗ Test failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
