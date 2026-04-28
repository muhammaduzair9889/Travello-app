"""
URL configuration for travello_backend project.
"""
from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)


def health_check(request):
    """Unauthenticated health-check for Docker / load-balancers."""
    return JsonResponse({'status': 'ok'})


def api_root(request):
    """Root endpoint for API"""
    return JsonResponse({
        'message': 'Welcome to Travello API',
        'version': '1.0',
        'endpoints': {
            'admin': '/admin/',
            'auth': '/api/auth/',
            'hotels': '/api/hotels/',
            'bookings': '/api/bookings/',
            'reviews': '/api/reviews/',
            'weather': '/api/weather/',
            'scraper': '/api/scraper/',
            'token': '/api/token/',
            'token_refresh': '/api/token/refresh/',
        }
    })


urlpatterns = [
    path('', api_root, name='api_root'),
    path('health/', health_check, name='health_check'),
    path('admin/', admin.site.urls),
    path('api/auth/', include('authentication.urls')),
    path('api/', include('hotels.urls')),
    path('api/weather/', include('weather.urls')),
    path('api/scraper/', include('scraper.urls')),
    path('api/itineraries/', include('itineraries.urls')),
    path('api/reviews/', include('reviews.urls')),
    path('api/safety/', include('safety.urls')),
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]