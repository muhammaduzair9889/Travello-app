from rest_framework import serializers

from .models import SafetySession, SafetyLocationPoint, SafetyRiskEvent, SafetyIncident


class SafetySessionStartSerializer(serializers.Serializer):
    booking_id = serializers.IntegerField(required=False)
    is_tracking_enabled = serializers.BooleanField(required=False, default=True)
    is_data_sharing_enabled = serializers.BooleanField(required=False, default=True)


class SafetyPreferenceSerializer(serializers.Serializer):
    is_tracking_enabled = serializers.BooleanField(required=False)
    is_data_sharing_enabled = serializers.BooleanField(required=False)


class SafetyLocationUpdateSerializer(serializers.Serializer):
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    speed_mps = serializers.FloatField(required=False, allow_null=True)
    accuracy_m = serializers.FloatField(required=False, allow_null=True)
    heading = serializers.FloatField(required=False, allow_null=True)
    source = serializers.ChoiceField(choices=SafetyLocationPoint.SOURCE_CHOICES, required=False, default=SafetyLocationPoint.SOURCE_GPS)
    client_timestamp = serializers.DateTimeField(required=False, allow_null=True)
    app_active = serializers.BooleanField(required=False, default=True)


class SafetySOSSerializer(serializers.Serializer):
    emergency_type = serializers.CharField(required=False, default='general')
    notes = serializers.CharField(required=False, allow_blank=True, default='')


class SafetyRiskEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = SafetyRiskEvent
        fields = [
            'id', 'risk_type', 'severity', 'message', 'latitude', 'longitude',
            'metadata', 'requires_user_ack', 'is_resolved', 'created_at'
        ]


class SafetyIncidentSerializer(serializers.ModelSerializer):
    class Meta:
        model = SafetyIncident
        fields = [
            'id', 'trigger', 'emergency_type', 'notes', 'status',
            'latitude', 'longitude', 'created_at', 'acknowledged_at', 'resolved_at'
        ]


class SafetySessionSerializer(serializers.ModelSerializer):
    risks = SafetyRiskEventSerializer(source='risk_events', many=True, read_only=True)
    incidents = SafetyIncidentSerializer(many=True, read_only=True)

    class Meta:
        model = SafetySession
        fields = [
            'id', 'session_key', 'status', 'is_active', 'is_tracking_enabled',
            'is_data_sharing_enabled', 'latest_latitude', 'latest_longitude',
            'latest_speed_mps', 'latest_accuracy_m', 'latest_heading', 'latest_point_at',
            'started_at', 'ended_at', 'updated_at', 'risks', 'incidents'
        ]


class SafetyLocationPointSerializer(serializers.ModelSerializer):
    class Meta:
        model = SafetyLocationPoint
        fields = ['id', 'latitude', 'longitude', 'speed_mps', 'accuracy_m', 'heading', 'source', 'client_timestamp', 'created_at']
