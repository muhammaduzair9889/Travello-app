"""
Analytics service — computes aggregate stats for a hotel's reviews.
"""
from django.db.models import Avg, Count, Q
from reviews.models import Review


def get_hotel_analytics(hotel_id):
    """
    Return aggregate review analytics for a hotel.
    """
    qs = Review.objects.filter(hotel_id=hotel_id, status='published')

    if not qs.exists():
        return {
            'total_reviews': 0,
            'average_rating': 0,
            'rating_distribution': {str(i): 0 for i in range(1, 6)},
            'aspect_averages': {},
            'sentiment_distribution': {'positive': 0, 'neutral': 0, 'negative': 0},
            'recommendation_rate': 0,
            'recent_trend': 'stable',
        }

    agg = qs.aggregate(
        total=Count('id'),
        avg_overall=Avg('overall_rating'),
        avg_cleanliness=Avg('cleanliness_rating'),
        avg_service=Avg('service_rating'),
        avg_location=Avg('location_rating'),
        avg_value=Avg('value_rating'),
        avg_amenities=Avg('amenities_rating'),
    )

    # Rating distribution
    dist = {}
    for star in range(1, 6):
        dist[str(star)] = qs.filter(overall_rating=star).count()

    # Sentiment distribution
    sentiments = {
        'positive': qs.filter(sentiment='positive').count(),
        'neutral': qs.filter(sentiment='neutral').count(),
        'negative': qs.filter(sentiment='negative').count(),
    }

    # Recommendation rate (4+ stars)
    total = agg['total']
    high_rated = qs.filter(overall_rating__gte=4).count()
    recommendation_rate = round((high_rated / total) * 100, 1) if total else 0

    # Recent trend — compare last 5 reviews avg vs overall
    recent = qs.order_by('-created_at')[:5]
    if recent.count() >= 3:
        recent_avg = sum(r.overall_rating for r in recent) / recent.count()
        overall_avg = agg['avg_overall'] or 0
        if recent_avg > overall_avg + 0.3:
            trend = 'improving'
        elif recent_avg < overall_avg - 0.3:
            trend = 'declining'
        else:
            trend = 'stable'
    else:
        trend = 'stable'

    aspect_averages = {}
    for key in ['cleanliness', 'service', 'location', 'value', 'amenities']:
        val = agg.get(f'avg_{key}')
        if val is not None:
            aspect_averages[key] = round(val, 1)

    return {
        'total_reviews': total,
        'average_rating': round(agg['avg_overall'] or 0, 1),
        'rating_distribution': dist,
        'aspect_averages': aspect_averages,
        'sentiment_distribution': sentiments,
        'recommendation_rate': recommendation_rate,
        'recent_trend': trend,
    }
