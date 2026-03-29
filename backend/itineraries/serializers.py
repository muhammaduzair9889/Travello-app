from rest_framework import serializers

from .models import Place, Itinerary


class PlaceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Place
        fields = [
            'id', 'city', 'name', 'category', 'tags',
            'estimated_visit_minutes', 'budget_level',
            'latitude', 'longitude', 'average_rating',
            'ideal_start_hour', 'ideal_end_hour',
        ]


class ItinerarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Itinerary
        fields = [
            'id', 'city',
            'start_date', 'end_date', 'travelers',
            'budget_level', 'interests', 'pace', 'mood',
            'days', 'saved', 'notes',
            'locked_place_ids', 'excluded_place_ids',
            'created_at', 'updated_at',
        ]


class ItineraryGenerateSerializer(serializers.Serializer):
    city = serializers.CharField(default='Lahore', required=False)
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    travelers = serializers.IntegerField(min_value=1, default=1, required=False)

    budget_level = serializers.ChoiceField(choices=Itinerary.Budget.choices, default=Itinerary.Budget.MEDIUM)
    interests = serializers.ListField(child=serializers.CharField(), default=list, required=False)
    pace = serializers.ChoiceField(choices=Itinerary.Pace.choices, default=Itinerary.Pace.BALANCED)
    mood = serializers.ChoiceField(choices=Itinerary.Mood.choices, default='', required=False, allow_blank=True)

    def validate(self, attrs):
        if attrs['end_date'] <= attrs['start_date']:
            raise serializers.ValidationError("end_date must be after start_date")
        return attrs
