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
            'scraper': '/api/scraper/',
            'token': '/api/token/',
            'token_refresh': '/api/token/refresh/',
        }
    })


urlpatterns = [
    path('', api_root, name='api_root'),
    path('admin/', admin.site.urls),
    path('api/auth/', include('authentication.urls')),
    path('api/', include('hotels.urls')),
    path('api/scraper/', include('scraper.urls')),
    path('api/itineraries/', include('itineraries.urls')),
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]