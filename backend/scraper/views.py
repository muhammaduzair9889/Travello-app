"""
Django Views for Web Scraping API - Real-Time Only
"""
import logging
import subprocess
import os
import json
import hashlib
from decimal import Decimal, InvalidOperation
from urllib.parse import urlencode
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.core.cache import cache
from django.views.decorators.csrf import csrf_exempt
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_date

from .booking_scraper import BookingScraper, PAKISTAN_DESTINATIONS
from .models import HotelScrapeRun, ScrapedHotelResult

logger = logging.getLogger(__name__)


@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def scrape_hotels(request):
    """
    Scrape hotels from Booking.com - REAL-TIME DATA ONLY
    
    POST /api/scraper/scrape-hotels/
    
    Request Body:
    {
        "city": "Lahore",
        "dest_id": "-2767043",
        "checkin": "2026-02-02",
        "checkout": "2026-02-07",
        "adults": 2,
        "rooms": 1,
        "children": 0,
        "use_cache": true
    }
    """
    try:
        logger.info(f"Received scrape request: {request.data}")
        
        # Extract search parameters
        search_params = {
            'city': request.data.get('city', 'Lahore'),
            'dest_id': request.data.get('dest_id'),
            'dest_type': request.data.get('dest_type', 'city'),
            'checkin': request.data.get('checkin'),
            'checkout': request.data.get('checkout'),
            'adults': request.data.get('adults', 2),
            'rooms': request.data.get('rooms', 1),
            'children': request.data.get('children', 0),
            # Allow caller to control sort order, defaulting to price like the shared URL
            # (examples: "price", "popularity", "review_score_and_price", etc.)
            'order': request.data.get('order', 'price'),
        }

        # Basic validation (dates are required for price_per_night / total_stay_price)
        checkin_date = parse_date(search_params.get('checkin') or '')
        checkout_date = parse_date(search_params.get('checkout') or '')
        if not checkin_date or not checkout_date:
            return Response(
                {
                    'success': False,
                    'error': 'checkin and checkout are required (YYYY-MM-DD)',
                    'hotels': [],
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        if checkout_date <= checkin_date:
            return Response(
                {
                    'success': False,
                    'error': 'checkout must be after checkin',
                    'hotels': [],
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        # Auto-detect destination ID for Pakistani cities
        city_lower = search_params['city'].lower()
        if not search_params['dest_id'] and city_lower in PAKISTAN_DESTINATIONS:
            search_params['dest_id'] = PAKISTAN_DESTINATIONS[city_lower]['dest_id']
            logger.info(f"Auto-detected dest_id for {search_params['city']}: {search_params['dest_id']}")
        
        # Check cache if requested
        use_cache = request.data.get('use_cache', True)
        # Versioned cache key so scraper improvements don't get stuck serving old 25-hotel results
        cache_key = f"realtime_v2_{search_params['city']}_{search_params['checkin']}_{search_params['checkout']}_{search_params.get('adults', 2)}"
        
        if use_cache:
            cached_data = cache.get(cache_key)
            if cached_data:
                cached_hotels = cached_data.get('hotels') if isinstance(cached_data, dict) else cached_data
                cached_meta = cached_data.get('meta') if isinstance(cached_data, dict) else {}
                logger.info(f"Returning cached real-time results ({len(cached_hotels)} hotels)")
                return Response({
                    'success': True,
                    'count': len(cached_hotels),
                    'hotels': cached_hotels,
                    'cached': True,
                    'is_real_time': True,
                    'data_source': 'booking.com',
                    'search_params': search_params,
                    'meta': cached_meta
                })
        
        # REAL-TIME SCRAPING using Puppeteer
        logger.info(f"Starting REAL-TIME scraping from Booking.com...")
        hotels = []
        meta = {}
        
        try:
            current_dir = os.path.dirname(os.path.abspath(__file__))
            puppeteer_script = os.path.join(current_dir, 'puppeteer_scraper.js')

            # Keep Node scraper under ~70 seconds so the full request (Python + Node)
            # comfortably stays below the 90 second requirement.
            search_params['max_seconds'] = request.data.get('max_seconds', 70)
            params_json = json.dumps(search_params)
            
            logger.info(f"Running Puppeteer scraper...")
            
            result = subprocess.run(
                ['node', puppeteer_script, params_json],
                capture_output=True,
                text=True,
                timeout=300,  # 5 min timeout for multi-page scraping
                cwd=current_dir,
                encoding='utf-8',  # Fix Windows encoding issue
                errors='replace'   # Replace undecodable chars instead of crashing
            )
            
            # Parse JSON output (supports legacy list output and new {hotels, meta} output)
            stdout_lines = result.stdout.strip().split('\n')
            for line in reversed(stdout_lines):
                try:
                    json_output = json.loads(line)
                    if isinstance(json_output, list):
                        hotels = json_output
                        meta = {}
                        break
                    if isinstance(json_output, dict) and isinstance(json_output.get('hotels'), list):
                        hotels = json_output.get('hotels', [])
                        meta = json_output.get('meta') or {}
                        break
                except json.JSONDecodeError:
                    continue
            
            if hotels:
                logger.info(f"Real-time scraping successful! Found {len(hotels)} hotels")
            else:
                logger.warning(f"No hotels found. stderr: {result.stderr[:500] if result.stderr else 'None'}")
                
        except subprocess.TimeoutExpired:
            logger.error("Real-time scraping timed out after 300 seconds")
        except FileNotFoundError:
            logger.error("Node.js not found. Install Node.js for real-time scraping")
        except Exception as e:
            logger.error(f"Real-time scraping error: {str(e)}")
        
        # Return only real-time data - NO STATIC FALLBACK
        if not hotels:
            return Response({
                'success': False,
                'count': 0,
                'hotels': [],
                'cached': False,
                'is_real_time': False,
                'data_source': 'none',
                'message': 'Unable to fetch real-time data from Booking.com. Please try again.',
                'search_params': search_params,
                'meta': meta
            })

        # Accuracy validation rule: compare with Booking.com visible count (best-effort)
        reported_count = meta.get('reported_count')
        if isinstance(reported_count, int) and reported_count > 0:
            if len(hotels) < int(reported_count * 0.8):
                logger.warning(
                    f"Accuracy validation failed: scraped={len(hotels)} reported={reported_count} (>20% diff)"
                )
                return Response(
                    {
                        'success': False,
                        'count': len(hotels),
                        'hotels': [],
                        'cached': False,
                        'is_real_time': False,
                        'data_source': 'booking.com',
                        'message': 'Scrape accuracy too low. Please retry.',
                        'search_params': search_params,
                        'meta': meta,
                    },
                    status=status.HTTP_502_BAD_GATEWAY,
                )

        elapsed_seconds = meta.get('elapsed_seconds')
        if isinstance(elapsed_seconds, (int, float)) and elapsed_seconds > 90:
            logger.warning(f"Scrape exceeded 90 seconds (elapsed={elapsed_seconds}) but returning data to avoid timeouts")

        # Persist hotels in DB (single transaction, no partial saves)
        def _build_source_url(params: dict, meta_dict: dict) -> str:
            base_url = "https://www.booking.com/searchresults.html"
            q = {
                'ss': params.get('city') or 'Lahore',
                'dest_id': params.get('dest_id') or '',
                'dest_type': params.get('dest_type') or 'city',
                'checkin': params.get('checkin'),
                'checkout': params.get('checkout'),
                'group_adults': params.get('adults', 2),
                'no_rooms': params.get('rooms', 1),
                'group_children': params.get('children', 0),
                'sb': 1,
                'src_elem': 'sb',
                'src': 'index',
                'lang': 'en-us',
                'sb_price_type': 'total',
                'order': meta_dict.get('sort_order') or 'popularity',
                'offset': 0,
            }
            return f"{base_url}?{urlencode(q)}"

        def _to_decimal(val):
            if val is None or val == '':
                return None
            try:
                return Decimal(str(val)).quantize(Decimal('0.01'))
            except (InvalidOperation, ValueError, TypeError):
                return None

        run_id = None
        try:
            with transaction.atomic():
                run = HotelScrapeRun.objects.create(
                    city=search_params.get('city') or 'Lahore',
                    dest_id=search_params.get('dest_id'),
                    dest_type=search_params.get('dest_type') or 'city',
                    checkin=checkin_date,
                    checkout=checkout_date,
                    adults=int(search_params.get('adults', 2) or 2),
                    rooms=int(search_params.get('rooms', 1) or 1),
                    children=int(search_params.get('children', 0) or 0),
                    source_url=_build_source_url(search_params, meta),
                    reported_count=reported_count if isinstance(reported_count, int) else None,
                    meta=meta or {},
                    status=HotelScrapeRun.Status.SUCCESS,
                )

                results = []
                seen = set()
                for h in hotels:
                    name = (h.get('name') or '').strip()
                    if not name:
                        continue

                    booking_url = (h.get('url') or '').strip() or None
                    uid_source = booking_url or f"{name}|{h.get('location') or ''}|{h.get('distance') or ''}"
                    hotel_uid = hashlib.sha256(uid_source.encode('utf-8', errors='ignore')).hexdigest()

                    if hotel_uid in seen:
                        continue
                    seen.add(hotel_uid)

                    results.append(
                        ScrapedHotelResult(
                            run=run,
                            hotel_uid=hotel_uid,
                            name=name[:255],
                            location_area=(h.get('location_area') or '')[:255] or None,
                            location=h.get('location') or None,
                            distance_from_center=(h.get('distance_from_center') or h.get('distance') or '')[:255] or None,
                            property_type=(h.get('property_type') or '')[:80] or None,
                            room_type=(h.get('room_type') or h.get('room_info') or '')[:255] or None,
                            price_per_night=_to_decimal(h.get('price_per_night')),
                            total_stay_price=_to_decimal(h.get('total_stay_price')),
                            review_rating=(float(h.get('review_rating')) if h.get('review_rating') is not None else None),
                            review_count=(int(h.get('review_count_num')) if h.get('review_count_num') is not None else None),
                            availability_status=(h.get('availability_status') or h.get('availability') or '')[:255] or None,
                            image_url=(h.get('image_url') or '').strip() or None,
                            booking_url=booking_url,
                            raw=h,
                        )
                    )

                ScrapedHotelResult.objects.bulk_create(results, batch_size=500)

                run.scraped_count = len(results)
                run.finished_at = timezone.now()
                run.save(update_fields=['scraped_count', 'finished_at'])
                run_id = str(run.id)
        except Exception as e:
            logger.error(f"Failed to persist scraped hotels: {str(e)}", exc_info=True)
            return Response(
                {
                    'success': False,
                    'count': 0,
                    'hotels': [],
                    'cached': False,
                    'is_real_time': False,
                    'data_source': 'booking.com',
                    'message': 'Scrape succeeded but saving results failed. Please retry.',
                    'search_params': search_params,
                    'meta': meta,
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        
        # Cache real-time results for 30 minutes
        cache.set(cache_key, {'hotels': hotels, 'meta': meta}, 1800)
        
        return Response({
            'success': True,
            'count': len(hotels),
            'hotels': hotels,
            'cached': False,
            'is_real_time': True,
            'data_source': 'booking.com',
            'search_params': search_params,
            'meta': meta,
            'run_id': run_id
        })
        
    except Exception as e:
        logger.error(f"Error in scrape_hotels: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': str(e),
            'message': 'Failed to scrape hotels.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_destinations(request):
    """Get list of supported Pakistani cities with their destination IDs"""
    destinations = [
        {
            'city': dest['name'],
            'dest_id': dest['dest_id'],
            'country': dest['country'],
            'key': key
        }
        for key, dest in PAKISTAN_DESTINATIONS.items()
    ]
    
    return Response({
        'success': True,
        'destinations': destinations
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def test_scraper(request):
    """Test scraper setup and configuration"""
    try:
        import shutil
        node_available = shutil.which('node') is not None
        
        current_dir = os.path.dirname(os.path.abspath(__file__))
        puppeteer_script = os.path.join(current_dir, 'puppeteer_scraper.js')
        script_exists = os.path.exists(puppeteer_script)
        
        return Response({
            'success': True,
            'node_available': node_available,
            'puppeteer_script_exists': script_exists,
            'message': 'Ready for real-time scraping' if (node_available and script_exists) else 'Setup required',
            'instructions': {
                'node': 'Install Node.js from https://nodejs.org',
                'puppeteer': 'cd backend/scraper && npm install'
            }
        })
        
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
