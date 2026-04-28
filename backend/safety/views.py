from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from hotels.models import Booking

from .models import SafetySession, SafetyLocationPoint, SafetyRiskEvent, SafetyIncident
from .permissions import IsStaffUser
from .serializers import (
    SafetySessionStartSerializer,
    SafetyPreferenceSerializer,
    SafetyLocationUpdateSerializer,
    SafetySOSSerializer,
    SafetySessionSerializer,
    SafetyLocationPointSerializer,
    SafetyRiskEventSerializer,
    SafetyIncidentSerializer,
)
from .services import evaluate_risk, emit_safety_event, create_incident


class SafetySessionStartView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = SafetySessionStartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        with transaction.atomic():
            SafetySession.objects.filter(user=request.user, is_active=True).update(
                is_active=False,
                ended_at=timezone.now(),
            )

            booking = None
            booking_id = data.get('booking_id')
            if booking_id:
                booking = Booking.objects.filter(id=booking_id, user=request.user).first()

            session = SafetySession.objects.create(
                user=request.user,
                booking=booking,
                is_tracking_enabled=data.get('is_tracking_enabled', True),
                is_data_sharing_enabled=data.get('is_data_sharing_enabled', True),
                last_activity_at=timezone.now(),
                last_user_ack_at=timezone.now(),
            )

        emit_safety_event(session, 'session_started', {'message': 'Safety mode enabled'})

        return Response({
            'message': 'Safety session started',
            'session': SafetySessionSerializer(session).data,
        }, status=status.HTTP_201_CREATED)


class SafetySessionStopView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, session_key):
        session = SafetySession.objects.filter(session_key=session_key, user=request.user, is_active=True).first()
        if not session:
            return Response({'error': 'Active safety session not found'}, status=status.HTTP_404_NOT_FOUND)

        session.is_active = False
        session.ended_at = timezone.now()
        session.status = SafetySession.STATUS_SAFE
        session.save(update_fields=['is_active', 'ended_at', 'status', 'updated_at'])

        emit_safety_event(session, 'session_stopped', {'message': 'Safety mode disabled'})
        return Response({'message': 'Safety session stopped'})


class SafetySessionPreferenceView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, session_key):
        session = SafetySession.objects.filter(session_key=session_key, user=request.user, is_active=True).first()
        if not session:
            return Response({'error': 'Active safety session not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = SafetyPreferenceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if 'is_tracking_enabled' in data:
            session.is_tracking_enabled = data['is_tracking_enabled']
        if 'is_data_sharing_enabled' in data:
            session.is_data_sharing_enabled = data['is_data_sharing_enabled']
        session.save(update_fields=['is_tracking_enabled', 'is_data_sharing_enabled', 'updated_at'])

        emit_safety_event(
            session,
            'session_preferences_updated',
            {
                'is_tracking_enabled': session.is_tracking_enabled,
                'is_data_sharing_enabled': session.is_data_sharing_enabled,
            },
        )

        return Response({'message': 'Preferences updated', 'session': SafetySessionSerializer(session).data})


class SafetyLocationUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, session_key):
        session = SafetySession.objects.filter(session_key=session_key, user=request.user, is_active=True).first()
        if not session:
            return Response({'error': 'Active safety session not found'}, status=status.HTTP_404_NOT_FOUND)

        if not session.is_tracking_enabled:
            return Response({'error': 'Tracking is disabled for this session'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = SafetyLocationUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        previous_point = session.location_points.order_by('-created_at').first()
        point = SafetyLocationPoint.objects.create(
            session=session,
            latitude=data['latitude'],
            longitude=data['longitude'],
            speed_mps=data.get('speed_mps'),
            accuracy_m=data.get('accuracy_m'),
            heading=data.get('heading'),
            source=data.get('source', SafetyLocationPoint.SOURCE_GPS),
            client_timestamp=data.get('client_timestamp'),
        )

        now = timezone.now()
        session.latest_latitude = point.latitude
        session.latest_longitude = point.longitude
        session.latest_speed_mps = point.speed_mps
        session.latest_accuracy_m = point.accuracy_m
        session.latest_heading = point.heading
        session.latest_point_at = point.created_at
        session.last_activity_at = now if data.get('app_active', True) else session.last_activity_at
        session.save(update_fields=[
            'latest_latitude', 'latest_longitude', 'latest_speed_mps', 'latest_accuracy_m',
            'latest_heading', 'latest_point_at', 'last_activity_at', 'updated_at'
        ])

        risks = evaluate_risk(session, previous_point, point, app_active=data.get('app_active', True))

        emit_safety_event(
            session,
            'location_update',
            {
                'latitude': point.latitude,
                'longitude': point.longitude,
                'speed_mps': point.speed_mps,
                'accuracy_m': point.accuracy_m,
                'heading': point.heading,
                'timestamp': point.created_at.isoformat(),
                'risk_count': len(risks),
            },
        )

        return Response({
            'message': 'Location update received',
            'status': session.status,
            'risks': SafetyRiskEventSerializer(risks, many=True).data,
        })


class SafetySOSView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, session_key):
        session = SafetySession.objects.filter(session_key=session_key, user=request.user, is_active=True).first()
        if not session:
            return Response({'error': 'Active safety session not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = SafetySOSSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        incident = create_incident(
            session,
            trigger=SafetyIncident.TRIGGER_SOS,
            emergency_type=data.get('emergency_type', 'general'),
            notes=data.get('notes', ''),
        )

        SafetyRiskEvent.objects.create(
            session=session,
            risk_type=SafetyRiskEvent.TYPE_MANUAL_SOS,
            severity=SafetyRiskEvent.SEVERITY_CRITICAL,
            message='User manually triggered SOS.',
            latitude=session.latest_latitude,
            longitude=session.latest_longitude,
            requires_user_ack=False,
        )

        emit_safety_event(
            session,
            'sos_triggered',
            {
                'incident_id': incident.id,
                'emergency_type': incident.emergency_type,
                'notes': incident.notes,
                'time': incident.created_at.isoformat(),
                'latitude': session.latest_latitude,
                'longitude': session.latest_longitude,
                'user_email': session.user.email,
            },
        )

        return Response({'message': 'SOS triggered', 'incident': SafetyIncidentSerializer(incident).data})


class SafetyAcknowledgeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, session_key):
        session = SafetySession.objects.filter(session_key=session_key, user=request.user, is_active=True).first()
        if not session:
            return Response({'error': 'Active safety session not found'}, status=status.HTTP_404_NOT_FOUND)

        session.status = SafetySession.STATUS_SAFE
        session.last_user_ack_at = timezone.now()
        session.save(update_fields=['status', 'last_user_ack_at', 'updated_at'])

        session.risk_events.filter(is_resolved=False, requires_user_ack=True).update(
            is_resolved=True,
            resolved_at=timezone.now(),
        )

        emit_safety_event(session, 'user_acknowledged_safe', {'message': 'User marked as safe'})

        return Response({'message': 'Acknowledged. Session marked safe.'})


class UserActiveSafetySessionView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        session = SafetySession.objects.filter(user=request.user, is_active=True).order_by('-started_at').first()
        if not session:
            return Response({'active': False, 'session': None})
        return Response({'active': True, 'session': SafetySessionSerializer(session).data})


class SafetyTimelineView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, session_key):
        session = SafetySession.objects.filter(session_key=session_key, user=request.user).first()
        if not session:
            return Response({'error': 'Safety session not found'}, status=status.HTTP_404_NOT_FOUND)

        points = session.location_points.order_by('-created_at')[:200]
        risks = session.risk_events.order_by('-created_at')[:100]
        incidents = session.incidents.order_by('-created_at')[:20]

        return Response({
            'session': SafetySessionSerializer(session).data,
            'movement_history': SafetyLocationPointSerializer(points, many=True).data,
            'risk_events': SafetyRiskEventSerializer(risks, many=True).data,
            'incidents': SafetyIncidentSerializer(incidents, many=True).data,
        })


class AdminLiveSafetyView(APIView):
    permission_classes = [IsAuthenticated, IsStaffUser]

    def get(self, request):
        sessions = SafetySession.objects.filter(is_active=True).select_related('user').order_by('-updated_at')[:300]
        incidents = SafetyIncident.objects.filter(status__in=[SafetyIncident.STATUS_OPEN, SafetyIncident.STATUS_ACKNOWLEDGED]).select_related('user', 'session')[:100]

        data = []
        for s in sessions:
            data.append({
                'session_key': str(s.session_key),
                'user_id': s.user_id,
                'user_email': s.user.email,
                'status': s.status,
                'latitude': s.latest_latitude,
                'longitude': s.latest_longitude,
                'updated_at': s.updated_at,
                'is_tracking_enabled': s.is_tracking_enabled,
                'is_data_sharing_enabled': s.is_data_sharing_enabled,
            })

        return Response({
            'active_sessions': data,
            'open_incidents': SafetyIncidentSerializer(incidents, many=True).data,
        })


class AdminIncidentActionView(APIView):
    permission_classes = [IsAuthenticated, IsStaffUser]

    def post(self, request, incident_id):
        action = request.data.get('action')
        incident = SafetyIncident.objects.filter(id=incident_id).first()
        if not incident:
            return Response({'error': 'Incident not found'}, status=status.HTTP_404_NOT_FOUND)

        if action == 'ack':
            incident.acknowledge()
        elif action == 'resolve':
            incident.resolve()
        else:
            return Response({'error': 'Unsupported action'}, status=status.HTTP_400_BAD_REQUEST)

        emit_safety_event(
            incident.session,
            'incident_status_updated',
            {'incident_id': incident.id, 'status': incident.status},
        )

        return Response({'message': 'Incident updated', 'incident': SafetyIncidentSerializer(incident).data})
