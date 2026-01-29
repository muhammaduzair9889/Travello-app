"""
Booking.com Data Importer Service
Fetches hotel data from Booking.com API (DataCrawler) and stores in database
Optimized to fetch maximum data in minimum requests
"""

import requests
import logging
from django.conf import settings
from django.db import transaction
from hotels.models import Hotel
from decimal import Decimal
import time

logger = logging.getLogger(__name__)


class BookingDataImporter:
    """
    Service to import hotel data from Booking.com API (RapidAPI - DataCrawler)
    Optimized for bulk data import with minimal API calls
    """
    
    # Booking.com API Configuration (DataCrawler provider)
    API_BASE_URL = 'https://booking-com15.p.rapidapi.com/api/v1'
    API_HOST = 'booking-com15.p.rapidapi.com'
    
    def __init__(self, api_key=None):
        """Initialize with API key from settings or parameter"""
        self.api_key = api_key or getattr(settings, 'RAPIDAPI_KEY', None)
        if not self.api_key:
            raise ValueError("RAPIDAPI_KEY not configured in settings")
        
        self.headers = {
            'X-RapidAPI-Key': self.api_key,
            'X-RapidAPI-Host': self.API_HOST
        }
    
    def search_hotels_by_location(self, query='Lahore', max_results=100):
        """
        Search hotels by location and fetch detailed data
        
        Args:
            query (str): City or location name (default: 'Lahore')
            max_results (int): Maximum number of hotels to fetch
        
        Returns:
            list: Hotel data dictionaries ready for database insertion
        """
        logger.info(f"Starting hotel search for: {query}")
        
        try:
            # Step 1: Search for destination to get destination ID
            destination_id = self._get_destination_id(query)
            if not destination_id:
                logger.error(f"Could not find destination ID for {query}")
                return []
            
            logger.info(f"Found destination ID: {destination_id}")
            
            # Step 2: Search hotels at destination
            hotels = self._search_hotels(destination_id, max_results)
            
            if not hotels:
                logger.warning("No hotels found from API")
                return []
            
            logger.info(f"Successfully fetched {len(hotels)} hotels")
            return hotels
            
        except Exception as e:
            logger.error(f"Error in search_hotels_by_location: {str(e)}", exc_info=True)
            return []
    
    def _get_destination_id(self, query):
        """
        Get destination ID for a location query
        
        Args:
            query (str): Location search query
        
        Returns:
            str: Destination ID or None
        """
        try:
            # Search for location
            endpoint = f"{self.API_BASE_URL}/hotels/searchDestination"
            params = {'query': query}
            
            response = requests.get(
                endpoint,
                headers=self.headers,
                params=params,
                timeout=15
            )
            response.raise_for_status()
            data = response.json()
            
            # Extract destination ID from response
            if data.get('status') and data.get('data'):
                destinations = data['data']
                if destinations and len(destinations) > 0:
                    # Return the first destination's ID
                    dest = destinations[0]
                    return dest.get('dest_id')
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting destination ID: {str(e)}")
            return None
    
    def _search_hotels(self, destination_id, max_results=100):
        """
        Search hotels at a destination with comprehensive data
        
        Args:
            destination_id (str): Destination ID from Booking.com
            max_results (int): Maximum hotels to fetch
        
        Returns:
            list: Processed hotel data
        """
        try:
            endpoint = f"{self.API_BASE_URL}/hotels/searchHotels"
            
            # Set search parameters for comprehensive results
            params = {
                'dest_id': destination_id,
                'search_type': 'CITY',
                'arrival_date': '2025-12-15',  # Future date for availability
                'departure_date': '2025-12-17',
                'adults': '2',
                'children_age': '0',
                'room_qty': '1',
                'page_number': '1',
                'units': 'metric',
                'temperature_unit': 'c',
                'languagecode': 'en-us',
                'currency_code': 'PKR'
            }
            
            all_hotels = []
            pages_to_fetch = (max_results // 25) + 1  # Assuming ~25 hotels per page
            
            for page in range(1, min(pages_to_fetch, 10) + 1):  # Max 10 pages = 250 hotels
                try:
                    params['page_number'] = str(page)
                    logger.info(f"Fetching page {page}...")
                    
                    response = requests.get(
                        endpoint,
                        headers=self.headers,
                        params=params,
                        timeout=20
                    )
                    response.raise_for_status()
                    data = response.json()
                    
                    # Process hotels from this page
                    if data.get('status') and data.get('data'):
                        hotels_data = data['data'].get('hotels', [])
                        
                        if not hotels_data:
                            logger.info(f"No hotels on page {page}, stopping")
                            break
                        
                        # Process each hotel
                        for hotel_raw in hotels_data:
                            processed_hotel = self._process_hotel_data(hotel_raw)
                            if processed_hotel:
                                all_hotels.append(processed_hotel)
                        
                        logger.info(f"Page {page}: Processed {len(hotels_data)} hotels (Total: {len(all_hotels)})")
                        
                        # Stop if we've reached max_results
                        if len(all_hotels) >= max_results:
                            logger.info(f"Reached target of {max_results} hotels")
                            break
                    else:
                        logger.warning(f"No data in response for page {page}")
                        break
                    
                    # Rate limiting - pause between requests
                    if page < pages_to_fetch:
                        time.sleep(1.5)
                
                except requests.exceptions.HTTPError as http_err:
                    if http_err.response.status_code == 429:
                        logger.warning(f"Rate limit hit on page {page}")
                        break
                    logger.warning(f"HTTP error on page {page}: {str(http_err)}")
                    break
                except Exception as page_error:
                    logger.warning(f"Error on page {page}: {str(page_error)}")
                    continue
            
            return all_hotels[:max_results]  # Trim to exact max_results
            
        except Exception as e:
            logger.error(f"Error searching hotels: {str(e)}", exc_info=True)
            return []
    
    def _process_hotel_data(self, raw_hotel):
        """
        Process raw hotel data from API into database format
        
        Args:
            raw_hotel (dict): Raw hotel data from Booking.com API
        
        Returns:
            dict: Processed hotel data or None if invalid
        """
        try:
            # Extract essential fields
            hotel_name = raw_hotel.get('property', {}).get('name') or raw_hotel.get('hotel_name')
            if not hotel_name:
                return None
            
            # Extract location data
            address = raw_hotel.get('property', {}).get('address', '')
            city_name = raw_hotel.get('property', {}).get('city', 'Lahore')
            
            # Extract pricing
            price_breakdown = raw_hotel.get('property', {}).get('priceBreakdown', {})
            gross_price = price_breakdown.get('grossPrice', {})
            price_value = gross_price.get('value', 0)
            
            # If no price from priceBreakdown, try other fields
            if not price_value:
                price_value = raw_hotel.get('min_total_price', 0) or raw_hotel.get('composite_price_breakdown', {}).get('gross_amount_per_night', {}).get('value', 0)
            
            # Convert to per-night price (assuming 2 nights in search)
            base_price = float(price_value) / 2 if price_value else 5000
            
            # Extract rating
            review_score = raw_hotel.get('property', {}).get('reviewScore', 0)
            if not review_score:
                review_score = raw_hotel.get('review_score', 0) or 7.5
            
            # Extract amenities
            checkin = raw_hotel.get('property', {}).get('checkinCheckoutTimes', {})
            amenities = raw_hotel.get('property', {}).get('amenities', [])
            
            wifi_available = any('wifi' in str(amenity).lower() or 'internet' in str(amenity).lower() for amenity in amenities)
            parking_available = any('parking' in str(amenity).lower() for amenity in amenities)
            
            # Extract image
            photo_urls = raw_hotel.get('property', {}).get('photoUrls', [])
            image_url = photo_urls[0] if photo_urls else raw_hotel.get('main_photo_url', '')
            
            # Build description
            review_score_word = raw_hotel.get('property', {}).get('reviewScoreWord', 'Good')
            review_count = raw_hotel.get('property', {}).get('reviewCount', 0)
            
            description = f"{hotel_name} in {city_name}. "
            if review_count:
                description += f"Rated {review_score_word} with {review_count} reviews. "
            if amenities:
                description += f"Amenities: {', '.join(str(a) for a in amenities[:5])}."
            
            # Calculate room counts (estimated)
            total_rooms = raw_hotel.get('property', {}).get('roomCount', 50)
            available_rooms = int(total_rooms * 0.7)  # Assume 70% availability
            
            # Create hotel data dictionary
            hotel_data = {
                'hotel_name': hotel_name[:255],
                'city': city_name[:100],
                'location': address[:255] if address else f"{city_name}, Pakistan",
                'total_rooms': total_rooms,
                'available_rooms': available_rooms,
                'single_bed_price_per_day': Decimal(str(base_price * 0.7)).quantize(Decimal('0.01')),
                'family_room_price_per_day': Decimal(str(base_price * 1.5)).quantize(Decimal('0.01')),
                'wifi_available': wifi_available,
                'parking_available': parking_available,
                'description': description[:500],
                'image': image_url[:500] if image_url else '',
                'rating': float(review_score) if review_score else 7.5
            }
            
            return hotel_data
            
        except Exception as e:
            logger.warning(f"Error processing hotel data: {str(e)}")
            return None
    
    def import_to_database(self, hotels_data, replace_existing=False):
        """
        Import hotel data into database
        
        Args:
            hotels_data (list): List of hotel dictionaries
            replace_existing (bool): If True, clear existing hotels first
        
        Returns:
            dict: Import statistics
        """
        stats = {
            'total': len(hotels_data),
            'created': 0,
            'updated': 0,
            'failed': 0,
            'errors': []
        }
        
        if not hotels_data:
            logger.warning("No hotel data to import")
            return stats
        
        try:
            with transaction.atomic():
                # Optionally clear existing data
                if replace_existing:
                    deleted_count = Hotel.objects.all().delete()[0]
                    logger.info(f"Deleted {deleted_count} existing hotels")
                
                # Import hotels
                for idx, hotel_data in enumerate(hotels_data, 1):
                    try:
                        # Check if hotel exists by name and city
                        existing_hotel = Hotel.objects.filter(
                            hotel_name=hotel_data['hotel_name'],
                            city=hotel_data['city']
                        ).first()
                        
                        if existing_hotel:
                            # Update existing hotel
                            for key, value in hotel_data.items():
                                setattr(existing_hotel, key, value)
                            existing_hotel.save()
                            stats['updated'] += 1
                            logger.debug(f"Updated: {hotel_data['hotel_name']}")
                        else:
                            # Create new hotel
                            Hotel.objects.create(**hotel_data)
                            stats['created'] += 1
                            logger.debug(f"Created: {hotel_data['hotel_name']}")
                        
                        # Log progress every 10 hotels
                        if idx % 10 == 0:
                            logger.info(f"Progress: {idx}/{len(hotels_data)} hotels processed")
                    
                    except Exception as e:
                        stats['failed'] += 1
                        error_msg = f"Failed to import {hotel_data.get('hotel_name', 'Unknown')}: {str(e)}"
                        stats['errors'].append(error_msg)
                        logger.error(error_msg)
                
                logger.info(f"Import completed: {stats['created']} created, {stats['updated']} updated, {stats['failed']} failed")
        
        except Exception as e:
            logger.error(f"Database transaction failed: {str(e)}", exc_info=True)
            stats['errors'].append(f"Transaction error: {str(e)}")
        
        return stats
    
    def run_full_import(self, location='Lahore', max_hotels=100, replace_existing=False):
        """
        Run complete import process: fetch from API and store in database
        
        Args:
            location (str): Location to search hotels
            max_hotels (int): Maximum hotels to import
            replace_existing (bool): Replace existing hotel data
        
        Returns:
            dict: Complete import statistics
        """
        logger.info(f"Starting full import for {location}, max {max_hotels} hotels")
        
        result = {
            'success': False,
            'location': location,
            'max_hotels': max_hotels,
            'api_stats': {},
            'db_stats': {},
            'errors': []
        }
        
        try:
            # Fetch from API
            hotels_data = self.search_hotels_by_location(location, max_hotels)
            result['api_stats'] = {
                'fetched': len(hotels_data)
            }
            
            if not hotels_data:
                result['errors'].append("No hotels fetched from API")
                logger.error("Failed to fetch hotels from API")
                return result
            
            # Import to database
            db_stats = self.import_to_database(hotels_data, replace_existing)
            result['db_stats'] = db_stats
            
            # Set success status
            if db_stats['created'] > 0 or db_stats['updated'] > 0:
                result['success'] = True
            
            logger.info(f"Full import completed successfully: {db_stats}")
            
        except Exception as e:
            error_msg = f"Full import failed: {str(e)}"
            result['errors'].append(error_msg)
            logger.error(error_msg, exc_info=True)
        
        return result


# Convenience function for quick imports
def quick_import(location='Lahore', max_hotels=100, replace_existing=False):
    """
    Quick import function for easy usage
    
    Usage:
        from hotels.booking_data_importer import quick_import
        result = quick_import('Lahore', max_hotels=50)
    """
    importer = BookingDataImporter()
    return importer.run_full_import(location, max_hotels, replace_existing)
