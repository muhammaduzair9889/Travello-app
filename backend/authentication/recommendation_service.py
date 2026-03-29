"""
Travello AI Recommendation Service
===================================
Conversational preference interview → real-time Booking.com scraping → Gemini AI ranking.

Flow:
  1. POST /api/recommendations/start/        → returns first question + session_id
  2. POST /api/recommendations/answer/        → processes answer, returns next Q or results
  3. GET  /api/recommendations/status/<sid>/   → poll scraping progress
  4. GET  /api/recommendations/results/<sid>/  → final AI-ranked results
"""
import json
import logging
import os
import threading
import uuid
from datetime import datetime, timedelta

import requests
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

# ── Constants ───────────────────────────────────────────────────────────────

PAKISTAN_DESTINATIONS = {
    'lahore':     {'dest_id': '-2767043', 'name': 'Lahore'},
    'karachi':    {'dest_id': '-2240905', 'name': 'Karachi'},
    'islamabad':  {'dest_id': '-2290032', 'name': 'Islamabad'},
    'rawalpindi': {'dest_id': '-2290033', 'name': 'Rawalpindi'},
    'faisalabad': {'dest_id': '-2762268', 'name': 'Faisalabad'},
    'multan':     {'dest_id': '-2240572', 'name': 'Multan'},
}

# Questions the AI preference engine asks the user (in order)
# NOTE: City is now hardcoded to Lahore only - removed selection prompt
PREFERENCE_QUESTIONS = [
    {
        'key': 'interests',
        'question': 'What type of places would you like to visit during your trip?',
        'options': ['Historical landmarks', 'Nature & mountains', 'Shopping areas', 'Restaurants & nightlife', 'Beaches or lakes', 'Religious sites', 'Parks & gardens', 'Museums & culture'],
        'type': 'multi',
    },
    {
        'key': 'travel_style',
        'question': 'What kind of travel experience are you looking for?',
        'options': ['Luxury & Comfort', 'Budget-Friendly', 'Family Trip', 'Romantic Getaway', 'Business Travel', 'Adventure & Exploring'],
        'type': 'single',
    },
    {
        'key': 'budget',
        'question': 'What is your budget per night (in PKR)?',
        'options': ['Under 5,000', '5,000 - 10,000', '10,000 - 20,000', '20,000 - 40,000', 'Above 40,000', 'No budget limit'],
        'type': 'single',
    },
    {
        'key': 'amenities',
        'question': 'Which amenities matter most to you?',
        'options': ['Free WiFi', 'Swimming Pool', 'Free Parking', 'Breakfast Included', 'Gym/Fitness', 'Spa & Wellness', 'Restaurant', 'Room Service'],
        'type': 'multi',
    },
    {
        'key': 'check_in',
        'question': 'When do you plan to check in? (Enter date like 2026-03-15 or "flexible")',
        'options': [],
        'type': 'date',
    },
    {
        'key': 'guests',
        'question': 'How many guests will be staying?',
        'options': ['1 guest', '2 guests', '3 guests', '4 guests', '5+ guests'],
        'type': 'single',
    },
]

# Interest → attraction type mapping for nearby hotel matching
INTEREST_ATTRACTION_MAP = {
    'Historical landmarks': ['heritage', 'monument', 'museum'],
    'Nature & mountains': ['nature', 'hiking', 'viewpoint', 'park'],
    'Shopping areas': ['shopping', 'bazaar', 'mall'],
    'Restaurants & nightlife': ['food', 'restaurant', 'nightlife'],
    'Beaches or lakes': ['beach', 'lake', 'waterfront'],
    'Religious sites': ['religious', 'heritage', 'mosque', 'temple'],
    'Parks & gardens': ['park', 'garden'],
    'Museums & culture': ['museum', 'cultural', 'gallery'],
}

# ── In-memory session store ─────────────────────────────────────────────────

_sessions: dict = {}
_SESSION_TTL_SECS = 30 * 60  # 30 minutes


def _cleanup_sessions():
    """Remove stale sessions."""
    now = datetime.utcnow()
    stale = [
        k for k, v in _sessions.items()
        if (now - v.get('updated_at', now)).total_seconds() > _SESSION_TTL_SECS
    ]
    for k in stale:
        _sessions.pop(k, None)


def _get_session(session_id: str) -> dict | None:
    _cleanup_sessions()
    return _sessions.get(session_id)


def _create_session() -> dict:
    _cleanup_sessions()
    sid = str(uuid.uuid4())
    session = {
        'id': sid,
        'step': 0,
        'profile': {},
        'status': 'interviewing',   # interviewing | scraping | ranking | done | error
        'hotels_raw': [],
        'hotels_ranked': [],
        'scrape_job_id': None,
        'error': None,
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
    }
    _sessions[sid] = session
    return session


# ── Travel knowledge loader ─────────────────────────────────────────────────

_travel_knowledge = None


def _load_travel_knowledge() -> dict:
    global _travel_knowledge
    if _travel_knowledge is not None:
        return _travel_knowledge
    try:
        path = os.path.join(
            str(settings.BASE_DIR.parent), 'data', 'datasets',
            'pakistan_travel_knowledge.json',
        )
        with open(path, 'r', encoding='utf-8') as f:
            _travel_knowledge = json.load(f)
    except Exception as e:
        logger.warning(f"Could not load travel knowledge: {e}")
        _travel_knowledge = {}
    return _travel_knowledge


# ── Public API functions ────────────────────────────────────────────────────

def start_recommendation() -> dict:
    """Create a new recommendation session and return the first question."""
    session = _create_session()
    # Auto-set destination to Lahore (only city available)
    session['profile']['destination'] = 'Lahore'
    session['updated_at'] = datetime.utcnow()
    q = PREFERENCE_QUESTIONS[0]
    return {
        'session_id': session['id'],
        'step': 0,
        'total_steps': len(PREFERENCE_QUESTIONS),
        'question': q['question'],
        'options': q['options'],
        'input_type': q['type'],
        'key': q['key'],
        'status': 'interviewing',
    }


def process_answer(session_id: str, answer: str) -> dict:
    """
    Process user's answer for the current step.
    Returns the next question, or triggers scraping + ranking when complete.
    """
    session = _get_session(session_id)
    if not session:
        return {'error': 'Session expired or not found', 'status': 'error'}

    step = session['step']
    if step >= len(PREFERENCE_QUESTIONS):
        # Already finished — return current status
        return _build_status_response(session)

    # Store the answer
    q = PREFERENCE_QUESTIONS[step]
    session['profile'][q['key']] = answer.strip()
    session['step'] = step + 1
    session['updated_at'] = datetime.utcnow()

    # If more questions remain, return the next one
    if session['step'] < len(PREFERENCE_QUESTIONS):
        next_q = PREFERENCE_QUESTIONS[session['step']]

        # Auto-handle check_in: if the previous was check_in, add check_out
        if next_q['key'] == 'guests' and 'check_in' in session['profile']:
            # If user provided a date, auto-set checkout to +2 days
            checkin = session['profile'].get('check_in', '').strip()
            if checkin and checkin.lower() not in ('flexible', 'any', 'not sure', ''):
                try:
                    ci = datetime.strptime(checkin, '%Y-%m-%d')
                    session['profile']['check_out'] = (ci + timedelta(days=2)).strftime('%Y-%m-%d')
                except ValueError:
                    session['profile']['check_out'] = None

        return {
            'session_id': session_id,
            'step': session['step'],
            'total_steps': len(PREFERENCE_QUESTIONS),
            'question': next_q['question'],
            'options': next_q['options'],
            'input_type': next_q['type'],
            'key': next_q['key'],
            'status': 'interviewing',
            'profile': session['profile'],
        }

    # All questions answered → kick off scraping
    session['status'] = 'scraping'
    session['updated_at'] = datetime.utcnow()

    # Start scraping in background thread
    t = threading.Thread(
        target=_scrape_and_rank,
        args=(session_id,),
        daemon=True,
    )
    t.start()

    return {
        'session_id': session_id,
        'step': session['step'],
        'total_steps': len(PREFERENCE_QUESTIONS),
        'status': 'scraping',
        'message': 'Great! Finding the best hotels matching your preferences...',
        'profile': session['profile'],
    }


def get_recommendation_status(session_id: str) -> dict:
    """Poll endpoint — returns current status of the recommendation session."""
    session = _get_session(session_id)
    if not session:
        return {'error': 'Session expired or not found', 'status': 'error'}
    return _build_status_response(session)


def get_recommendation_results(session_id: str) -> dict:
    """Return the final ranked hotels."""
    session = _get_session(session_id)
    if not session:
        return {'error': 'Session expired or not found', 'status': 'error'}

    if session['status'] != 'done':
        return _build_status_response(session)

    profile = session['profile']
    # Build search filters for frontend redirect to internal results page
    checkin = profile.get('check_in', '').strip()
    checkout = profile.get('check_out', '').strip()
    if not checkin or checkin.lower() in ('flexible', 'any', 'not sure'):
        tomorrow = datetime.utcnow() + timedelta(days=1)
        checkin = tomorrow.strftime('%Y-%m-%d')
        checkout = (tomorrow + timedelta(days=2)).strftime('%Y-%m-%d')
    if not checkout:
        try:
            ci = datetime.strptime(checkin, '%Y-%m-%d')
            checkout = (ci + timedelta(days=2)).strftime('%Y-%m-%d')
        except ValueError:
            tomorrow = datetime.utcnow() + timedelta(days=1)
            checkin = tomorrow.strftime('%Y-%m-%d')
            checkout = (tomorrow + timedelta(days=2)).strftime('%Y-%m-%d')

    guests_str = profile.get('guests', '2 guests')
    guests = 2
    try:
        guests = int(''.join(c for c in guests_str if c.isdigit()) or '2')
    except ValueError:
        guests = 2

    # Gather matched attractions based on user interests
    matched_attractions = _get_matched_attractions(
        profile.get('destination', 'Lahore'),
        profile.get('interests', ''),
    )

    return {
        'session_id': session_id,
        'status': 'done',
        'profile': profile,
        'hotels': session['hotels_ranked'],
        'total_found': len(session.get('hotels_raw', [])),
        'ai_summary': session.get('ai_summary', ''),
        'search_filters': {
            'destination': profile.get('destination', 'Lahore'),
            'checkIn': checkin,
            'checkOut': checkout,
            'adults': guests,
            'children': 0,
        },
        'matched_attractions': matched_attractions,
    }


# ── Internal helpers ────────────────────────────────────────────────────────

def _build_status_response(session: dict) -> dict:
    resp = {
        'session_id': session['id'],
        'status': session['status'],
        'profile': session['profile'],
        'step': session['step'],
        'total_steps': len(PREFERENCE_QUESTIONS),
    }
    if session['status'] == 'done':
        resp['hotels'] = session['hotels_ranked']
        resp['total_found'] = len(session.get('hotels_raw', []))
        resp['ai_summary'] = session.get('ai_summary', '')
    elif session['status'] == 'error':
        resp['error'] = session.get('error', 'Unknown error')
    elif session['status'] == 'scraping':
        resp['message'] = 'Searching real-time hotel data from Booking.com...'
        resp['scrape_job_id'] = session.get('scrape_job_id')
    elif session['status'] == 'ranking':
        resp['message'] = 'AI is analyzing and ranking hotels based on your preferences...'
    return resp


# ── Scraper + Gemini ranking pipeline ───────────────────────────────────────

def _scrape_and_rank(session_id: str):
    """Background thread: scrape Booking.com → rank with Gemini → store results."""
    import django
    django.setup()

    session = _get_session(session_id)
    if not session:
        return

    try:
        profile = session['profile']
        city = profile.get('destination', 'Lahore')

        # Resolve dates
        checkin = profile.get('check_in', '').strip()
        checkout = profile.get('check_out', '').strip()
        if not checkin or checkin.lower() in ('flexible', 'any', 'not sure'):
            # Default: tomorrow + 2 days
            tomorrow = datetime.utcnow() + timedelta(days=1)
            checkin = tomorrow.strftime('%Y-%m-%d')
            checkout = (tomorrow + timedelta(days=2)).strftime('%Y-%m-%d')
        if not checkout:
            try:
                ci = datetime.strptime(checkin, '%Y-%m-%d')
                checkout = (ci + timedelta(days=2)).strftime('%Y-%m-%d')
            except ValueError:
                tomorrow = datetime.utcnow() + timedelta(days=1)
                checkin = tomorrow.strftime('%Y-%m-%d')
                checkout = (tomorrow + timedelta(days=2)).strftime('%Y-%m-%d')

        # Parse guests
        guests_str = profile.get('guests', '2 guests')
        guests = 2
        try:
            guests = int(''.join(c for c in guests_str if c.isdigit()) or '2')
        except ValueError:
            guests = 2
        if guests < 1:
            guests = 2

        # Resolve dest_id
        city_lower = city.lower().strip()
        dest_info = PAKISTAN_DESTINATIONS.get(city_lower, {})
        dest_id = dest_info.get('dest_id', '')

        logger.info(
            f"[RecSvc {session_id[:8]}] Scraping {city} "
            f"({checkin}→{checkout}, {guests} guests)"
        )

        # ── Call the scraper API internally ──────────────────────────────
        hotels = _trigger_scrape(
            city=city,
            dest_id=dest_id,
            checkin=checkin,
            checkout=checkout,
            adults=guests,
            session_id=session_id,
        )

        session['hotels_raw'] = hotels
        session['updated_at'] = datetime.utcnow()

        if not hotels:
            session['status'] = 'done'
            session['hotels_ranked'] = []
            session['ai_summary'] = (
                f"We couldn't find available hotels in {city} for your dates. "
                "This might be because Booking.com is temporarily unavailable. "
                "Please try again in a few moments or adjust your dates."
            )
            return

        logger.info(f"[RecSvc {session_id[:8]}] Got {len(hotels)} hotels, starting AI ranking")

        # ── AI ranking via Gemini ────────────────────────────────────────
        session['status'] = 'ranking'
        session['updated_at'] = datetime.utcnow()

        ranked = _rank_with_gemini(hotels, profile, city)
        session['hotels_ranked'] = ranked['hotels']
        session['ai_summary'] = ranked.get('summary', '')
        session['status'] = 'done'
        session['updated_at'] = datetime.utcnow()

        logger.info(
            f"[RecSvc {session_id[:8]}] Done — {len(ranked['hotels'])} ranked results"
        )

    except Exception as e:
        logger.error(f"[RecSvc {session_id[:8]}] Error: {e}", exc_info=True)
        session['status'] = 'error'
        session['error'] = str(e)
        session['updated_at'] = datetime.utcnow()


def _trigger_scrape(city: str, dest_id: str, checkin: str, checkout: str,
                    adults: int, session_id: str) -> list:
    """
    Trigger the scraper and wait for results.
    Uses the same scraper infrastructure as hotel search.
    """
    from scraper.views import (
        _cache_key, _run_puppeteer, _normalize_hotels, _persist_hotels,
        SCRAPER_CACHE_TTL,
    )
    from scraper.models import ScrapeJob
    from django.utils.dateparse import parse_date

    search_params = {
        'city': city,
        'dest_id': dest_id,
        'dest_type': 'city',
        'checkin': checkin,
        'checkout': checkout,
        'adults': adults,
        'rooms': 1,
        'children': 0,
        'order': 'popularity',
    }

    # Check cache first
    ck = _cache_key(search_params)
    cached = cache.get(ck)
    if cached:
        hotels = cached.get('hotels', []) if isinstance(cached, dict) else cached
        if hotels:
            logger.info(f"[RecSvc {session_id[:8]}] Using {len(hotels)} cached hotels")
            return hotels

    # Check for recent completed scrape job
    checkin_date = parse_date(checkin)
    checkout_date = parse_date(checkout)

    recent = ScrapeJob.objects.filter(
        city__iexact=city,
        checkin=checkin_date,
        checkout=checkout_date,
        adults=adults,
        status=ScrapeJob.Status.COMPLETED,
        hotel_count__gt=0,
    ).order_by('-updated_at').first()

    if recent and recent.results:
        hotels = recent.results.get('hotels', [])
        if hotels:
            logger.info(f"[RecSvc {session_id[:8]}] Using {len(hotels)} from recent job")
            return hotels

    # No cache — run the puppeteer scraper directly
    logger.info(f"[RecSvc {session_id[:8]}] Running Puppeteer scraper for {city}")

    search_params['max_seconds'] = 140
    search_params['max_results'] = 600
    search_params['coverage_priority'] = False
    search_params['deep_mode'] = False
    search_params['quick_mode'] = True

    hotels, meta = _run_puppeteer(search_params)

    if not hotels:
        # Retry once
        logger.warning(f"[RecSvc {session_id[:8]}] 0 hotels, retrying...")
        import time
        time.sleep(3)
        hotels, meta = _run_puppeteer(search_params)

    if hotels:
        _normalize_hotels(hotels, search_params)

        # Persist and cache
        reported_count = meta.get('reported_count')
        _persist_hotels(hotels, search_params, meta, checkin_date, checkout_date, reported_count)
        cache.set(ck, {'hotels': hotels, 'meta': meta}, SCRAPER_CACHE_TTL)

    return hotels


def _rank_with_gemini(hotels: list, profile: dict, city: str) -> dict:
    """
    Send hotels + user profile to Gemini for intelligent ranking.
    Returns {hotels: [...], summary: str}.
    """
    knowledge = _load_travel_knowledge()
    city_info = knowledge.get('destinations', {}).get(city, {})

    # Build budget range
    budget_map = {
        'Under 5,000': (0, 5000),
        '5,000 - 10,000': (5000, 10000),
        '10,000 - 20,000': (10000, 20000),
        '20,000 - 40,000': (20000, 40000),
        'Above 40,000': (40000, 999999),
        'No budget limit': (0, 999999),
    }
    budget_str = profile.get('budget', 'No budget limit')
    min_budget, max_budget = budget_map.get(budget_str, (0, 999999))

    # Pre-filter hotels by budget before sending to Gemini
    budget_filtered = []
    for h in hotels:
        price = h.get('price_per_night') or h.get('total_stay_price') or 0
        try:
            price = float(str(price).replace(',', ''))
        except (ValueError, TypeError):
            price = 0
        # Allow 20% over budget for flexibility
        if price <= 0 or (min_budget * 0.8 <= price <= max_budget * 1.2):
            budget_filtered.append(h)

    # If budget filtering removes too many, fallback to all
    if len(budget_filtered) < 5:
        budget_filtered = hotels

    # Limit to top 30 hotels for Gemini analysis (sorted by rating first)
    sorted_hotels = sorted(
        budget_filtered,
        key=lambda h: float(h.get('review_rating') or h.get('rating') or 0),
        reverse=True,
    )[:30]

    # Build hotel summaries for Gemini
    hotel_summaries = []
    for i, h in enumerate(sorted_hotels):
        name = h.get('name', 'Unknown Hotel')
        price = h.get('price_per_night') or h.get('total_stay_price') or 'N/A'
        rating = h.get('review_rating') or h.get('rating') or 'N/A'
        review_count = h.get('review_count') or h.get('review_count_num') or 0
        room = h.get('room_type', 'Standard')
        meal = h.get('meal_plan', 'Not specified')
        cancel = h.get('cancellation_policy', 'N/A')
        amenities = h.get('amenities', [])
        if isinstance(amenities, list):
            amenities_str = ', '.join(amenities[:8])
        else:
            amenities_str = str(amenities)
        distance = h.get('distance_from_center') or h.get('distance') or 'N/A'
        location = h.get('location') or h.get('location_area') or ''
        prop_type = h.get('property_type', 'Hotel')
        max_occ = h.get('max_occupancy', 2)

        hotel_summaries.append(
            f"{i+1}. {name}\n"
            f"   Price: PKR {price}/night | Rating: {rating}/10 ({review_count} reviews)\n"
            f"   Type: {prop_type} | Room: {room} | Max occupancy: {max_occ}\n"
            f"   Location: {location} | Distance from center: {distance}\n"
            f"   Meal plan: {meal} | Cancellation: {cancel}\n"
            f"   Amenities: {amenities_str}"
        )

    hotels_text = '\n\n'.join(hotel_summaries)

    # City knowledge context + interest-matched attractions
    city_ctx = ''
    interest_ctx = ''
    if city_info:
        all_attractions = city_info.get('top_attractions', [])
        attractions = ', '.join(a['name'] for a in all_attractions[:5])
        city_ctx = (
            f"\nAbout {city}: {city_info.get('description', '')}\n"
            f"Best season: {city_info.get('best_season', 'year-round')}\n"
            f"Top attractions: {attractions}\n"
        )

        # Match attractions to user interests
        user_interests = profile.get('interests', '')
        if user_interests:
            interests_list = [i.strip() for i in user_interests.split(',') if i.strip()]
            matched_types = set()
            for interest in interests_list:
                for atype in INTEREST_ATTRACTION_MAP.get(interest, []):
                    matched_types.add(atype)

            matched_attractions = [
                a for a in all_attractions
                if a.get('type', '').lower() in matched_types
            ]
            if matched_attractions:
                interest_ctx = (
                    f"\nUSER INTERESTS: {user_interests}\n"
                    f"MATCHING ATTRACTIONS IN {city.upper()}:\n"
                    + '\n'.join(
                        f"  - {a['name']} (type: {a.get('type', 'general')}, rating: {a.get('rating', 'N/A')})"
                        for a in matched_attractions
                    )
                    + '\n\nPRIORITIZE hotels near these attractions. Hotels closer to the city center or '
                    'in areas near these attractions should rank higher.\n'
                )

    preferred_amenities = profile.get('amenities', '')

    system_prompt = f"""You are the Travello AI hotel ranking engine. Your job is to analyze real hotel data and rank them based on the user's preferences and travel interests.

USER PROFILE:
- Destination: {profile.get('destination', city)}
- Travel interests: {profile.get('interests', 'General sightseeing')}
- Travel style: {profile.get('travel_style', 'General')}
- Budget: {budget_str} per night (PKR)
- Preferred amenities: {preferred_amenities}
- Guests: {profile.get('guests', '2')}
{city_ctx}{interest_ctx}

HOTELS (real-time data):
{hotels_text}

YOUR TASK:
1. Rank these hotels from BEST to WORST match for this specific user.
2. For each hotel, provide a personalized "ai_reason" explaining WHY it's a great match — reference the user's interests and nearby attractions when relevant.
3. Assign a "match_score" from 0.0 to 1.0 (1.0 = perfect match).
4. Write a brief summary that mentions the user's interests and which attractions nearby hotels are close to.

Consider these factors for ranking (in priority order):
- PROXIMITY to attractions matching user's interests (most important)
- How well the hotel matches the travel style (luxury/budget/family/etc.)
- Price relative to budget
- Rating and review count
- Amenities matching user preferences
- Location convenience (distance from center)
- Room suitability for guest count
- Meal plan and cancellation flexibility

RESPOND IN THIS EXACT JSON FORMAT (no markdown, no code blocks, just raw JSON):
{{
  "summary": "Personalized 2-3 sentence summary referencing the user's interests and matching attractions in the city.",
  "rankings": [
    {{
      "index": 1,
      "match_score": 0.95,
      "ai_reason": "Why this hotel is perfect — mention nearby attractions matching their interests (1-2 sentences)"
    }},
    ...up to 15 hotels maximum
  ]
}}

IMPORTANT:
- "index" refers to the hotel number from the list above (1-based).
- Return at most 15 hotels.
- Only include hotels that are reasonably good matches (match_score >= 0.4).
- The ai_reason MUST be personalized — mention the user's interests and relevant nearby attractions.
- Respond with ONLY the JSON object, nothing else."""

    try:
        response_text = _call_gemini(
            system_instruction=system_prompt,
            contents=[{"role": "user", "parts": [{"text": "Please rank these hotels based on my preferences."}]}],
            temperature=0.3,
            max_tokens=4096,
        )

        # Parse the JSON response
        ranking_data = _parse_gemini_json(response_text)

        if not ranking_data or 'rankings' not in ranking_data:
            logger.warning("Gemini returned invalid ranking format, using fallback")
            return _fallback_ranking(sorted_hotels, profile)

        # Build final ranked hotel list
        ranked_hotels = []
        for rank in ranking_data.get('rankings', [])[:15]:
            idx = rank.get('index', 0) - 1  # Convert to 0-based
            if 0 <= idx < len(sorted_hotels):
                hotel = dict(sorted_hotels[idx])  # Copy
                hotel['match_score'] = rank.get('match_score', 0.5)
                hotel['ai_reason'] = rank.get('ai_reason', 'Recommended for you')
                ranked_hotels.append(hotel)

        # If Gemini returned too few, pad with fallback
        if len(ranked_hotels) < 3:
            return _fallback_ranking(sorted_hotels, profile)

        return {
            'hotels': ranked_hotels,
            'summary': ranking_data.get('summary', f'Here are the best hotels in {city} matching your preferences.'),
        }

    except Exception as e:
        logger.error(f"Gemini ranking failed: {e}", exc_info=True)
        return _fallback_ranking(sorted_hotels, profile)


def _parse_gemini_json(text: str) -> dict | None:
    """Extract JSON from Gemini's response, handling markdown code blocks."""
    import re
    # Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try extracting from code blocks
    patterns = [
        r'```json\s*(.*?)\s*```',
        r'```\s*(.*?)\s*```',
        r'\{[\s\S]*\}',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1) if '```' in pattern else match.group(0))
            except (json.JSONDecodeError, IndexError):
                continue
    return None


def _fallback_ranking(hotels: list, profile: dict) -> dict:
    """Rule-based ranking when Gemini is unavailable."""
    travel_style = profile.get('travel_style', '').lower()
    budget_str = profile.get('budget', 'No budget limit')
    preferred_amenities = profile.get('amenities', '').lower()

    budget_map = {
        'Under 5,000': (0, 5000),
        '5,000 - 10,000': (5000, 10000),
        '10,000 - 20,000': (10000, 20000),
        '20,000 - 40,000': (20000, 40000),
        'Above 40,000': (40000, 999999),
        'No budget limit': (0, 999999),
    }
    min_b, max_b = budget_map.get(budget_str, (0, 999999))

    scored = []
    for h in hotels:
        score = 0.5
        price = 0
        try:
            price = float(str(h.get('price_per_night') or 0).replace(',', ''))
        except (ValueError, TypeError):
            pass

        rating = 0
        try:
            rating = float(str(h.get('review_rating') or h.get('rating') or 0).replace(',', '.'))
        except (ValueError, TypeError):
            pass

        # Budget match (30%)
        if price > 0 and min_b <= price <= max_b:
            score += 0.3
        elif price > 0 and price <= max_b * 1.2:
            score += 0.15

        # Rating (25%)
        if rating >= 8:
            score += 0.25
        elif rating >= 7:
            score += 0.15
        elif rating >= 6:
            score += 0.08

        # Travel style match (20%)
        name_lower = (h.get('name') or '').lower()
        prop_type = (h.get('property_type') or '').lower()
        if 'luxury' in travel_style and any(w in name_lower for w in ('pearl', 'avari', 'marriott', 'serena', 'luxury')):
            score += 0.2
        elif 'budget' in travel_style and price > 0 and price < 5000:
            score += 0.2
        elif 'family' in travel_style and (h.get('max_occupancy', 2) >= 4):
            score += 0.2
        elif 'business' in travel_style and any(w in name_lower for w in ('business', 'executive', 'corporate')):
            score += 0.15

        # Amenities (15%)
        hotel_amenities = ' '.join(h.get('amenities', []) if isinstance(h.get('amenities'), list) else []).lower()
        if 'wifi' in preferred_amenities and 'wifi' in hotel_amenities:
            score += 0.05
        if 'pool' in preferred_amenities and 'pool' in hotel_amenities:
            score += 0.05
        if 'breakfast' in preferred_amenities and h.get('meal_plan', '').lower().startswith('breakfast'):
            score += 0.05

        # Review count (10%)
        review_count = h.get('review_count') or h.get('review_count_num') or 0
        try:
            review_count = int(review_count)
        except (ValueError, TypeError):
            review_count = 0
        if review_count > 1000:
            score += 0.1
        elif review_count > 500:
            score += 0.05

        score = min(score, 1.0)
        h_copy = dict(h)
        h_copy['match_score'] = round(score, 2)
        h_copy['ai_reason'] = _generate_fallback_reason(h_copy, profile)
        scored.append(h_copy)

    scored.sort(key=lambda x: x['match_score'], reverse=True)
    top = scored[:15]

    city = profile.get('destination', 'Pakistan')
    return {
        'hotels': top,
        'summary': f"Based on your preferences for a {profile.get('travel_style', 'great')} trip to {city}, here are the best matching hotels with real-time prices from Booking.com.",
    }


def _generate_fallback_reason(hotel: dict, profile: dict) -> str:
    """Generate a simple reason string for fallback ranking."""
    parts = []
    rating = hotel.get('review_rating') or hotel.get('rating')
    if rating:
        try:
            r = float(str(rating).replace(',', '.'))
            if r >= 9:
                parts.append('Exceptionally rated')
            elif r >= 8:
                parts.append('Highly rated')
            elif r >= 7:
                parts.append('Well reviewed')
        except (ValueError, TypeError):
            pass

    style = profile.get('travel_style', '')
    if 'luxury' in style.lower():
        parts.append('great for a luxury stay')
    elif 'budget' in style.lower():
        parts.append('excellent value for money')
    elif 'family' in style.lower():
        parts.append('family-friendly option')
    elif 'romantic' in style.lower():
        parts.append('perfect for couples')
    elif 'business' in style.lower():
        parts.append('ideal for business travelers')
    elif 'adventure' in style.lower():
        parts.append('great base for exploring')

    meal = hotel.get('meal_plan', '')
    if meal and 'breakfast' in meal.lower():
        parts.append('breakfast included')

    cancel = hotel.get('cancellation_policy', '')
    if cancel and 'free' in cancel.lower():
        parts.append('free cancellation')

    if not parts:
        parts.append(f"Good match for your trip to {profile.get('destination', 'Pakistan')}")

    return ' — '.join(parts[:3])


# ── Interest-attraction matching helper ──────────────────────────────────────

def _get_matched_attractions(city: str, interests_str: str) -> list:
    """Return attractions in the city matching the user's interests."""
    knowledge = _load_travel_knowledge()
    destinations = knowledge.get('destinations', {})
    city_data = None
    for name, data in destinations.items():
        if name.lower() == city.lower().strip():
            city_data = data
            break
    if not city_data:
        return []

    interests = [i.strip() for i in interests_str.split(',') if i.strip()]
    if not interests:
        return [a['name'] for a in city_data.get('top_attractions', [])[:5]]

    matched_types = set()
    for interest in interests:
        for atype in INTEREST_ATTRACTION_MAP.get(interest, []):
            matched_types.add(atype)

    matched = []
    for attraction in city_data.get('top_attractions', []):
        atype = attraction.get('type', '').lower()
        if atype in matched_types:
            matched.append(attraction['name'])

    return matched if matched else [a['name'] for a in city_data.get('top_attractions', [])[:5]]


# ── Gemini API call ─────────────────────────────────────────────────────────

def _call_gemini(system_instruction: str, contents: list,
                 temperature: float = 0.7, max_tokens: int = 1024) -> str:
    """Call Gemini API with retry and model fallback."""
    from travello_backend.utils import call_gemini
    return call_gemini(system_instruction, contents, temperature, max_tokens)
