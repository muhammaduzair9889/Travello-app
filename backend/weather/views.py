from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.core.cache import cache
from .models import WeatherCache
from .serializers import WeatherSerializer
from .services import WeatherService
import logging

logger = logging.getLogger('weather')


class WeatherViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoints for weather data.

    Endpoints:
    - GET /api/weather/ - List all cached cities
    - GET /api/weather/{city}/ - Get weather for specific city
    - GET /api/weather/lahore/detailed/ - Get Lahore weather with details
    - POST /api/weather/refresh/ - Force refresh weather cache
    """
    queryset = WeatherCache.objects.all()
    serializer_class = WeatherSerializer
    permission_classes = [AllowAny]  # Weather is public info
    lookup_field = 'city'

    def get_queryset(self):
        """Filter by city if provided in query params."""
        queryset = WeatherCache.objects.all().order_by('-updated_at')
        city = self.request.query_params.get('city')
        if city:
            queryset = queryset.filter(city__icontains=city)
        return queryset

    @action(detail=False, methods=['get'], url_path='lahore')
    def get_lahore_weather(self, request):
        """Get current weather for Lahore."""
        try:
            weather_data = WeatherService.get_weather(city='Lahore', country_code='PK')
            if weather_data:
                # Get or create cache object for serialization
                try:
                    cache_obj = WeatherCache.objects.get(city='Lahore')
                except WeatherCache.DoesNotExist:
                    cache_obj = WeatherCache.objects.create(
                        city='Lahore',
                        temperature=weather_data['temperature'],
                        condition=weather_data['condition'],
                        humidity=weather_data['humidity'],
                        wind_speed=weather_data['wind_speed'],
                        icon_code=weather_data['icon_code'],
                    )

                serializer = self.get_serializer(cache_obj)
                return Response(serializer.data, status=status.HTTP_200_OK)
            else:
                return Response(
                    {'error': 'Failed to fetch weather data'},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE
                )
        except Exception as e:
            logger.error(f"Error in get_lahore_weather: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def refresh(self, request):
        """Force refresh weather cache for all cities or specific city."""
        city = request.query_params.get('city', 'Lahore')
        try:
            WeatherService.clear_cache(city)
            weather_data = WeatherService.get_weather(city=city, country_code='PK')
            if weather_data:
                return Response(
                    {'message': f'Weather cache refreshed for {city}', 'data': weather_data},
                    status=status.HTTP_200_OK
                )
            else:
                return Response(
                    {'error': f'Failed to fetch weather for {city}'},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE
                )
        except Exception as e:
            logger.error(f"Error in refresh: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def health(self, request):
        """Health check endpoint."""
        return Response({
            'status': 'ok',
            'message': 'Weather service is running',
            'cache_backend': 'redis' if 'redis' in str(cache.__class__) else 'locmem'
        })
