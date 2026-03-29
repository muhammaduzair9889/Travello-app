"""
Django Views for Web Scraping API
  - POST scrape-hotels/           → enqueue background job, return job_id + cached snapshot
  - GET  job-status/<job_id>/     → poll progress
  - GET  results/<job_id>/        → full results
  - GET  destinations/
  - POST test/
"""
import logging
import subprocess
import os
import json
import hashlib
import threading
import time
from decimal import Decimal, InvalidOperation
from urllib.parse import urlencode

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.conf import settings as django_settings
from django.core.cache import cache
from django.views.decorators.csrf import csrf_exempt
from django.db import transaction, OperationalError
from django.utils import timezone
from django.utils.dateparse import parse_date

from .booking_scraper import BookingScraper, PAKISTAN_DESTINATIONS
from .models import HotelScrapeRun, ScrapedHotelResult, ScrapeJob

logger = logging.getLogger(__name__)

# ── Config (from settings, with safe defaults) ─────────────────────────────
SCRAPER_MAX_RESULTS = getattr(django_settings, 'SCRAPER_MAX_RESULTS', 1400)
SCRAPER_CACHE_TTL = getattr(django_settings, 'SCRAPER_CACHE_TTL_MINS', 15) * 60  # seconds
SCRAPER_CONCURRENCY = getattr(django_settings, 'SCRAPER_CONCURRENCY_LIMIT', 4)
SCRAPER_MAX_SECONDS = getattr(django_settings, 'SCRAPER_MAX_SECONDS', 400)
SCRAPER_HARD_TIMEOUT = getattr(django_settings, 'SCRAPER_HARD_TIMEOUT', 320)


def _to_bool(value, default=False):
    """Parse common truthy/falsey request values safely."""
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {'1', 'true', 'yes', 'y', 'on'}


def _is_db_locked(err):
    return 'database is locked' in str(err).lower()


def _db_retry(callable_fn, max_retries=5, base_sleep=0.1):
    """Retry a DB write callable to survive transient SQLite lock contention."""
    last_err = None
    for attempt in range(max_retries):
        try:
            return callable_fn()
        except OperationalError as e:
            last_err = e
            if _is_db_locked(e) and attempt < max_retries - 1:
                time.sleep(base_sleep * (2 ** attempt))
                continue
            raise
    if last_err:
        raise last_err


# ── Database retry helper for SQLite locks ──
def _update_job_safe(job_id, **kwargs):
    """Update ScrapeJob with retry logic for database locks"""
    _db_retry(lambda: ScrapeJob.objects.filter(pk=job_id).update(**kwargs))


# ── Helpers ─────────────────────────────────────────────────────────────────

def _cache_key(params):
    """Versioned cache key for search results."""
    return (
        f"realtime_v7_{params.get('city')}_{params.get('checkin')}_"
        f"{params.get('checkout')}_{params.get('adults', 2)}"
    )


def _to_decimal(val):
    if val is None or val == '':
        return None
    try:
        return Decimal(str(val)).quantize(Decimal('0.01'))
    except (InvalidOperation, ValueError, TypeError):
        return None


def _build_source_url(params, meta_dict):
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


def _normalize_hotels(hotels, search_params):
    """Normalize hotel dicts for frontend compatibility (mutates in-place)."""
    adults = int(search_params.get('adults', 2) or 2)
    for h in hotels:
        max_occ = h.get('max_occupancy') or 2
        h['occupancy_match'] = max_occ >= adults

        if not h.get('rooms'):
            h['rooms'] = [{
                'room_type': h.get('room_type', 'Standard Room'),
                'max_occupancy': max_occ,
                'price_per_night': h.get('price_per_night'),
                'total_price': h.get('total_stay_price'),
                'cancellation_policy': h.get('cancellation_policy'),
                'meal_plan': h.get('meal_plan'),
                'availability': h.get('availability_status', 'Available'),
                'is_available': not h.get('is_sold_out', False),
                'rooms_left': h.get('rooms_left'),
                'occupancy_match': max_occ >= adults,
            }]

        ppn = h.get('price_per_night') or h.get('double_bed_price_per_day')
        if not ppn and h.get('total_stay_price') and h.get('nights', 0) > 0:
            ppn = round(h['total_stay_price'] / h['nights'])
        h['price_per_night'] = ppn
        h['double_bed_price_per_day'] = ppn

        raw_rating = h.get('rating') or h.get('review_rating')
        if raw_rating:
            try:
                h['rating'] = float(str(raw_rating).replace(',', '.'))
                h['review_rating'] = h['rating']
            except (ValueError, TypeError):
                h['rating'] = None
                h['review_rating'] = None

        h.setdefault('source', 'booking.com')
        h.setdefault('is_real_time', True)
        h.setdefault('currency', 'PKR')

        # Ensure stars are passed through as-is from scraper (real-time)
        if h.get('stars') is not None:
            try:
                h['stars'] = int(h['stars'])
            except (ValueError, TypeError):
                h['stars'] = None

        # Ensure availability fields are present
        h.setdefault('is_sold_out', False)
        h.setdefault('is_limited', False)
        h.setdefault('rooms_left', None)

    return hotels


def _persist_hotels(hotels, search_params, meta, checkin_date, checkout_date, reported_count):
    """Write a HotelScrapeRun + results to DB.  Returns run or None."""
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
                results.append(ScrapedHotelResult(
                    run=run,
                    hotel_uid=hotel_uid,
                    name=name[:255],
                    location_area=(h.get('location_area') or '')[:255] or None,
                    location=h.get('location') or None,
                    distance_from_center=(h.get('distance_from_center') or h.get('distance') or '')[:255] or None,
                    property_type=(h.get('property_type') or '')[:80] or None,
                    room_type=(h.get('room_type') or h.get('room_info') or '')[:255] or None,
                    max_occupancy=int(h.get('max_occupancy', 2) or 2),
                    meal_plan=(h.get('meal_plan') or '')[:50] or None,
                    cancellation_policy=(h.get('cancellation_policy') or '')[:50] or None,
                    price_per_night=_to_decimal(h.get('price_per_night')),
                    total_stay_price=_to_decimal(h.get('total_stay_price')),
                    review_rating=float(h.get('review_rating')) if h.get('review_rating') is not None else None,
                    review_count=int(h.get('review_count_num')) if h.get('review_count_num') is not None else None,
                    availability_status=(h.get('availability_status') or h.get('availability') or '')[:255] or None,
                    image_url=(h.get('image_url') or '').strip() or None,
                    booking_url=booking_url,
                    raw=h,
                ))
            ScrapedHotelResult.objects.bulk_create(results, batch_size=500)
            run.scraped_count = len(results)
            run.finished_at = timezone.now()
            run.save(update_fields=['scraped_count', 'finished_at'])
            return run
    except Exception as e:
        logger.error(f"Failed to persist scraped hotels: {e}", exc_info=True)
        return None


def _run_puppeteer(search_params):
    """Invoke the Node.js Puppeteer scraper.  Returns (hotels, meta) tuple."""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    puppeteer_script = os.path.join(current_dir, 'puppeteer_scraper.js')
    params_json = json.dumps(search_params)

    result = subprocess.run(
        ['node', puppeteer_script, params_json],
        capture_output=True,
        text=True,
        timeout=SCRAPER_HARD_TIMEOUT,
        cwd=current_dir,
        encoding='utf-8',
        errors='replace',
    )

    logger.info(f"[Puppeteer] returncode={result.returncode}")
    logger.info(f"[Puppeteer] stderr (last 500): {(result.stderr or '')[-500:]}")
    logger.info(f"[Puppeteer] stdout length={len(result.stdout or '')}")

    hotels, meta = [], {}
    raw_stdout = result.stdout or ''
    stdout_lines = raw_stdout.strip().split('\n')
    for line in reversed(stdout_lines):
        try:
            json_output = json.loads(line)
            if isinstance(json_output, list):
                hotels = json_output
                break
            if isinstance(json_output, dict) and isinstance(json_output.get('hotels'), list):
                hotels = json_output.get('hotels', [])
                meta = json_output.get('meta') or {}
                break
        except json.JSONDecodeError:
            continue

    if not hotels:
        logger.warning(f"[Puppeteer] 0 hotels parsed. stdout last 300: {raw_stdout[-300:]}")

    return hotels, meta


# ── Background worker ───────────────────────────────────────────────────────

def _scrape_worker(job_id, search_params, checkin_date, checkout_date):
    """Run in a daemon thread — do NOT access Django request context."""
    import django
    django.setup()

    try:
        job = ScrapeJob.objects.get(pk=job_id)
        job.status = ScrapeJob.Status.RUNNING
        job.progress_pct = 10
        job.save(update_fields=['status', 'progress_pct', 'updated_at'])

        # Keep scraper budget below subprocess hard timeout so it can exit gracefully
        # and return parsed hotels instead of being force-killed.
        is_deep_mode = _to_bool(search_params.get('deep_mode'), False)
        coverage_priority = _to_bool(search_params.get('coverage_priority'), False)
        quick_mode = _to_bool(search_params.get('quick_mode'), False)
        safe_max_seconds = max(75, int(SCRAPER_HARD_TIMEOUT) - 35)

        # Use a lower default runtime for normal mode to avoid long waits.
        if is_deep_mode:
            default_max_seconds = SCRAPER_MAX_SECONDS
        elif quick_mode:
            default_max_seconds = 85
        elif coverage_priority:
            default_max_seconds = 260
        else:
            default_max_seconds = 130
        requested_max_seconds = int(search_params.get('max_seconds') or default_max_seconds)
        if is_deep_mode:
            search_params['max_seconds'] = min(requested_max_seconds, safe_max_seconds)
        elif quick_mode:
            search_params['max_seconds'] = min(requested_max_seconds, min(safe_max_seconds, 95))
        elif coverage_priority:
            search_params['max_seconds'] = min(requested_max_seconds, min(safe_max_seconds, 280))
        else:
            search_params['max_seconds'] = min(requested_max_seconds, min(safe_max_seconds, 220))

        # Balance default result caps by mode.
        if is_deep_mode:
            default_max_results = 1400
        elif quick_mode:
            default_max_results = 450
        elif coverage_priority:
            default_max_results = 1100
        else:
            default_max_results = 520
        requested_max_results = int(search_params.get('max_results') or default_max_results)
        if is_deep_mode:
            search_params['max_results'] = min(requested_max_results, 1400)
        elif quick_mode:
            search_params['max_results'] = min(requested_max_results, 450)
        elif coverage_priority:
            search_params['max_results'] = min(requested_max_results, 1100)
        else:
            search_params['max_results'] = min(requested_max_results, 520)

        logger.info(f"[Job {job_id}] Puppeteer starting — {search_params.get('city')}")

        # Move to midpoint once the scraper process is fully launched.
        _update_job_safe(job_id, progress_pct=50)

        hotels, meta = _run_puppeteer(search_params)
        logger.info(f"[Job {job_id}] Puppeteer done — {len(hotels)} hotels")

        _update_job_safe(job_id, progress_pct=70)

        if not hotels:
            job.refresh_from_db()
            job.status = ScrapeJob.Status.FAILED
            job.error_message = 'No hotels found. Booking.com may be temporarily unavailable.'
            job.save(update_fields=['status', 'error_message', 'updated_at'])
            return

        reported_count = meta.get('reported_count')
        verified = True
        verification_notes = meta.get('verification_notes', [])
        if isinstance(reported_count, int) and reported_count > 0:
            coverage_pct = round((len(hotels) / reported_count) * 100)
            verification_notes.append(
                f'Showing {len(hotels)} of {reported_count} properties '
                f'({coverage_pct}% — real-time prices)'
            )
            meta['coverage_pct'] = coverage_pct
        meta['verified'] = verified
        meta['verification_notes'] = verification_notes

        _normalize_hotels(hotels, search_params)

        meta['adults_requested'] = int(search_params.get('adults', 2) or 2)
        meta['total_hotels'] = len(hotels)

        # Cache
        ck = _cache_key(search_params)
        cache.set(ck, {'hotels': hotels, 'meta': meta}, SCRAPER_CACHE_TTL)

        # Mark the job completed immediately so polling clients can fetch results
        # without waiting for heavier database persistence work.
        job.status = ScrapeJob.Status.COMPLETED
        job.hotel_count = len(hotels)
        job.progress_pct = 100
        job.results = {'hotels': hotels, 'meta': meta}
        job.save(update_fields=[
            'status', 'hotel_count', 'progress_pct', 'results', 'updated_at',
        ])
        logger.info(f"[Job {job_id}] Completed — {len(hotels)} hotels ready")

        # Persist scrape run for analytics/history after completion response path.
        run = _db_retry(lambda: _persist_hotels(hotels, search_params, meta, checkin_date, checkout_date, reported_count))
        if run:
            _update_job_safe(job_id, run_id=run.id)
        logger.info(f"[Job {job_id}] Persisted — {len(hotels)} hotels cached")

    except subprocess.TimeoutExpired:
        logger.error(f"[Job {job_id}] Timed out")
        _update_job_safe(job_id,
            status=ScrapeJob.Status.FAILED,
            error_message='Scraper timed out',
        )
    except Exception as e:
        logger.error(f"[Job {job_id}] Error: {e}", exc_info=True)
        _update_job_safe(job_id,
            status=ScrapeJob.Status.FAILED,
            error_message=str(e)[:500],
        )
    finally:
        ScrapeJob.unregister_thread(job_id)


# ── API Endpoints ───────────────────────────────────────────────────────────

@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def scrape_hotels(request):
    """
    POST /api/scraper/scrape-hotels/

    Returns immediately with:
      - cached results if available (+ job_id for a background refresh)
      - or a job_id to poll via job-status/ and results/
    Never blocks longer than ~1 s.
    """
    try:
        search_params = {
            'city': request.data.get('city', 'Lahore'),
            'dest_id': request.data.get('dest_id'),
            'dest_type': request.data.get('dest_type', 'city'),
            'checkin': request.data.get('checkin'),
            'checkout': request.data.get('checkout'),
            'adults': request.data.get('adults', 2),
            'rooms': request.data.get('rooms', 1),
            'children': request.data.get('children', 0),
            'order': request.data.get('order', 'price'),
            # Deep mode is expensive; keep it opt-in so default searches complete quickly.
            'deep_mode': _to_bool(request.data.get('deep_search'), False),
            # Fast mode by default; clients can opt in to deeper coverage when needed.
            'coverage_priority': _to_bool(request.data.get('coverage_priority'), False),
            # Quick mode is enabled by default for best responsiveness.
            'quick_mode': _to_bool(request.data.get('quick_mode'), True),
        }

        checkin_date = parse_date(search_params.get('checkin') or '')
        checkout_date = parse_date(search_params.get('checkout') or '')
        if not checkin_date or not checkout_date:
            return Response(
                {'success': False, 'error': 'checkin and checkout are required (YYYY-MM-DD)', 'hotels': []},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if checkout_date <= checkin_date:
            return Response(
                {'success': False, 'error': 'checkout must be after checkin', 'hotels': []},
                status=status.HTTP_400_BAD_REQUEST,
            )

        city_lower = search_params['city'].lower()
        if not search_params['dest_id'] and city_lower in PAKISTAN_DESTINATIONS:
            search_params['dest_id'] = PAKISTAN_DESTINATIONS[city_lower]['dest_id']

        ck = _cache_key(search_params)
        use_cache = request.data.get('use_cache', True)

        # ── Return cached snapshot if available ─────────────────────────
        cached_data = cache.get(ck) if use_cache else None
        cached_hotels = None
        cached_meta = {}
        if cached_data:
            cached_hotels = cached_data.get('hotels') if isinstance(cached_data, dict) else cached_data
            cached_meta = cached_data.get('meta') if isinstance(cached_data, dict) else {}

        # ── Enqueue background job (unless at concurrency limit) ────────
        job_id = None
        at_capacity = ScrapeJob.active_count() >= SCRAPER_CONCURRENCY

        # Clean up stale RUNNING/QUEUED jobs older than 3 minutes
        from datetime import timedelta
        stale_cutoff = timezone.now() - timedelta(minutes=3)
        stale_count = _db_retry(lambda: ScrapeJob.objects.filter(
            status__in=[ScrapeJob.Status.QUEUED, ScrapeJob.Status.RUNNING],
            updated_at__lt=stale_cutoff,
        ).update(status=ScrapeJob.Status.FAILED, error_message='Auto-cleaned stale job'))
        if stale_count:
            logger.info(f"Cleaned up {stale_count} stale scrape job(s)")
            at_capacity = ScrapeJob.active_count() >= SCRAPER_CONCURRENCY  # recheck

        # First, check for a RUNNING/QUEUED job with the same search params
        existing_active = ScrapeJob.objects.filter(
            city=search_params['city'],
            checkin=checkin_date,
            checkout=checkout_date,
            adults=int(search_params.get('adults', 2) or 2),
            status__in=[ScrapeJob.Status.QUEUED, ScrapeJob.Status.RUNNING],
        ).order_by('-created_at').first()

        if existing_active:
            # Piggyback on the already-running job
            job_id = str(existing_active.id)
            logger.info(f"Reusing in-progress job {job_id} for {search_params['city']}")
        elif not at_capacity:
            # Also check for a recently completed job (< 10 min old) for same params
            from datetime import timedelta
            recent_cutoff = timezone.now() - timedelta(minutes=10)
            recent_completed = ScrapeJob.objects.filter(
                city=search_params['city'],
                checkin=checkin_date,
                checkout=checkout_date,
                adults=int(search_params.get('adults', 2) or 2),
                status=ScrapeJob.Status.COMPLETED,
                updated_at__gte=recent_cutoff,
                hotel_count__gt=0,
            ).order_by('-updated_at').first()

            if recent_completed and not cached_hotels:
                # Use the recent completed job's results as cache
                logger.info(f"Reusing recent completed job {recent_completed.id}")
                results = recent_completed.results or {}
                cached_hotels = results.get('hotels', [])
                cached_meta = results.get('meta', {})
                if cached_hotels:
                    cache.set(ck, {'hotels': cached_hotels, 'meta': cached_meta}, SCRAPER_CACHE_TTL)

            # If we already have fresh cached data, return it immediately without
            # launching another expensive background scrape.
            if cached_hotels:
                job_id = str(recent_completed.id) if recent_completed else None
                logger.info(f"Using cached recent results for {search_params['city']} (no new job enqueued)")
            else:
                job = _db_retry(lambda: ScrapeJob.objects.create(
                    city=search_params['city'],
                    dest_id=search_params.get('dest_id') or '',
                    dest_type=search_params.get('dest_type', 'city'),
                    checkin=checkin_date,
                    checkout=checkout_date,
                    adults=int(search_params.get('adults', 2) or 2),
                    rooms=int(search_params.get('rooms', 1) or 1),
                    children=int(search_params.get('children', 0) or 0),
                ))
                job_id = str(job.id)
                t = threading.Thread(
                    target=_scrape_worker,
                    args=(job.id, dict(search_params), checkin_date, checkout_date),
                    daemon=True,
                )
                ScrapeJob.register_thread(job.id, t)
                t.start()
                logger.info(f"Enqueued scrape job {job_id} for {search_params['city']}")
        else:
            # At capacity and no running job for these params
            logger.warning(f"At capacity ({ScrapeJob.active_count()}/{SCRAPER_CONCURRENCY})")

            # Check for recently completed job as fallback
            from datetime import timedelta
            recent_cutoff = timezone.now() - timedelta(minutes=15)
            recent_completed = ScrapeJob.objects.filter(
                city=search_params['city'],
                checkin=checkin_date,
                checkout=checkout_date,
                adults=int(search_params.get('adults', 2) or 2),
                status=ScrapeJob.Status.COMPLETED,
                updated_at__gte=recent_cutoff,
                hotel_count__gt=0,
            ).order_by('-updated_at').first()

            if recent_completed:
                results = recent_completed.results or {}
                cached_hotels = results.get('hotels', [])
                cached_meta = results.get('meta', {})
                job_id = str(recent_completed.id)
                logger.info(f"At capacity — returning recent results from job {job_id}")

        # ── Respond instantly ───────────────────────────────────────────
        if cached_hotels:
            return Response({
                'success': True,
                'count': len(cached_hotels),
                'hotels': cached_hotels,
                'cached': True,
                'is_real_time': True,
                'data_source': 'booking.com',
                'search_params': search_params,
                'meta': cached_meta,
                'job_id': job_id,
            })

        if job_id:
            return Response({
                'success': True,
                'count': 0,
                'hotels': [],
                'cached': False,
                'is_real_time': False,
                'data_source': 'pending',
                'message': 'Scraping started. Poll /api/scraper/job-status/<job_id>/ for updates.',
                'search_params': search_params,
                'meta': {},
                'job_id': job_id,
            })

        return Response({
            'success': False,
            'count': 0,
            'hotels': [],
            'cached': False,
            'is_real_time': False,
            'data_source': 'none',
            'message': 'Scraper is at capacity. Please try again shortly.',
            'search_params': search_params,
            'meta': {},
        }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    except OperationalError as e:
        logger.error(f"Error in scrape_hotels (db): {e}", exc_info=True)
        return Response(
            {
                'success': False,
                'error': 'Database temporarily busy. Please retry in a few seconds.',
                'message': 'Failed to initiate scrape.',
                'retryable': True,
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    except Exception as e:
        logger.error(f"Error in scrape_hotels: {e}", exc_info=True)
        return Response(
            {'success': False, 'error': str(e), 'message': 'Failed to initiate scrape.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def job_status(request, job_id):
    """GET /api/scraper/job-status/<job_id>/  — lightweight poll endpoint."""
    try:
        job = ScrapeJob.objects.get(pk=job_id)
    except ScrapeJob.DoesNotExist:
        return Response({'success': False, 'error': 'Job not found'}, status=status.HTTP_404_NOT_FOUND)

    return Response({
        'success': True,
        'job_id': str(job.id),
        'status': job.status,
        'hotel_count': job.hotel_count,
        'progress_pct': job.progress_pct,
        'error': job.error_message or None,
        'created_at': job.created_at.isoformat(),
        'updated_at': job.updated_at.isoformat(),
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def job_results(request, job_id):
    """GET /api/scraper/results/<job_id>/  — returns full hotel list."""
    try:
        job = ScrapeJob.objects.get(pk=job_id)
    except ScrapeJob.DoesNotExist:
        return Response({'success': False, 'error': 'Job not found'}, status=status.HTTP_404_NOT_FOUND)

    if job.status in (ScrapeJob.Status.QUEUED, ScrapeJob.Status.RUNNING):
        return Response({
            'success': True,
            'status': job.status,
            'message': 'Job still running. Poll job-status/ for progress.',
            'hotels': [],
            'meta': {},
        })

    if job.status == ScrapeJob.Status.FAILED:
        return Response({
            'success': False,
            'status': 'FAILED',
            'error': job.error_message,
            'hotels': [],
            'meta': {},
        })

    results = job.results or {}
    hotels = results.get('hotels', [])
    meta = results.get('meta', {})

    return Response({
        'success': True,
        'status': job.status,
        'count': len(hotels),
        'hotels': hotels,
        'meta': meta,
        'is_real_time': True,
        'data_source': 'booking.com',
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def get_destinations(request):
    """Get list of supported Pakistani cities with their destination IDs."""
    destinations = [
        {
            'city': dest['name'],
            'dest_id': dest['dest_id'],
            'country': dest['country'],
            'key': key,
        }
        for key, dest in PAKISTAN_DESTINATIONS.items()
    ]
    return Response({'success': True, 'destinations': destinations})


@api_view(['POST'])
@permission_classes([AllowAny])
def test_scraper(request):
    """Test scraper setup and configuration."""
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
            'concurrency_limit': SCRAPER_CONCURRENCY,
            'active_jobs': ScrapeJob.active_count(),
            'cache_ttl_minutes': SCRAPER_CACHE_TTL // 60,
            'message': 'Ready for real-time scraping' if (node_available and script_exists) else 'Setup required',
        })
    except Exception as e:
        return Response({'success': False, 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
