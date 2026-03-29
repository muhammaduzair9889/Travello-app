"""
API Views for ML-powered recommendations
  - Falls back to a deterministic rule-based engine when ML deps are missing.
  - Never returns HTTP 500 for missing ML libraries.
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.conf import settings as django_settings
from django.core.cache import cache
from django.db.models import Q, F, Value, FloatField
from django.db.models.functions import Coalesce
import logging
import re

logger = logging.getLogger(__name__)

# Feature flag — defaults to True so existing callers keep working
ENABLE_ML = getattr(django_settings, 'ENABLE_ML_RECOMMENDATIONS', True)


# ── Rule-based fallback ────────────────────────────────────────────────────

def _rule_based_recommendations(query, top_n=10, city=None, category=None,
                                 min_price=None, max_price=None, min_rating=None,
                                 item_type=None, **_extra):
    """
    Deterministic, zero-dependency recommendation fallback.
    Uses the Hotel model from the DB and simple keyword + rating scoring.
    Returns the same JSON shape as the ML engine.
    """
    from hotels.models import Hotel

    qs = Hotel.objects.all()

    # Filters
    if city:
        qs = qs.filter(city__iexact=city)
    if category:
        qs = qs.filter(Q(hotel_type__icontains=category) | Q(description__icontains=category))
    if min_price is not None:
        qs = qs.filter(double_bed_price_per_day__gte=min_price)
    if max_price is not None:
        qs = qs.filter(double_bed_price_per_day__lte=max_price)
    if min_rating is not None:
        qs = qs.filter(rating__gte=min_rating)

    # Score = keyword hits * 0.4 + normalised rating * 0.6
    keywords = set(re.findall(r'\w+', query.lower())) if query else set()

    results = []
    for hotel in qs[:200]:  # cap scan
        keyword_score = 0
        text_blob = f"{hotel.name} {hotel.description or ''} {hotel.city or ''}".lower()
        for kw in keywords:
            if kw in text_blob:
                keyword_score += 1
        kw_norm = min(keyword_score / max(len(keywords), 1), 1.0)
        rating_norm = (hotel.rating or 0) / 10.0
        combined = kw_norm * 0.4 + rating_norm * 0.6

        reasons = []
        if kw_norm > 0.5:
            reasons.append(f"Good keyword match ({kw_norm*100:.0f}%)")
        if (hotel.rating or 0) >= 8:
            reasons.append(f"Highly rated ({hotel.rating}/10)")
        price = hotel.double_bed_price_per_day
        if price and price < 10000:
            reasons.append(f"Budget-friendly (PKR {price:,.0f})")
        elif price and price < 25000:
            reasons.append(f"Mid-range (PKR {price:,.0f})")
        elif price:
            reasons.append(f"Premium (PKR {price:,.0f})")

        results.append({
            'item_id': hotel.id,
            'name': hotel.name,
            'description': hotel.description or '',
            'type': 'hotel',
            'category': hotel.hotel_type or 'hotel',
            'city': hotel.city or 'Lahore',
            'latitude': float(hotel.latitude or 31.52),
            'longitude': float(hotel.longitude or 74.36),
            'price_pkr': float(price) if price else 0,
            'rating': float(hotel.rating) if hotel.rating else 0,
            'tags': '',
            'availability': True,
            'similarity_score': round(kw_norm, 4),
            'combined_score': round(combined, 4),
            'reasons': reasons or ['Available in your search area'],
            'can_book': True,
            'can_save': True,
            'fallback': True,  # signal to frontend
        })

    results.sort(key=lambda r: r['combined_score'], reverse=True)
    return results[:top_n]


class MLRecommendationsView(APIView):
    """
    POST /api/ml-recommendations
    
    Returns ML recommendations when available, otherwise rule-based fallback.
    """
    
    permission_classes = [AllowAny]
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.engine = None
    
    def _get_engine(self):
        """Lazy load recommendation engine — returns None on any failure."""
        if self.engine is None:
            try:
                from ml_system.training.recommendation_engine import RecommendationEngine
                self.engine = RecommendationEngine()
                # Check if model actually loaded
                if self.engine.model is None:
                    logger.warning("RecommendationEngine loaded but model is None — ML disabled")
                    self.engine = None
                else:
                    logger.info("Loaded RecommendationEngine (ML)")
            except Exception as e:
                logger.warning(f"Cannot load ML engine, will use fallback: {e}")
                self.engine = None
        return self.engine
    
    def post(self, request):
        """Get recommendations based on query."""
        try:
            query = request.data.get('query', '')
            if not query:
                return Response(
                    {'error': 'Query parameter is required'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            
            top_n = int(request.data.get('top_n', 10))
            filters = {
                'city': request.data.get('city', 'Lahore'),
                'category': request.data.get('category'),
                'min_price': float(request.data['min_price']) if request.data.get('min_price') is not None else None,
                'max_price': float(request.data['max_price']) if request.data.get('max_price') is not None else None,
                'min_rating': float(request.data['min_rating']) if request.data.get('min_rating') is not None else None,
                'item_type': request.data.get('item_type'),
                'availability': request.data.get('availability', True),
            }
            
            # Check cache
            cache_key = f"ml_rec_{query}_{top_n}_{filters['city']}_{filters['category']}_{filters['min_price']}_{filters['max_price']}_{filters['min_rating']}_{filters['item_type']}"
            cached_result = cache.get(cache_key)
            if cached_result:
                return Response(cached_result)
            
            # Try ML engine first (if feature flag enabled)
            recommendations = None
            engine_used = 'rule_based'

            if ENABLE_ML:
                engine = self._get_engine()
                if engine is not None:
                    try:
                        recommendations = engine.recommend(
                            query=query, top_n=top_n, **filters
                        )
                        engine_used = 'ml'
                    except Exception as ml_err:
                        logger.warning(f"ML engine failed, falling back: {ml_err}")
                        recommendations = None

            # Fallback to rule-based
            if recommendations is None:
                logger.info(f"Using rule-based fallback for query: {query}")
                recommendations = _rule_based_recommendations(
                    query=query, top_n=top_n, **filters
                )
                engine_used = 'rule_based'
            
            result = {
                'success': True,
                'count': len(recommendations),
                'query': query,
                'engine': engine_used,
                'filters': filters,
                'recommendations': recommendations,
            }
            
            cache.set(cache_key, result, 3600)
            return Response(result, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Unexpected error in recommendations: {e}", exc_info=True)
            # Even the fallback failed — return empty, never 500
            return Response(
                {
                    'success': True,
                    'count': 0,
                    'query': request.data.get('query', ''),
                    'engine': 'none',
                    'recommendations': [],
                    'message': 'Recommendations temporarily unavailable.',
                },
                status=status.HTTP_200_OK,
            )


class SimilarItemsView(APIView):
    """
    GET /api/similar-items/<item_id>?top_n=5&same_type=true
    """
    
    permission_classes = [AllowAny]
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.engine = None
    
    def _get_engine(self):
        if self.engine is None:
            try:
                from ml_system.training.recommendation_engine import RecommendationEngine
                eng = RecommendationEngine()
                if eng.model is not None:
                    self.engine = eng
            except Exception:
                pass
        return self.engine
    
    def get(self, request, item_id):
        """Get similar items — returns empty list if ML unavailable."""
        try:
            top_n = int(request.query_params.get('top_n', 5))
            same_type = request.query_params.get('same_type', 'true').lower() == 'true'
            
            engine = self._get_engine()
            if engine is not None:
                try:
                    similar_items = engine.get_similar_items(
                        item_id=int(item_id),
                        top_n=top_n,
                        same_type=same_type,
                    )
                    return Response({
                        'success': True,
                        'item_id': item_id,
                        'count': len(similar_items),
                        'similar_items': similar_items,
                    }, status=status.HTTP_200_OK)
                except Exception as e:
                    logger.warning(f"ML similar items failed: {e}")

            # Fallback: empty list (no 500)
            return Response({
                'success': True,
                'item_id': item_id,
                'count': 0,
                'similar_items': [],
                'message': 'Similar items unavailable — ML model not loaded.',
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error finding similar items: {e}", exc_info=True)
            return Response(
                {'success': True, 'item_id': item_id, 'count': 0, 'similar_items': []},
                status=status.HTTP_200_OK,
            )


class TrainingStatusView(APIView):
    """
    GET /api/ml-status
    """
    
    permission_classes = [AllowAny]
    
    def get(self, request):
        import json
        from pathlib import Path
        
        backend_dir = Path(__file__).parent.parent
        models_dir = backend_dir / "ml_system" / "models"
        config_file = models_dir / "travello_config.json"
        
        if not config_file.exists():
            return Response({
                'trained': False,
                'ml_enabled': ENABLE_ML,
                'message': 'Model not trained. Run: python ml_system/training/train_ml_model.py',
            })
        
        with open(config_file, 'r') as f:
            config = json.load(f)
        
        return Response({
            'trained': True,
            'ml_enabled': ENABLE_ML,
            'model_name': config['model_name'],
            'num_items': config['num_items'],
            'num_hotels': config['num_hotels'],
            'num_attractions': config['num_attractions'],
            'embedding_dim': config['embedding_dim'],
            'trained_at': config['trained_at'],
            'datasets': config['datasets'],
        })
