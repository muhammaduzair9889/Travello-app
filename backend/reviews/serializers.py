from rest_framework import serializers
from .models import Review, ReviewPhoto, ReviewHelpful, ReviewReply
from authentication.serializers import UserSerializer


class ReviewPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReviewPhoto
        fields = ['id', 'image_url', 'caption', 'uploaded_at']
        read_only_fields = ('uploaded_at',)


class ReviewReplySerializer(serializers.ModelSerializer):
    user_details = UserSerializer(source='user', read_only=True)

    class Meta:
        model = ReviewReply
        fields = ['id', 'user', 'content', 'user_details', 'created_at', 'updated_at']
        read_only_fields = ('user', 'created_at', 'updated_at')


class ReviewSerializer(serializers.ModelSerializer):
    """Read serializer — full review with nested relations."""
    user_details = UserSerializer(source='user', read_only=True)
    photos = ReviewPhotoSerializer(many=True, read_only=True)
    replies = ReviewReplySerializer(many=True, read_only=True)
    hotel_name = serializers.CharField(source='hotel.name', read_only=True)
    hotel_city = serializers.CharField(source='hotel.city', read_only=True)
    hotel_image = serializers.URLField(source='hotel.image', read_only=True)
    booking_reference = serializers.CharField(source='booking.booking_reference', read_only=True)
    aspect_average = serializers.FloatField(read_only=True)
    user_found_helpful = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = [
            'id', 'user', 'hotel', 'booking',
            'overall_rating', 'cleanliness_rating', 'service_rating',
            'location_rating', 'value_rating', 'amenities_rating',
            'title', 'content', 'trip_type',
            'sentiment', 'sentiment_score',
            'status', 'is_verified_stay',
            'helpful_count', 'report_count',
            'user_details', 'hotel_name', 'hotel_city', 'hotel_image',
            'booking_reference', 'aspect_average', 'user_found_helpful',
            'photos', 'replies',
            'created_at', 'updated_at',
        ]
        read_only_fields = (
            'user', 'sentiment', 'sentiment_score', 'status',
            'is_verified_stay', 'helpful_count', 'report_count',
            'created_at', 'updated_at',
        )

    def get_user_found_helpful(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.helpful_votes.filter(user=request.user).exists()
        return False


class ReviewCreateSerializer(serializers.ModelSerializer):
    """Write serializer for creating / updating reviews."""
    photos = ReviewPhotoSerializer(many=True, required=False)

    class Meta:
        model = Review
        fields = [
            'booking', 'overall_rating',
            'cleanliness_rating', 'service_rating',
            'location_rating', 'value_rating', 'amenities_rating',
            'title', 'content', 'trip_type', 'photos',
        ]

    def validate_booking(self, booking):
        request = self.context['request']
        # Must own the booking
        if booking.user != request.user:
            raise serializers.ValidationError("You can only review your own bookings.")

        # Must be a confirmed booking (PAID, CONFIRMED, or COMPLETED)
        if booking.status not in ('PAID', 'CONFIRMED', 'COMPLETED'):
            raise serializers.ValidationError("You can only review confirmed bookings.")

        # One review per booking (skip on update)
        if not self.instance and hasattr(booking, 'review'):
            raise serializers.ValidationError("A review already exists for this booking.")
        return booking

    def create(self, validated_data):
        photos_data = validated_data.pop('photos', [])
        booking = validated_data['booking']
        validated_data['user'] = self.context['request'].user
        validated_data['hotel'] = booking.hotel

        # Sentiment analysis
        from reviews.services.sentiment_service import analyze_sentiment
        sentiment_result = analyze_sentiment(validated_data.get('content', ''))
        validated_data['sentiment'] = sentiment_result['sentiment']
        validated_data['sentiment_score'] = sentiment_result['score']

        # Moderation
        from reviews.services.moderation_service import moderate_review
        mod_result = moderate_review(
            validated_data.get('title', ''),
            validated_data.get('content', ''),
        )
        if not mod_result['approved']:
            validated_data['status'] = 'flagged'

        review = Review.objects.create(**validated_data)

        # Create photos
        for photo in photos_data:
            ReviewPhoto.objects.create(review=review, **photo)

        # Update hotel average rating
        self._update_hotel_rating(review.hotel)

        # Send notification
        try:
            from authentication.models import Notification
            Notification.review_published(review.user, review.hotel.name)
        except Exception:
            pass

        return review

    def update(self, instance, validated_data):
        photos_data = validated_data.pop('photos', None)

        # Re-analyse sentiment
        content = validated_data.get('content', instance.content)
        from reviews.services.sentiment_service import analyze_sentiment
        sentiment_result = analyze_sentiment(content)
        validated_data['sentiment'] = sentiment_result['sentiment']
        validated_data['sentiment_score'] = sentiment_result['score']

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Replace photos if provided
        if photos_data is not None:
            instance.photos.all().delete()
            for photo in photos_data:
                ReviewPhoto.objects.create(review=instance, **photo)

        self._update_hotel_rating(instance.hotel)
        return instance

    @staticmethod
    def _update_hotel_rating(hotel):
        """Recalculate hotel.rating from published reviews."""
        from django.db.models import Avg
        avg = hotel.reviews.filter(status='published').aggregate(
            avg=Avg('overall_rating')
        )['avg']
        hotel.rating = round(avg, 1) if avg else 0.0
        hotel.save(update_fields=['rating'])


class ReviewAnalyticsSerializer(serializers.Serializer):
    """Read-only serializer for hotel review analytics."""
    total_reviews = serializers.IntegerField()
    average_rating = serializers.FloatField()
    rating_distribution = serializers.DictField(child=serializers.IntegerField())
    aspect_averages = serializers.DictField(child=serializers.FloatField())
    sentiment_distribution = serializers.DictField(child=serializers.IntegerField())
    recommendation_rate = serializers.FloatField()
    recent_trend = serializers.CharField()
