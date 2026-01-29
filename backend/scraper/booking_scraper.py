"""
Booking.com Web Scraper
Handles scraping hotel data from Booking.com search results

IMPORTANT DISCLAIMERS:
- This scraper is for educational purposes only
- Always respect robots.txt and Terms of Service
- Implement rate limiting to avoid overloading servers
- Consider using official APIs instead of scraping
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional
from urllib.parse import urlencode

logger = logging.getLogger(__name__)


class BookingScraper:
    """
    Scraper for Booking.com hotel search results
    Uses Selenium with Chrome to handle JavaScript and bot protection
    Enhanced with proxy rotation and comprehensive data extraction
    """

    def __init__(self, use_proxy=False, proxy_list=None):
        self.base_url = "https://www.booking.com/searchresults.html"
        self.user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        self.use_proxy = use_proxy
        self.proxy_list = proxy_list or []
        self.current_proxy = None
        
    def get_next_proxy(self):
        """Get next proxy from rotation list"""
        if not self.proxy_list:
            return None
        import random
        self.current_proxy = random.choice(self.proxy_list)
        return self.current_proxy
        
    def build_search_url(self, params: Dict) -> str:
        """
        Build Booking.com search URL from parameters
        
        Parameters extracted from your example URL:
        - ss: Search string (city name)
        - dest_id: Destination ID (-2767043 for Lahore)
        - dest_type: Destination type (city, region, etc.)
        - checkin: Check-in date (YYYY-MM-DD)
        - checkout: Check-out date (YYYY-MM-DD)
        - group_adults: Number of adults
        - no_rooms: Number of rooms
        - group_children: Number of children
        """
        default_params = {
            'ss': params.get('city', 'Lahore'),
            'ssne': params.get('city', 'Lahore'),
            'ssne_untouched': params.get('city', 'Lahore'),
            'dest_id': params.get('dest_id', '-2767043'),  # Lahore's ID
            'dest_type': params.get('dest_type', 'city'),
            'checkin': params.get('checkin', '2026-02-02'),
            'checkout': params.get('checkout', '2026-02-07'),
            'group_adults': params.get('adults', 3),
            'no_rooms': params.get('rooms', 1),
            'group_children': params.get('children', 0),
            'lang': 'en-us',
            'sb': 1,
            'src_elem': 'sb',
            'src': 'index'
        }
        
        url = f"{self.base_url}?{urlencode(default_params)}"
        logger.info(f"Built search URL: {url}")
        return url

    async def scrape_hotels_selenium(self, search_params: Dict) -> List[Dict]:
        """
        Scrape hotels using Selenium WebDriver
        Better for handling JavaScript and bot protection
        """
        try:
            from selenium import webdriver
            from selenium.webdriver.chrome.options import Options
            from selenium.webdriver.common.by import By
            from selenium.webdriver.support.ui import WebDriverWait
            from selenium.webdriver.support import expected_conditions as EC
            from selenium.common.exceptions import TimeoutException
        except ImportError:
            logger.error("Selenium not installed. Run: pip install selenium")
            return []

        chrome_options = Options()
        chrome_options.add_argument('--headless')  # Run in background
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument(f'user-agent={self.user_agent}')
        chrome_options.add_argument('--disable-blink-features=AutomationControlled')
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        
        # Add proxy if enabled
        if self.use_proxy:
            proxy = self.get_next_proxy()
            if proxy:
                chrome_options.add_argument(f'--proxy-server={proxy}')
                logger.info(f"Using proxy: {proxy}")
        
        # Additional stealth options
        chrome_options.add_argument('--disable-gpu')
        chrome_options.add_argument('--window-size=1920,1080')
        chrome_options.add_argument('--disable-web-security')
        chrome_options.add_argument('--disable-features=IsolateOrigins,site-per-process')

        driver = None
        hotels = []
        
        try:
            url = self.build_search_url(search_params)
            driver = webdriver.Chrome(options=chrome_options)
            
            # Bypass automation detection
            driver.execute_cdp_cmd('Network.setUserAgentOverride', {
                "userAgent": self.user_agent
            })
            driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            
            logger.info(f"Loading URL: {url}")
            driver.get(url)
            
            # Wait for page to load (increase timeout for AWS WAF challenge)
            wait = WebDriverWait(driver, 30)
            
            # Wait for hotel listings to appear
            try:
                wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, '[data-testid="property-card"]')))
                logger.info("Hotel listings loaded successfully")
            except TimeoutException:
                logger.warning("Timeout waiting for hotel listings. Checking page content...")
                page_source = driver.page_source
                if "challenge" in page_source.lower() or "robot" in page_source.lower():
                    logger.error("AWS WAF challenge detected. Consider using Puppeteer with stealth plugin.")
                    return []
            
            # Give extra time for dynamic content
            await asyncio.sleep(3)
            
            # Extract hotel data
            hotel_elements = driver.find_elements(By.CSS_SELECTOR, '[data-testid="property-card"]')
            logger.info(f"Found {len(hotel_elements)} hotel listings")
            
            for idx, hotel_element in enumerate(hotel_elements):
                try:
                    hotel_data = self._extract_hotel_data(hotel_element, driver)
                    if hotel_data:
                        hotels.append(hotel_data)
                        logger.info(f"Extracted hotel {idx + 1}: {hotel_data.get('name', 'Unknown')}")
                except Exception as e:
                    logger.error(f"Error extracting hotel {idx + 1}: {str(e)}")
                    continue
                    
        except Exception as e:
            logger.error(f"Error during scraping: {str(e)}")
        finally:
            if driver:
                driver.quit()
                
        logger.info(f"Successfully scraped {len(hotels)} hotels")
        return hotels

    def _extract_hotel_data(self, hotel_element, driver) -> Optional[Dict]:
        """Extract data from a single hotel element"""
        from selenium.webdriver.common.by import By
        from selenium.common.exceptions import NoSuchElementException
        
        try:
            hotel_data = {
                'scraped_at': datetime.now().isoformat(),
                'source': 'booking.com'
            }
            
            # Hotel Name
            try:
                name_elem = hotel_element.find_element(By.CSS_SELECTOR, '[data-testid="title"]')
                hotel_data['name'] = name_elem.text.strip()
            except NoSuchElementException:
                hotel_data['name'] = None
            
            # Hotel Link
            try:
                link_elem = hotel_element.find_element(By.CSS_SELECTOR, 'a[data-testid="title-link"]')
                hotel_data['url'] = link_elem.get_attribute('href')
            except NoSuchElementException:
                hotel_data['url'] = None
            
            # Price
            try:
                price_elem = hotel_element.find_element(By.CSS_SELECTOR, '[data-testid="price-and-discounted-price"]')
                hotel_data['price'] = price_elem.text.strip()
            except NoSuchElementException:
                hotel_data['price'] = None
            
            # Rating Score
            try:
                rating_elem = hotel_element.find_element(By.CSS_SELECTOR, '[data-testid="review-score"] div')
                hotel_data['rating'] = rating_elem.text.strip()
            except NoSuchElementException:
                hotel_data['rating'] = None
            
            # Number of Reviews
            try:
                reviews_elem = hotel_element.find_element(By.CSS_SELECTOR, '[data-testid="review-score"] .d8eab2cf7f')
                hotel_data['review_count'] = reviews_elem.text.strip()
            except NoSuchElementException:
                hotel_data['review_count'] = None
            
            # Location/Address
            try:
                location_elem = hotel_element.find_element(By.CSS_SELECTOR, '[data-testid="address"]')
                hotel_data['location'] = location_elem.text.strip()
            except NoSuchElementException:
                hotel_data['location'] = None
            
            # Distance from center
            try:
                distance_elem = hotel_element.find_element(By.CSS_SELECTOR, '[data-testid="distance"]')
                hotel_data['distance'] = distance_elem.text.strip()
            except NoSuchElementException:
                hotel_data['distance'] = None
            
            # Amenities/Facilities
            try:
                amenities = []
                amenity_elems = hotel_element.find_elements(By.CSS_SELECTOR, '[data-testid="facility-badge"]')
                for amenity in amenity_elems:
                    amenities.append(amenity.text.strip())
                hotel_data['amenities'] = amenities
            except NoSuchElementException:
                hotel_data['amenities'] = []
            
            # Image URL
            try:
                img_elem = hotel_element.find_element(By.CSS_SELECTOR, 'img[data-testid="image"]')
                hotel_data['image_url'] = img_elem.get_attribute('src')
            except NoSuchElementException:
                hotel_data['image_url'] = None
            
            return hotel_data if hotel_data.get('name') else None
            
        except Exception as e:
            logger.error(f"Error extracting hotel data: {str(e)}")
            return None

    async def scrape_hotels_puppeteer(self, search_params: Dict) -> List[Dict]:
        """
        Alternative: Scrape using Puppeteer (Node.js required)
        Better at bypassing bot detection with puppeteer-extra-plugin-stealth
        
        This method requires:
        1. Node.js installed
        2. puppeteer and puppeteer-extra-plugin-stealth packages
        """
        # This would call a Node.js script
        # For now, returning empty - implement if needed
        logger.warning("Puppeteer scraping not yet implemented")
        return []

    def scrape_hotels_sync(self, search_params: Dict) -> List[Dict]:
        """Synchronous wrapper for async scraping"""
        return asyncio.run(self.scrape_hotels_selenium(search_params))


# Destination IDs for major Pakistani cities
PAKISTAN_DESTINATIONS = {
    'lahore': {
        'dest_id': '-2767043',
        'name': 'Lahore',
        'country': 'Pakistan'
    },
    'karachi': {
        'dest_id': '-2240905',
        'name': 'Karachi',
        'country': 'Pakistan'
    },
    'islamabad': {
        'dest_id': '-2290032',
        'name': 'Islamabad',
        'country': 'Pakistan'
    },
    'rawalpindi': {
        'dest_id': '-2290033',
        'name': 'Rawalpindi',
        'country': 'Pakistan'
    },
    'faisalabad': {
        'dest_id': '-2762268',
        'name': 'Faisalabad',
        'country': 'Pakistan'
    },
    'multan': {
        'dest_id': '-2240572',
        'name': 'Multan',
        'country': 'Pakistan'
    }
}
