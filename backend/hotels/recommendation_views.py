"""
Destination & hotel recommendation engine.
Uses the travel knowledge dataset + DB hotels to provide real recommendations.
Now includes AI-powered conversational recommendation endpoints.
"""
import json
import logging
import os

from django.conf import settings
from rest_framework import status as http_status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)

_travel_knowledge = None


def _load_travel_knowledge():
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


# ════════════════════════════════════════════════════════════════════════════
# AI Recommendation Endpoints (conversational flow + real-time scraping)
# ════════════════════════════════════════════════════════════════════════════

@api_view(['POST'])
@permission_classes([AllowAny])
def recommendation_start(request):
    """
    POST /api/recommendations/start/
    Start a new AI recommendation session. Returns the first preference question.
    """
    from authentication.recommendation_service import start_recommendation
    result = start_recommendation()
    return Response(result)


@api_view(['POST'])
@permission_classes([AllowAny])
def recommendation_answer(request):
    """
    POST /api/recommendations/answer/
    Submit an answer to the current preference question.
    Body: { "session_id": "...", "answer": "..." }
    """
    from authentication.recommendation_service import process_answer

    session_id = request.data.get('session_id', '').strip()
    answer = request.data.get('answer', '').strip()

    if not session_id:
        return Response(
            {'error': 'session_id is required'},
            status=http_status.HTTP_400_BAD_REQUEST,
        )
    if not answer:
        return Response(
            {'error': 'answer is required'},
            status=http_status.HTTP_400_BAD_REQUEST,
        )

    result = process_answer(session_id, answer)
    if result.get('status') == 'error':
        return Response(result, status=http_status.HTTP_404_NOT_FOUND)
    return Response(result)


@api_view(['GET'])
@permission_classes([AllowAny])
def recommendation_status(request, session_id):
    """
    GET /api/recommendations/status/<session_id>/
    Poll the current status of a recommendation session.
    """
    from authentication.recommendation_service import get_recommendation_status
    result = get_recommendation_status(session_id)
    if result.get('status') == 'error':
        return Response(result, status=http_status.HTTP_404_NOT_FOUND)
    return Response(result)


@api_view(['GET'])
@permission_classes([AllowAny])
def recommendation_results(request, session_id):
    """
    GET /api/recommendations/results/<session_id>/
    Get the final AI-ranked hotel results.
    """
    from authentication.recommendation_service import get_recommendation_results
    result = get_recommendation_results(session_id)
    if result.get('status') == 'error':
        return Response(result, status=http_status.HTTP_404_NOT_FOUND)
    return Response(result)


class DestinationRecommendationView(APIView):
    """GET /api/recommendations/?city=Lahore&budget=mid_range"""

    def get(self, request, *args, **kwargs):
        city = request.query_params.get('city', '').strip()
        budget = request.query_params.get('budget', '').strip().lower()

        knowledge = _load_travel_knowledge()
        destinations = knowledge.get('destinations', {})

        # If a city is specified, return that city's data
        if city:
            matched = None
            for name, data in destinations.items():
                if name.lower() == city.lower():
                    matched = (name, data)
                    break
            if not matched:
                return Response({
                    'recommendations': [],
                    'message': f"No data found for '{city}'. Available: {', '.join(destinations.keys())}",
                })

            name, data = matched
            hotels = data.get('popular_hotels', [])
            if budget:
                price_map = data.get('avg_hotel_price_pkr', {})
                max_price = price_map.get(budget)
                if max_price:
                    try:
                        limit = int(str(max_price).replace(',', '').split('-')[-1])
                        hotels = [
                            h for h in hotels
                            if _parse_price(h.get('price_range', '0')) <= limit * 1.3
                        ] or hotels
                    except (ValueError, TypeError):
                        pass

            return Response({
                'city': name,
                'description': data.get('description', ''),
                'best_season': data.get('best_season', ''),
                'avg_prices': data.get('avg_hotel_price_pkr', {}),
                'hotels': [
                    {
                        'name': h['name'],
                        'stars': h.get('stars', 0),
                        'price_range': h.get('price_range', ''),
                        'rating': h.get('rating', 0),
                        'amenities': h.get('amenities', []),
                    }
                    for h in hotels
                ],
                'attractions': [
                    {
                        'name': a['name'],
                        'type': a.get('type', ''),
                        'rating': a.get('rating', 0),
                        'entry_fee': a.get('entry_fee', ''),
                    }
                    for a in data.get('top_attractions', [])
                ],
                'cuisine': data.get('local_cuisine', []),
                'tips': data.get('tips', []),
            })

        # No city — return all destinations summary
        db_hotels = self._get_db_hotels()
        results = []
        for name, data in destinations.items():
            results.append({
                'city': name,
                'description': data.get('description', ''),
                'best_season': data.get('best_season', ''),
                'avg_prices': data.get('avg_hotel_price_pkr', {}),
                'hotel_count': len(data.get('popular_hotels', [])),
                'top_attraction': data['top_attractions'][0]['name'] if data.get('top_attractions') else '',
            })

        return Response({
            'destinations': results,
            'db_hotel_count': len(db_hotels),
            'seasonal_trends': knowledge.get('seasonal_trends', {}),
        })

    @staticmethod
    def _get_db_hotels():
        try:
            from hotels.models import Hotel
            return list(Hotel.objects.values_list('name', flat=True)[:50])
        except Exception:
            return []


def _parse_price(price_str):
    """Extract numeric price from '5000-8000' or '5000' style strings."""
    try:
        return int(str(price_str).replace(',', '').split('-')[0])
    except (ValueError, TypeError):
        return 0
