"""
URL Configuration for Scraper API
"""
from django.urls import path
from . import views

app_name = 'scraper'

urlpatterns = [
    path('scrape-hotels/', views.scrape_hotels, name='scrape-hotels'),
    path('destinations/', views.get_destinations, name='destinations'),
    path('test/', views.test_scraper, name='test'),
]
