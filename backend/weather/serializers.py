from rest_framework import serializers
from .models import WeatherCache


class WeatherSerializer(serializers.ModelSerializer):
    contextual_message = serializers.SerializerMethodField()
    icon_url = serializers.SerializerMethodField()

    class Meta:
        model = WeatherCache
        fields = [
            'city',
            'temperature',
            'condition',
            'humidity',
            'wind_speed',
            'icon_code',
            'icon_url',
            'contextual_message',
            'last_updated',
            'updated_at',
        ]

    def get_contextual_message(self, obj):
        """Generate contextual message based on weather condition."""
        condition_lower = obj.condition.lower()
        temp = obj.temperature

        if 'rain' in condition_lower or 'drizzle' in condition_lower:
            return "☔ Carry an umbrella!"
        elif 'clear' in condition_lower or 'sunny' in condition_lower:
            return "🌇 Great day for sightseeing!"
        elif temp > 30:
            return "🥤 Stay hydrated!"
        elif temp < 5:
            return "🧥 Wear warm clothing!"
        elif 'cloud' in condition_lower:
            return "🌤️ Pleasant weather"
        elif 'wind' in condition_lower:
            return "💨 Breezy conditions"
        else:
            return "✨ Enjoy your day!"

    def get_icon_url(self, obj):
        """Generate OpenWeather icon URL."""
        return f"https://openweathermap.org/img/wn/{obj.icon_code}@2x.png"
