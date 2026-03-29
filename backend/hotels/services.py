"""
Hotel Service Layer - Puppeteer Scraper Only
RapidAPI has been removed. All real-time data comes from the Puppeteer scraper
running in backend/scraper/puppeteer_scraper.js
"""

import logging

logger = logging.getLogger(__name__)


class HotelAPIService:
    """
    Stub service class - retained for backward compatibility.
    Real-time hotel search now goes through the Puppeteer scraper endpoint
    at /api/scraper/scrape-hotels/ (see scraper/views.py).
    """

    def search_lahore_hotels(self, **kwargs):
        logger.warning(
            "HotelAPIService.search_lahore_hotels() called - "
            "this is deprecated. Use /api/scraper/scrape-hotels/ endpoint instead."
        )
        return []


# Singleton kept for any stale imports
hotel_api_service = HotelAPIService()
