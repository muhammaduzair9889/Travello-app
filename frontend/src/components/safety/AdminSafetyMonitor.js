import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import { AlertTriangle, Activity, Siren, Shield, Clock } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { safetyAPI, WS_BASE_URL } from '../../services/api';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const statusColor = (status) => {
  if (status === 'SOS') return 'bg-red-100 text-red-700';
  if (status === 'RISK') return 'bg-amber-100 text-amber-700';
  return 'bg-emerald-100 text-emerald-700';
};

const keyFor = (session) => String(session.session_key || '');

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 15000];
const PING_INTERVAL_MS = 25000;

const AdminSafetyMonitor = () => {
  const [activeSessions, setActiveSessions] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const pingTimerRef = useRef(null);
  const unmountedRef = useRef(false);

  const mapCenter = useMemo(() => {
    const first = activeSessions.find((s) => s.latitude && s.longitude);
    if (!first) return [31.5497, 74.3436];
    return [first.latitude, first.longitude];
  }, [activeSessions]);

  const hydrateLive = async () => {
    try {
      const res = await safetyAPI.adminLive();
      setActiveSessions(res?.data?.active_sessions || []);
      setIncidents(res?.data?.open_incidents || []);
    } catch (err) {
      console.error('Safety admin live fetch failed', err);
    }
  };

  const upsertSession = (payload) => {
    if (!payload?.session_key) return;
    setActiveSessions((prev) => {
      const current = [...prev];
      const idx = current.findIndex((s) => keyFor(s) === String(payload.session_key));
      const next = {
        ...current[idx],
        session_key: payload.session_key,
        user_id: payload.user_id,
        user_email: payload.user_email || current[idx]?.user_email,
        status: payload.status || current[idx]?.status || 'SAFE',
        latitude: payload.latitude ?? current[idx]?.latitude,
        longitude: payload.longitude ?? current[idx]?.longitude,
        updated_at: payload.timestamp || payload.updated_at || new Date().toISOString(),
      };

      if (idx >= 0) current[idx] = next;
      else current.unshift(next);
      return current.slice(0, 300);
    });
  };

  const removeSession = (sessionKey) => {
    setActiveSessions((prev) => prev.filter((s) => keyFor(s) !== String(sessionKey)));
  };

  const upsertIncident = (inc) => {
    if (!inc?.id) return;
    setIncidents((prev) => {
      const copy = [...prev];
      const idx = copy.findIndex((i) => i.id === inc.id);
      if (idx >= 0) copy[idx] = { ...copy[idx], ...inc };
      else copy.unshift(inc);
      return copy.slice(0, 120);
    });
  };

  const startPing = (ws) => {
    clearInterval(pingTimerRef.current);
    pingTimerRef.current = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, PING_INTERVAL_MS);
  };

  const scheduleReconnect = () => {
    if (unmountedRef.current) return;
    clearTimeout(reconnectTimerRef.current);
    const delay = RECONNECT_DELAYS[Math.min(reconnectAttemptRef.current, RECONNECT_DELAYS.length - 1)];
    reconnectAttemptRef.current += 1;
    reconnectTimerRef.current = setTimeout(() => {
      if (!unmountedRef.current) connect();
    }, delay);
  };

  const connect = () => {
    const token = localStorage.getItem('admin_access_token') || localStorage.getItem('access_token');
    if (!token) return;

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    clearInterval(pingTimerRef.current);

    const ws = new WebSocket(`${WS_BASE_URL}/ws/safety/admin/?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      reconnectAttemptRef.current = 0;
      startPing(ws);
    };

    ws.onclose = (e) => {
      setConnected(false);
      clearInterval(pingTimerRef.current);
      // Don't reconnect on auth failures (4003) or if unmounted
      if (e.code !== 4003 && !unmountedRef.current) {
        scheduleReconnect();
      }
    };

    ws.onerror = () => {
      // onclose will fire after onerror, reconnection handled there
    };

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        const evt = parsed?.event;
        const payload = parsed?.payload || {};

        if (evt === 'pong') return;

        if (evt === 'session_started') upsertSession(payload);
        if (evt === 'session_stopped') removeSession(payload.session_key);
        if (evt === 'location_update' || evt === 'risk_event' || evt === 'sos_triggered') upsertSession(payload);

        if (evt === 'incident_opened' && payload.incident) {
          upsertIncident(payload.incident);
        }
        if (evt === 'incident_status_updated' && payload.incident_id) {
          upsertIncident({ id: payload.incident_id, status: payload.status });
        }
      } catch (err) {
        console.error('Admin safety websocket parse error', err);
      }
    };
  };

  useEffect(() => {
    unmountedRef.current = false;
    hydrateLive();
    connect();

    return () => {
      unmountedRef.current = true;
      clearTimeout(reconnectTimerRef.current);
      clearInterval(pingTimerRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const safeCount = activeSessions.filter((s) => s.status === 'SAFE').length;
  const riskCount = activeSessions.filter((s) => s.status === 'RISK').length;
  const sosCount = activeSessions.filter((s) => s.status === 'SOS').length;

  const handleIncidentAction = async (incidentId, action) => {
    try {
      await safetyAPI.adminIncidentAction(incidentId, action);
      setIncidents((prev) => prev.map((i) => (i.id === incidentId ? { ...i, status: action === 'ack' ? 'ACKNOWLEDGED' : 'RESOLVED' } : i)));
    } catch (err) {
      console.error('Incident action failed', err);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 sm:p-5 mb-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-sky-600" /> Real-Time Safety Monitor
          </h3>
          <p className="text-xs text-slate-500 mt-1">Live tracking + risk + SOS stream (no polling)</p>
        </div>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${connected ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
          {connected ? 'WebSocket Connected' : 'WebSocket Disconnected'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-xl bg-emerald-50 p-3">
          <p className="text-[11px] text-emerald-600">Safe</p>
          <p className="text-xl font-bold text-emerald-700">{safeCount}</p>
        </div>
        <div className="rounded-xl bg-amber-50 p-3">
          <p className="text-[11px] text-amber-600">Risk</p>
          <p className="text-xl font-bold text-amber-700">{riskCount}</p>
        </div>
        <div className="rounded-xl bg-red-50 p-3">
          <p className="text-[11px] text-red-600">SOS</p>
          <p className="text-xl font-bold text-red-700">{sosCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 h-72">
          <MapContainer center={mapCenter} zoom={12} className="h-full w-full" scrollWheelZoom>
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
            />
            {activeSessions
              .filter((s) => s.latitude && s.longitude)
              .map((s) => (
                <Marker key={s.session_key} position={[s.latitude, s.longitude]}>
                  <Popup>
                    <div className="text-xs">
                      <p className="font-semibold">{s.user_email || `User #${s.user_id}`}</p>
                      <p>Status: {s.status}</p>
                      <p>Updated: {new Date(s.updated_at).toLocaleTimeString()}</p>
                    </div>
                  </Popup>
                </Marker>
              ))}
          </MapContainer>
        </div>

        <div className="lg:col-span-2 space-y-3 max-h-72 overflow-auto pr-1">
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
            <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-1">
              <Activity className="w-4 h-4" /> Active Users
            </h4>
            <div className="space-y-2">
              {activeSessions.slice(0, 8).map((s) => (
                <div key={s.session_key} className="text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{s.user_email || `User #${s.user_id}`}</p>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColor(s.status)}`}>{s.status}</span>
                  </div>
                  <p className="text-slate-500 mt-1 flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(s.updated_at).toLocaleTimeString()}</p>
                </div>
              ))}
              {!activeSessions.length && <p className="text-xs text-slate-400">No active safety sessions.</p>}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
            <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-1">
              <Siren className="w-4 h-4" /> Open Incidents
            </h4>
            <div className="space-y-2">
              {incidents.slice(0, 8).map((inc) => (
                <div key={inc.id} className="text-xs p-2 rounded-lg bg-red-50 border border-red-100">
                  <p className="font-semibold text-red-700">#{inc.id} • {inc.trigger}</p>
                  <p className="text-red-600">{inc.emergency_type}</p>
                  <p className="text-red-500">{new Date(inc.created_at).toLocaleString()}</p>
                  <div className="flex gap-2 mt-2">
                    {inc.status === 'OPEN' && (
                      <button onClick={() => handleIncidentAction(inc.id, 'ack')} className="px-2 py-1 rounded bg-amber-500 text-white">Acknowledge</button>
                    )}
                    {inc.status !== 'RESOLVED' && (
                      <button onClick={() => handleIncidentAction(inc.id, 'resolve')} className="px-2 py-1 rounded bg-emerald-600 text-white">Resolve</button>
                    )}
                  </div>
                </div>
              ))}
              {!incidents.length && <p className="text-xs text-slate-400">No open incidents.</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 text-[11px] text-slate-500 flex items-center gap-1">
        <AlertTriangle className="w-3 h-3" />
        Risk alerts are AI-assisted heuristics and should be treated as decision support.
      </div>
    </div>
  );
};

export default AdminSafetyMonitor;
