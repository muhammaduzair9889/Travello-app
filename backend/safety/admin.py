from django.contrib import admin

from .models import SafetySession, SafetyLocationPoint, SafetyRiskEvent, SafetyIncident


@admin.register(SafetySession)
class SafetySessionAdmin(admin.ModelAdmin):
    list_display = ('session_key', 'user', 'status', 'is_active', 'started_at', 'updated_at')
    list_filter = ('status', 'is_active', 'is_tracking_enabled', 'is_data_sharing_enabled')
    search_fields = ('session_key', 'user__email')


@admin.register(SafetyLocationPoint)
class SafetyLocationPointAdmin(admin.ModelAdmin):
    list_display = ('session', 'latitude', 'longitude', 'speed_mps', 'created_at')
    list_filter = ('source',)
    search_fields = ('session__session_key',)


@admin.register(SafetyRiskEvent)
class SafetyRiskEventAdmin(admin.ModelAdmin):
    list_display = ('session', 'risk_type', 'severity', 'is_resolved', 'created_at')
    list_filter = ('risk_type', 'severity', 'is_resolved')
    search_fields = ('session__session_key', 'message')


@admin.register(SafetyIncident)
class SafetyIncidentAdmin(admin.ModelAdmin):
    list_display = ('id', 'session', 'user', 'trigger', 'status', 'created_at')
    list_filter = ('trigger', 'status')
    search_fields = ('session__session_key', 'user__email', 'notes')
