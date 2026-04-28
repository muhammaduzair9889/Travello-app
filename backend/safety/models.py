import uuid
from django.db import models
from django.utils import timezone

from authentication.models import User
from hotels.models import Booking


class SafetySession(models.Model):
    STATUS_SAFE = 'SAFE'
    STATUS_RISK = 'RISK'
    STATUS_SOS = 'SOS'
    STATUS_CHOICES = [
        (STATUS_SAFE, 'Safe'),
        (STATUS_RISK, 'Risk Detected'),
        (STATUS_SOS, 'SOS Triggered'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='safety_sessions')
    booking = models.ForeignKey(Booking, on_delete=models.SET_NULL, null=True, blank=True, related_name='safety_sessions')
    session_key = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default=STATUS_SAFE, db_index=True)

    is_active = models.BooleanField(default=True, db_index=True)
    is_tracking_enabled = models.BooleanField(default=True)
    is_data_sharing_enabled = models.BooleanField(default=True)

    latest_latitude = models.FloatField(null=True, blank=True)
    latest_longitude = models.FloatField(null=True, blank=True)
    latest_speed_mps = models.FloatField(null=True, blank=True)
    latest_accuracy_m = models.FloatField(null=True, blank=True)
    latest_heading = models.FloatField(null=True, blank=True)
    latest_point_at = models.DateTimeField(null=True, blank=True)

    last_moved_at = models.DateTimeField(null=True, blank=True)
    last_activity_at = models.DateTimeField(null=True, blank=True)
    last_user_ack_at = models.DateTimeField(null=True, blank=True)

    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['user', 'is_active']),
            models.Index(fields=['status', 'is_active']),
            models.Index(fields=['-updated_at']),
        ]

    def __str__(self):
        return f'SafetySession<{self.session_key}> user={self.user_id} status={self.status}'


class SafetyLocationPoint(models.Model):
    SOURCE_GPS = 'GPS'
    SOURCE_NETWORK = 'NETWORK'
    SOURCE_CHOICES = [
        (SOURCE_GPS, 'GPS'),
        (SOURCE_NETWORK, 'Network'),
    ]

    session = models.ForeignKey(SafetySession, on_delete=models.CASCADE, related_name='location_points')
    latitude = models.FloatField()
    longitude = models.FloatField()
    speed_mps = models.FloatField(null=True, blank=True)
    accuracy_m = models.FloatField(null=True, blank=True)
    heading = models.FloatField(null=True, blank=True)
    source = models.CharField(max_length=12, choices=SOURCE_CHOICES, default=SOURCE_GPS)

    client_timestamp = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['session', '-created_at']),
        ]


class SafetyRiskEvent(models.Model):
    TYPE_ABNORMAL_STOP = 'ABNORMAL_STOP'
    TYPE_ROUTE_DEVIATION = 'ROUTE_DEVIATION'
    TYPE_HIGH_RISK_ZONE = 'HIGH_RISK_ZONE'
    TYPE_NO_ACTIVITY = 'NO_ACTIVITY'
    TYPE_MANUAL_SOS = 'MANUAL_SOS'
    TYPE_SYSTEM_ESCALATION = 'SYSTEM_ESCALATION'

    TYPE_CHOICES = [
        (TYPE_ABNORMAL_STOP, 'Abnormal Stop'),
        (TYPE_ROUTE_DEVIATION, 'Route Deviation'),
        (TYPE_HIGH_RISK_ZONE, 'High Risk Zone'),
        (TYPE_NO_ACTIVITY, 'No Activity'),
        (TYPE_MANUAL_SOS, 'Manual SOS'),
        (TYPE_SYSTEM_ESCALATION, 'System Escalation'),
    ]

    SEVERITY_LOW = 'LOW'
    SEVERITY_MEDIUM = 'MEDIUM'
    SEVERITY_HIGH = 'HIGH'
    SEVERITY_CRITICAL = 'CRITICAL'
    SEVERITY_CHOICES = [
        (SEVERITY_LOW, 'Low'),
        (SEVERITY_MEDIUM, 'Medium'),
        (SEVERITY_HIGH, 'High'),
        (SEVERITY_CRITICAL, 'Critical'),
    ]

    session = models.ForeignKey(SafetySession, on_delete=models.CASCADE, related_name='risk_events')
    risk_type = models.CharField(max_length=32, choices=TYPE_CHOICES, db_index=True)
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES, db_index=True)
    message = models.CharField(max_length=255)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    requires_user_ack = models.BooleanField(default=True)
    is_resolved = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['session', '-created_at']),
            models.Index(fields=['risk_type', 'is_resolved']),
        ]


class SafetyIncident(models.Model):
    TRIGGER_SOS = 'SOS'
    TRIGGER_AI = 'AI_ESCALATION'
    TRIGGER_CHOICES = [
        (TRIGGER_SOS, 'Manual SOS'),
        (TRIGGER_AI, 'AI Escalation'),
    ]

    STATUS_OPEN = 'OPEN'
    STATUS_ACKNOWLEDGED = 'ACKNOWLEDGED'
    STATUS_RESOLVED = 'RESOLVED'
    STATUS_CHOICES = [
        (STATUS_OPEN, 'Open'),
        (STATUS_ACKNOWLEDGED, 'Acknowledged'),
        (STATUS_RESOLVED, 'Resolved'),
    ]

    session = models.ForeignKey(SafetySession, on_delete=models.CASCADE, related_name='incidents')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='safety_incidents')
    trigger = models.CharField(max_length=20, choices=TRIGGER_CHOICES, db_index=True)
    emergency_type = models.CharField(max_length=80, blank=True, default='general')
    notes = models.TextField(blank=True, default='')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_OPEN, db_index=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['user', '-created_at']),
        ]

    def acknowledge(self):
        if self.status == self.STATUS_OPEN:
            self.status = self.STATUS_ACKNOWLEDGED
            self.acknowledged_at = timezone.now()
            self.save(update_fields=['status', 'acknowledged_at'])

    def resolve(self):
        self.status = self.STATUS_RESOLVED
        self.resolved_at = timezone.now()
        self.save(update_fields=['status', 'resolved_at'])
