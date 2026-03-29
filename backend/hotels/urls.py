from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    HotelViewSet, BookingViewSet, RealTimeHotelSearchView, 
    RoomAvailabilityView, BookingPreviewView, ScrapedHotelBookingView
)
from .recommendation_views import (
    DestinationRecommendationView,
    recommendation_start,
    recommendation_answer,
    recommendation_status,
    recommendation_results,
)

# Try importing ML views, but make them optional
ML_VIEWS_AVAILABLE = False
try:
    from .ml_views import MLRecommendationsView, SimilarItemsView, TrainingStatusView
    ML_VIEWS_AVAILABLE = True
except Exception as e:
    # ML views not available, continue without them
    ML_VIEWS_AVAILABLE = False

router = DefaultRouter()
router.register(r'hotels', HotelViewSet, basename='hotel')
router.register(r'bookings', BookingViewSet, basename='booking')

urlpatterns = [
    # ML recommendation endpoints (MUST come before router)
]

if ML_VIEWS_AVAILABLE:
    urlpatterns += [
        path('ml-recommendations/', MLRecommendationsView.as_view(), name='ml-recommendations'),
        path('similar-items/<int:item_id>/', SimilarItemsView.as_view(), name='similar-items'),
        path('ml-status/', TrainingStatusView.as_view(), name='ml-status'),
    ]

urlpatterns += [
    # Payment endpoints
    path('payments/', include('hotels.payment_urls')),
    
    # Custom endpoints (MUST come before router to avoid conflicts)
    path('hotels/search-live/', RealTimeHotelSearchView.as_view(), name='hotel-search-live'),
    path('hotels/check-availability/', RoomAvailabilityView.as_view(), name='check-availability'),
    path('bookings/preview/', BookingPreviewView.as_view(), name='booking-preview'),
    path('bookings/scraped/', ScrapedHotelBookingView.as_view(), name='scraped-hotel-booking'),
    
    # Recommendation engine endpoint (legacy — static knowledge)
    path('recommendations/', DestinationRecommendationView.as_view(), name='recommendations'),
    
    # AI Recommendation engine (conversational + real-time scraping)
    path('recommendations/start/', recommendation_start, name='recommendation-start'),
    path('recommendations/answer/', recommendation_answer, name='recommendation-answer'),
    path('recommendations/status/<str:session_id>/', recommendation_status, name='recommendation-status'),
    path('recommendations/results/<str:session_id>/', recommendation_results, name='recommendation-results'),
    
    # Router endpoints
    path('', include(router.urls)),
]