import logging
import math
from datetime import timedelta

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.utils import timezone

from .models import SafetySession, SafetyRiskEvent, SafetyIncident

logger = logging.getLogger(__name__)


HIGH_RISK_ZONES = [
    {'name': 'Shahdara Outskirts', 'lat': 31.6372, 'lng': 74.2917, 'radius_m': 1500},
    {'name': 'Canal Belt Sparse Area', 'lat': 31.4980, 'lng': 74.3450, 'radius_m': 1300},
]


def haversine_m(lat1, lng1, lat2, lng2):
    r = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)

    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlng / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c


def _broadcast(group_name, event_name, payload):
    channel_layer = get_channel_layer()
    if not channel_layer:
        return
    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            'type': 'safety.event',
            'event': event_name,
            'payload': payload,
        }
    )


def broadcast_user(session_key, event_name, payload):
    _broadcast(f'safety_user_{session_key}', event_name, payload)


def broadcast_admin(event_name, payload):
    _broadcast('safety_admin', event_name, payload)


def emit_safety_event(session, event_name, payload):
    base_payload = {
        'session_key': str(session.session_key),
        'user_id': session.user_id,
        'status': session.status,
    }
    base_payload.update(payload or {})
    broadcast_user(session.session_key, event_name, base_payload)
    broadcast_admin(event_name, base_payload)


def _recent_similar_risk_exists(session, risk_type, lookback_seconds=180):
    threshold = timezone.now() - timedelta(seconds=lookback_seconds)
    return SafetyRiskEvent.objects.filter(
        session=session,
        risk_type=risk_type,
        created_at__gte=threshold,
        is_resolved=False,
    ).exists()


def create_risk_event(session, risk_type, severity, message, latitude=None, longitude=None, metadata=None, requires_user_ack=True):
    risk = SafetyRiskEvent.objects.create(
        session=session,
        risk_type=risk_type,
        severity=severity,
        message=message,
        latitude=latitude,
        longitude=longitude,
        metadata=metadata or {},
        requires_user_ack=requires_user_ack,
    )

    if severity in {SafetyRiskEvent.SEVERITY_HIGH, SafetyRiskEvent.SEVERITY_CRITICAL}:
        session.status = SafetySession.STATUS_RISK
        session.save(update_fields=['status', 'updated_at'])

    emit_safety_event(
        session,
        'risk_event',
        {
            'risk': {
                'id': risk.id,
                'type': risk.risk_type,
                'severity': risk.severity,
                'message': risk.message,
                'latitude': risk.latitude,
                'longitude': risk.longitude,
                'created_at': risk.created_at.isoformat(),
            },
            'prompt': 'We detected unusual activity. Are you safe?',
        },
    )
    return risk


def create_incident(session, trigger, emergency_type='general', notes=''):
    incident = SafetyIncident.objects.create(
        session=session,
        user=session.user,
        trigger=trigger,
        emergency_type=emergency_type,
        notes=notes,
        latitude=session.latest_latitude,
        longitude=session.latest_longitude,
    )

    session.status = SafetySession.STATUS_SOS if trigger == SafetyIncident.TRIGGER_SOS else SafetySession.STATUS_RISK
    session.save(update_fields=['status', 'updated_at'])

    emit_safety_event(
        session,
        'incident_opened',
        {
            'incident': {
                'id': incident.id,
                'trigger': incident.trigger,
                'status': incident.status,
                'emergency_type': incident.emergency_type,
                'notes': incident.notes,
                'latitude': incident.latitude,
                'longitude': incident.longitude,
                'created_at': incident.created_at.isoformat(),
            }
        },
    )
    return incident


def evaluate_risk(session, previous_point, current_point, app_active=True):
    now = timezone.now()
    risks = []

    if previous_point:
        step_distance_m = haversine_m(
            previous_point.latitude,
            previous_point.longitude,
            current_point.latitude,
            current_point.longitude,
        )
        delta_seconds = max((current_point.created_at - previous_point.created_at).total_seconds(), 1)
        effective_speed = step_distance_m / delta_seconds

        if step_distance_m >= 500 and delta_seconds <= 20 and not _recent_similar_risk_exists(session, SafetyRiskEvent.TYPE_ROUTE_DEVIATION, 180):
            risks.append(
                create_risk_event(
                    session,
                    SafetyRiskEvent.TYPE_ROUTE_DEVIATION,
                    SafetyRiskEvent.SEVERITY_HIGH,
                    'Unusual route deviation detected from expected movement corridor.',
                    current_point.latitude,
                    current_point.longitude,
                    metadata={'step_distance_m': round(step_distance_m, 2), 'delta_seconds': delta_seconds, 'speed_mps': round(effective_speed, 2)},
                )
            )

        if step_distance_m >= 30:
            session.last_moved_at = now

    if not session.last_moved_at:
        session.last_moved_at = now

    if (now - session.last_moved_at).total_seconds() > 180 and not _recent_similar_risk_exists(session, SafetyRiskEvent.TYPE_ABNORMAL_STOP, 300):
        risks.append(
            create_risk_event(
                session,
                SafetyRiskEvent.TYPE_ABNORMAL_STOP,
                SafetyRiskEvent.SEVERITY_MEDIUM,
                'User appears stationary for an unusual duration.',
                current_point.latitude,
                current_point.longitude,
            )
        )

    hour = now.hour
    for zone in HIGH_RISK_ZONES:
        zone_distance = haversine_m(current_point.latitude, current_point.longitude, zone['lat'], zone['lng'])
        if zone_distance <= zone['radius_m'] and (hour >= 22 or hour <= 5):
            if not _recent_similar_risk_exists(session, SafetyRiskEvent.TYPE_HIGH_RISK_ZONE, 600):
                risks.append(
                    create_risk_event(
                        session,
                        SafetyRiskEvent.TYPE_HIGH_RISK_ZONE,
                        SafetyRiskEvent.SEVERITY_HIGH,
                        f'Entered a high-risk area ({zone["name"]}) during late-night hours.',
                        current_point.latitude,
                        current_point.longitude,
                        metadata={'zone': zone['name'], 'distance_m': round(zone_distance, 2)},
                    )
                )
            break

    if not app_active and session.last_activity_at and (now - session.last_activity_at).total_seconds() > 120:
        if not _recent_similar_risk_exists(session, SafetyRiskEvent.TYPE_NO_ACTIVITY, 300):
            risks.append(
                create_risk_event(
                    session,
                    SafetyRiskEvent.TYPE_NO_ACTIVITY,
                    SafetyRiskEvent.SEVERITY_HIGH,
                    'Tracking is active but app appears inactive for too long.',
                    current_point.latitude,
                    current_point.longitude,
                )
            )

    session.save(update_fields=['last_moved_at', 'updated_at'])
    return risks


def escalate_pending_risks(max_risk_age_seconds=120):
    threshold = timezone.now() - timedelta(seconds=max_risk_age_seconds)
    sessions = SafetySession.objects.filter(is_active=True, status=SafetySession.STATUS_RISK)
    escalated_count = 0

    for session in sessions:
        pending_high_risk = session.risk_events.filter(
            is_resolved=False,
            severity__in=[SafetyRiskEvent.SEVERITY_HIGH, SafetyRiskEvent.SEVERITY_CRITICAL],
            created_at__lte=threshold,
        ).exists()

        if not pending_high_risk:
            continue

        if session.last_user_ack_at and session.last_user_ack_at >= threshold:
            continue

        already_escalated = session.incidents.filter(
            trigger=SafetyIncident.TRIGGER_AI,
            status__in=[SafetyIncident.STATUS_OPEN, SafetyIncident.STATUS_ACKNOWLEDGED],
        ).exists()
        if already_escalated:
            continue

        create_risk_event(
            session,
            SafetyRiskEvent.TYPE_SYSTEM_ESCALATION,
            SafetyRiskEvent.SEVERITY_CRITICAL,
            'No user confirmation received. Escalating to incident response.',
            session.latest_latitude,
            session.latest_longitude,
            requires_user_ack=False,
        )
        create_incident(
            session,
            SafetyIncident.TRIGGER_AI,
            emergency_type='ai-risk-escalation',
            notes='Automated escalation after unacknowledged risk signals.',
        )
        escalated_count += 1

    if escalated_count:
        logger.info('Escalated %s pending safety sessions', escalated_count)
    return escalated_count
