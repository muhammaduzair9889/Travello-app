"""
Serializers for Hotel Search API
"""

from rest_framework import serializers
from datetime import date, timedelta


class HotelSearchSerializer(serializers.Serializer):
    """
    Serializer for hotel search request validation
    """
    check_in = serializers.DateField(required=True)
    check_out = serializers.DateField(required=True)
    adults = serializers.IntegerField(required=True, min_value=1, max_value=10)
    children = serializers.IntegerField(required=False, default=0, min_value=0, max_value=5)
    infants = serializers.IntegerField(required=False, default=0, min_value=0, max_value=3)
    room_type = serializers.ChoiceField(
        choices=['single', 'double', 'family', 'triple', 'quad'],
        required=False,
        default='double'
    )
    
    def validate_check_in(self, value):
        """Validate check-in date"""
        if value < date.today():
            raise serializers.ValidationError("Check-in date cannot be in the past")
        
        # Not more than 1 year in advance
        if value > date.today() + timedelta(days=365):
            raise serializers.ValidationError("Check-in date cannot be more than 1 year in advance")
        
        return value
    
    def validate_check_out(self, value):
        """Validate check-out date"""
        if value < date.today():
            raise serializers.ValidationError("Check-out date cannot be in the past")
        
        return value
    
    def validate(self, data):
        """Cross-field validation"""
        check_in = data.get('check_in')
        check_out = data.get('check_out')
        
        if check_in and check_out:
            if check_out <= check_in:
                raise serializers.ValidationError({
                    'check_out': 'Check-out date must be after check-in date'
                })
            
            # Maximum stay duration (30 days)
            if (check_out - check_in).days > 30:
                raise serializers.ValidationError({
                    'check_out': 'Maximum stay duration is 30 days'
                })
            
            # Minimum stay duration (1 day)
            if (check_out - check_in).days < 1:
                raise serializers.ValidationError({
                    'check_out': 'Minimum stay duration is 1 day'
                })
        
        return data
