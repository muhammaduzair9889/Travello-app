from django.urls import path

from . import views

app_name = 'itineraries'

urlpatterns = [
    path('places/', views.PlaceListView.as_view(), name='places'),
    path('moods/', views.MoodListView.as_view(), name='moods'),
    path('generate/', views.ItineraryGenerateView.as_view(), name='generate'),
    path('', views.ItineraryListView.as_view(), name='list'),
    path('<int:itinerary_id>/', views.ItineraryDetailView.as_view(), name='detail'),
    path('<int:itinerary_id>/regenerate-day/', views.ItineraryRegenerateDayView.as_view(), name='regenerate-day'),
    path('<int:itinerary_id>/regenerate-full/', views.ItineraryRegenerateFullView.as_view(), name='regenerate-full'),
    path('<int:itinerary_id>/replace-place/', views.ItineraryReplacePlaceView.as_view(), name='replace-place'),
    path('<int:itinerary_id>/remove-place/', views.ItineraryRemovePlaceView.as_view(), name='remove-place'),
    path('<int:itinerary_id>/lock-place/', views.ItineraryLockPlaceView.as_view(), name='lock-place'),
    path('<int:itinerary_id>/reorder/', views.ItineraryReorderView.as_view(), name='reorder'),
]
