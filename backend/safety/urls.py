from django.urls import path

from . import views


urlpatterns = [
    path('sessions/start/', views.SafetySessionStartView.as_view(), name='safety-session-start'),
    path('sessions/active/', views.UserActiveSafetySessionView.as_view(), name='safety-session-active'),
    path('sessions/<uuid:session_key>/stop/', views.SafetySessionStopView.as_view(), name='safety-session-stop'),
    path('sessions/<uuid:session_key>/preferences/', views.SafetySessionPreferenceView.as_view(), name='safety-session-preferences'),
    path('sessions/<uuid:session_key>/location/', views.SafetyLocationUpdateView.as_view(), name='safety-location-update'),
    path('sessions/<uuid:session_key>/sos/', views.SafetySOSView.as_view(), name='safety-sos'),
    path('sessions/<uuid:session_key>/ack/', views.SafetyAcknowledgeView.as_view(), name='safety-ack'),
    path('sessions/<uuid:session_key>/timeline/', views.SafetyTimelineView.as_view(), name='safety-timeline'),

    path('admin/live/', views.AdminLiveSafetyView.as_view(), name='safety-admin-live'),
    path('admin/incidents/<int:incident_id>/action/', views.AdminIncidentActionView.as_view(), name='safety-admin-incident-action'),
]
