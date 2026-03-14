from rest_framework import viewsets, status, filters, parsers
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from django.db.models import Q

from .models import Review, ReviewHelpful, ReviewReply
from .serializers import (
    ReviewSerializer,
    ReviewCreateSerializer,
    ReviewReplySerializer,
    ReviewAnalyticsSerializer,
)
from .permissions import IsReviewOwnerOrReadOnly, CanReplyToReview
from .services.analytics_service import get_hotel_analytics
from .services.autocorrect_service import get_suggestions, apply_corrections

import logging
logger = logging.getLogger(__name__)


# ── Helpers ─────────────────────────────────────────────────
REVIEWABLE_STATUSES = ['PAID', 'CONFIRMED', 'COMPLETED']


def _get_reviewable_bookings(user):
    """
    Return bookings the user can write a review for:
    - status is PAID, CONFIRMED, or COMPLETED
    - no review already written
    """
    from hotels.models import Booking
    return Booking.objects.filter(
        user=user,
        status__in=REVIEWABLE_STATUSES,
    ).exclude(
        review__isnull=False,
    ).select_related('hotel', 'room_type').order_by('-check_out')


class ReviewViewSet(viewsets.ModelViewSet):
    """
    CRUD for reviews.

    list   — GET /reviews/                  (public, filterable)
    create — POST /reviews/                 (auth required)
    read   — GET /reviews/<id>/             (public)
    update — PUT/PATCH /reviews/<id>/       (owner only)
    delete — DELETE /reviews/<id>/          (owner only)
    """
    queryset = Review.objects.filter(status__in=['published', 'flagged']).select_related(
        'user', 'hotel', 'booking',
    ).prefetch_related('photos', 'replies', 'helpful_votes')
    filter_backends = [filters.OrderingFilter, filters.SearchFilter]
    ordering_fields = ['created_at', 'overall_rating', 'helpful_count']
    ordering = ['-created_at']
    search_fields = ['title', 'content', 'hotel__name']
    lookup_field = 'pk'

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return ReviewCreateSerializer
        return ReviewSerializer

    def get_permissions(self):
        if self.action in ('create',):
            return [IsAuthenticated()]
        if self.action in ('update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), IsReviewOwnerOrReadOnly()]
        return [IsAuthenticatedOrReadOnly()]

    def get_queryset(self):
        qs = super().get_queryset()
        hotel_id = self.request.query_params.get('hotel')
        user_id = self.request.query_params.get('user')
        rating = self.request.query_params.get('rating')
        sentiment = self.request.query_params.get('sentiment')
        trip_type = self.request.query_params.get('trip_type')

        if hotel_id:
            qs = qs.filter(hotel_id=hotel_id)
        if user_id:
            qs = qs.filter(user_id=user_id)
        if rating:
            qs = qs.filter(overall_rating=int(rating))
        if sentiment:
            qs = qs.filter(sentiment=sentiment)
        if trip_type:
            qs = qs.filter(trip_type=trip_type)

        return qs

    # ── My reviews ──────────────────────────────────────────
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated], url_path='my-reviews')
    def my_reviews(self, request):
        qs = Review.objects.filter(user=request.user).select_related(
            'hotel', 'booking',
        ).prefetch_related('photos', 'replies')
        serializer = ReviewSerializer(qs, many=True, context={'request': request})
        return Response(serializer.data)

    # ── Helpful vote toggle ─────────────────────────────────
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def helpful(self, request, pk=None):
        review = self.get_object()
        if review.user == request.user:
            return Response({'error': 'You cannot vote on your own review.'}, status=status.HTTP_400_BAD_REQUEST)

        vote, created = ReviewHelpful.objects.get_or_create(user=request.user, review=review)
        if not created:
            vote.delete()
            review.helpful_count = max(0, review.helpful_count - 1)
            review.save(update_fields=['helpful_count'])
            return Response({'helpful': False, 'helpful_count': review.helpful_count})

        review.helpful_count += 1
        review.save(update_fields=['helpful_count'])
        return Response({'helpful': True, 'helpful_count': review.helpful_count})

    # ── Reply to review (staff only) ────────────────────────
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, CanReplyToReview])
    def reply(self, request, pk=None):
        review = self.get_object()
        content = request.data.get('content', '').strip()
        if not content:
            return Response({'error': 'Reply content is required.'}, status=status.HTTP_400_BAD_REQUEST)

        reply_obj = ReviewReply.objects.create(
            review=review, user=request.user, content=content,
        )
        serializer = ReviewReplySerializer(reply_obj, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    # ── Hotel analytics ─────────────────────────────────────
    @action(detail=False, methods=['get'], url_path='analytics/(?P<hotel_id>[^/.]+)')
    def analytics(self, request, hotel_id=None):
        data = get_hotel_analytics(hotel_id)
        serializer = ReviewAnalyticsSerializer(data)
        return Response(serializer.data)

    # ── AI grammar & spelling check ───────────────────────────
    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated], url_path='autocorrect')
    def autocorrect(self, request):
        text = request.data.get('text', '')
        result = get_suggestions(text)
        return Response(result)

    # ── Apply autocorrect ───────────────────────────────────
    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated], url_path='apply-corrections')
    def apply_corrections_view(self, request):
        text = request.data.get('text', '')
        corrections = request.data.get('corrections', [])
        corrected = apply_corrections(text, corrections)
        return Response({'corrected_text': corrected})

    # ── Upload review photos to Cloudinary ──────────────────
    ALLOWED_IMAGE_TYPES = {'image/jpeg', 'image/png', 'image/webp'}
    MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5 MB
    MAX_IMAGES_PER_UPLOAD = 5

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated],
            url_path='upload-photos', parser_classes=[parsers.MultiPartParser])
    def upload_photos(self, request):
        """
        Upload review images to Cloudinary.
        Accepts multipart form data with 'images' field (multiple files).
        Returns list of uploaded image URLs.
        """
        files = request.FILES.getlist('images')
        if not files:
            return Response({'error': 'No images provided.'}, status=status.HTTP_400_BAD_REQUEST)

        if len(files) > self.MAX_IMAGES_PER_UPLOAD:
            return Response(
                {'error': f'Maximum {self.MAX_IMAGES_PER_UPLOAD} images allowed per upload.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate all files before uploading
        for f in files:
            if f.content_type not in self.ALLOWED_IMAGE_TYPES:
                return Response(
                    {'error': f'Invalid file type: {f.content_type}. Allowed: JPEG, PNG, WebP.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if f.size > self.MAX_IMAGE_SIZE:
                return Response(
                    {'error': f'File "{f.name}" exceeds 5 MB limit.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        try:
            import cloudinary.uploader
        except ImportError:
            return Response(
                {'error': 'Image upload service is not configured.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        uploaded = []
        for f in files:
            try:
                result = cloudinary.uploader.upload(
                    f,
                    folder='travello/reviews',
                    resource_type='image',
                    transformation=[
                        {'width': 1200, 'height': 1200, 'crop': 'limit', 'quality': 'auto'},
                    ],
                )
                uploaded.append({
                    'image_url': result['secure_url'],
                    'public_id': result['public_id'],
                })
            except Exception as e:
                logger.error(f'Cloudinary upload failed: {e}')
                return Response(
                    {'error': 'Failed to upload image. Please try again.'},
                    status=status.HTTP_502_BAD_GATEWAY,
                )

        return Response({'uploaded': uploaded}, status=status.HTTP_200_OK)

    # ── Check if user can review a booking ──────────────────
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated], url_path='can-review/(?P<booking_id>[^/.]+)')
    def can_review(self, request, booking_id=None):
        from hotels.models import Booking
        try:
            booking = Booking.objects.get(id=booking_id, user=request.user)
        except Booking.DoesNotExist:
            return Response({'can_review': False, 'reason': 'Booking not found.'})

        if booking.status not in REVIEWABLE_STATUSES:
            return Response({'can_review': False, 'reason': 'Booking is not confirmed yet.'})

        if hasattr(booking, 'review'):
            return Response({
                'can_review': False,
                'reason': 'You have already reviewed this booking.',
                'review_id': str(booking.review.id),
            })

        return Response({'can_review': True, 'booking_id': booking.id, 'hotel_name': booking.hotel.name})

    # ── Reviewable bookings for the user ────────────────────
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated], url_path='reviewable-bookings')
    def reviewable_bookings(self, request):
        """
        Returns bookings the user is eligible to review:
        - PAID, CONFIRMED, or COMPLETED
        - not already reviewed
        Also returns has_any_booking so the frontend knows whether to show
        a write-review section at all.
        """
        from hotels.models import Booking
        from hotels.serializers import BookingSerializer

        has_any_booking = Booking.objects.filter(user=request.user).exclude(status='CANCELLED').exists()
        reviewable = _get_reviewable_bookings(request.user)
        serializer = BookingSerializer(reviewable, many=True, context={'request': request})
        return Response({
            'has_any_booking': has_any_booking,
            'bookings': serializer.data,
        })
