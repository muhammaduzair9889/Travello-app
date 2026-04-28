import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, Popup } from 'react-leaflet';
import { AlertTriangle, ShieldCheck, ShieldAlert, ShieldX, Navigation } from 'lucide-react';

import { safetyAPI, WS_BASE_URL } from '../../services/api';

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 15000];
const PING_INTERVAL_MS = 25000;

const STATUS_META = {
  SAFE: { label: 'Safe', className: 'bg-emerald-100 text-emerald-700' },
  RISK: { label: 'Risk Detected', className: 'bg-amber-100 text-amber-700' },
  SOS: { label: 'SOS Triggered', className: 'bg-red-100 text-red-700' },
};

const toPoint = (lat, lng) => [Number(lat), Number(lng)];

const LiveSafetyWidget = () => {
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState('SAFE');
  const [trackingEnabled, setTrackingEnabled] = useState(true);
  const [sharingEnabled, setSharingEnabled] = useState(true);
  const [sending, setSending] = useState(false);
  const [path, setPath] = useState([]);
  const [riskPrompt, setRiskPrompt] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const wsRef = useRef(null);
  const geoWatchIdRef = useRef(null);
  const lastPushRef = useRef(0);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const pingTimerRef = useRef(null);
  const unmountedRef = useRef(false);
  const activeSessionKeyRef = useRef(null);

  const statusMeta = STATUS_META[status] || STATUS_META.SAFE;

  const currentPoint = useMemo(() => {
    if (path.length) return path[path.length - 1];
    if (session?.latest_latitude && session?.latest_longitude) {
      return toPoint(session.latest_latitude, session.latest_longitude);
    }
    return null;
  }, [path, session]);

  const closeSocket = () => {
    clearInterval(pingTimerRef.current);
    clearTimeout(reconnectTimerRef.current);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    activeSessionKeyRef.current = null;
  };

  const stopGeolocation = () => {
    if (geoWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(geoWatchIdRef.current);
      geoWatchIdRef.current = null;
    }
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
    if (unmountedRef.current || !activeSessionKeyRef.current) return;
    clearTimeout(reconnectTimerRef.current);
    const delay = RECONNECT_DELAYS[Math.min(reconnectAttemptRef.current, RECONNECT_DELAYS.length - 1)];
    reconnectAttemptRef.current += 1;
    reconnectTimerRef.current = setTimeout(() => {
      if (!unmountedRef.current && activeSessionKeyRef.current) {
        connectSocket(activeSessionKeyRef.current);
      }
    }, delay);
  };

  const connectSocket = (sessionKey) => {
    const token = localStorage.getItem('access_token');
    if (!token || !sessionKey) return;

    closeSocket();
    activeSessionKeyRef.current = sessionKey;
    const ws = new WebSocket(`${WS_BASE_URL}/ws/safety/user/${sessionKey}/?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttemptRef.current = 0;
      startPing(ws);
    };

    ws.onclose = (e) => {
      clearInterval(pingTimerRef.current);
      // Don't reconnect on auth/not-found failures or if unmounted
      if (![4001, 4003, 4004].includes(e.code) && !unmountedRef.current && activeSessionKeyRef.current) {
        scheduleReconnect();
      }
    };

    ws.onerror = () => {
      // onclose will fire after onerror, reconnection handled there
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const evt = payload?.event;
        const data = payload?.payload || {};

        if (evt === 'pong') return;

        if (data.status) setStatus(data.status);
        if (evt === 'location_update' && data.latitude && data.longitude) {
          setPath((prev) => [...prev.slice(-59), toPoint(data.latitude, data.longitude)]);
          setLastUpdated(data.timestamp || new Date().toISOString());
        }
        if (evt === 'risk_event') {
          setRiskPrompt(data.prompt || 'We detected unusual activity. Are you safe?');
        }
        if (evt === 'user_acknowledged_safe') {
          setRiskPrompt('');
        }
      } catch (err) {
        console.error('Safety websocket parse error', err);
      }
    };
  };

  const pushLocation = async (coords) => {
    if (!session?.session_key || !trackingEnabled || !sharingEnabled) return;

    const now = Date.now();
    if (now - lastPushRef.current < 7000) return;
    lastPushRef.current = now;

    try {
      setSending(true);
      await safetyAPI.pushLocation(session.session_key, {
        latitude: coords.latitude,
        longitude: coords.longitude,
        speed_mps: coords.speed,
        accuracy_m: coords.accuracy,
        heading: coords.heading,
        source: 'GPS',
        app_active: !document.hidden,
      });
      const nextPoint = toPoint(coords.latitude, coords.longitude);
      setPath((prev) => [...prev.slice(-59), nextPoint]);
      setLastUpdated(new Date().toISOString());
    } catch (err) {
      console.error('Location push failed', err);
    } finally {
      setSending(false);
    }
  };

  const startGeolocation = () => {
    if (!navigator.geolocation) return;
    stopGeolocation();

    geoWatchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        pushLocation(position.coords);
      },
      (error) => {
        console.error('Geolocation error', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 1000,
      }
    );
  };

  const bootSession = async () => {
    try {
      const active = await safetyAPI.getActiveSession();
      if (active?.data?.active && active?.data?.session) {
        const existing = active.data.session;
        setSession(existing);
        setStatus(existing.status || 'SAFE');
        setTrackingEnabled(Boolean(existing.is_tracking_enabled));
        setSharingEnabled(Boolean(existing.is_data_sharing_enabled));
        connectSocket(existing.session_key);
        if (existing.is_tracking_enabled && existing.is_data_sharing_enabled) startGeolocation();
      }
    } catch (err) {
      console.error('Failed to load active safety session', err);
    }
  };

  useEffect(() => {
    unmountedRef.current = false;
    bootSession();
    return () => {
      unmountedRef.current = true;
      stopGeolocation();
      closeSocket();
    };
  }, []);

  const handleStartSafety = async () => {
    try {
      const res = await safetyAPI.startSession({
        is_tracking_enabled: trackingEnabled,
        is_data_sharing_enabled: sharingEnabled,
      });
      const created = res?.data?.session;
      if (!created) return;
      setSession(created);
      setStatus(created.status || 'SAFE');
      setPath([]);
      setRiskPrompt('');
      connectSocket(created.session_key);
      if (trackingEnabled && sharingEnabled) startGeolocation();
    } catch (err) {
      console.error('Failed to start safety mode', err);
      alert(err?.message || 'Unable to start safety mode.');
    }
  };

  const handleStopSafety = async () => {
    if (!session?.session_key) return;
    try {
      await safetyAPI.stopSession(session.session_key);
      stopGeolocation();
      closeSocket();
      setSession(null);
      setStatus('SAFE');
      setRiskPrompt('');
      setPath([]);
    } catch (err) {
      console.error('Failed to stop safety mode', err);
    }
  };

  const handleSOS = async () => {
    if (!session?.session_key) {
      alert('Start Safety Mode first.');
      return;
    }

    try {
      await safetyAPI.triggerSOS(session.session_key, {
        emergency_type: 'general',
        notes: 'Triggered from SOS widget',
      });
      setStatus('SOS');
      window.location.href = 'tel:1122';
    } catch (err) {
      console.error('SOS failed', err);
      alert('Unable to trigger SOS. Please call 1122 directly.');
    }
  };

  const handleAcknowledgeSafe = async () => {
    if (!session?.session_key) return;
    try {
      await safetyAPI.acknowledgeSafe(session.session_key);
      setStatus('SAFE');
      setRiskPrompt('');
    } catch (err) {
      console.error('Acknowledge failed', err);
    }
  };

  const handlePreferenceUpdate = async (next) => {
    if (!session?.session_key) return;
    try {
      await safetyAPI.updatePreferences(session.session_key, next);
      if (typeof next.is_tracking_enabled === 'boolean') setTrackingEnabled(next.is_tracking_enabled);
      if (typeof next.is_data_sharing_enabled === 'boolean') setSharingEnabled(next.is_data_sharing_enabled);

      const tracking = typeof next.is_tracking_enabled === 'boolean' ? next.is_tracking_enabled : trackingEnabled;
      const sharing = typeof next.is_data_sharing_enabled === 'boolean' ? next.is_data_sharing_enabled : sharingEnabled;
      if (tracking && sharing) startGeolocation();
      else stopGeolocation();
    } catch (err) {
      console.error('Preference update failed', err);
    }
  };

  return (
    <div className="card p-5 mb-4 border border-red-200 dark:border-red-900/40">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h4 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Navigation className="w-4 h-4 text-red-500" /> Live Safety Mode
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Uber-style background safety tracking with AI risk detection.
          </p>
        </div>
        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${statusMeta.className}`}>
          {statusMeta.label}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
        <label className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-surface-800 text-sm">
          <span className="text-gray-700 dark:text-gray-300">Tracking enabled</span>
          <input
            type="checkbox"
            checked={trackingEnabled}
            onChange={(e) => {
              const checked = e.target.checked;
              setTrackingEnabled(checked);
              if (session) handlePreferenceUpdate({ is_tracking_enabled: checked });
            }}
          />
        </label>
        <label className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-surface-800 text-sm">
          <span className="text-gray-700 dark:text-gray-300">Share live data with monitoring</span>
          <input
            type="checkbox"
            checked={sharingEnabled}
            onChange={(e) => {
              const checked = e.target.checked;
              setSharingEnabled(checked);
              if (session) handlePreferenceUpdate({ is_data_sharing_enabled: checked });
            }}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        {!session && (
          <button onClick={handleStartSafety} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold">
            Enable Safety Mode
          </button>
        )}
        {session && (
          <button onClick={handleStopSafety} className="px-4 py-2 rounded-xl bg-gray-700 hover:bg-gray-800 text-white text-sm font-semibold">
            Stop Safety Mode
          </button>
        )}
        <button onClick={handleSOS} className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold">
          Trigger SOS Now
        </button>
        {riskPrompt && (
          <button onClick={handleAcknowledgeSafe} className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold">
            I'm Safe
          </button>
        )}
      </div>

      {riskPrompt && (
        <div className="mt-3 p-3 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 text-sm flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 mt-0.5" />
          <span>{riskPrompt}</span>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        {status === 'SAFE' && <ShieldCheck className="w-4 h-4 text-emerald-500" />}
        {status === 'RISK' && <ShieldAlert className="w-4 h-4 text-amber-500" />}
        {status === 'SOS' && <ShieldX className="w-4 h-4 text-red-500" />}
        <span>
          {sending ? 'Sending location updates...' : 'Location updates every 5-10 seconds while active.'}
          {lastUpdated ? ` Last update: ${new Date(lastUpdated).toLocaleTimeString()}` : ''}
        </span>
      </div>

      {currentPoint && (
        <div className="mt-4 h-56 rounded-xl overflow-hidden border border-gray-200 dark:border-surface-700">
          <MapContainer center={currentPoint} zoom={15} className="h-full w-full" scrollWheelZoom>
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
            />
            <Marker position={currentPoint}>
              <Popup>You are here</Popup>
            </Marker>
            {path.length > 1 && <Polyline positions={path} color='#dc2626' weight={4} opacity={0.8} />}
          </MapContainer>
        </div>
      )}

      {!currentPoint && (
        <div className="mt-4 p-3 rounded-lg bg-gray-50 dark:bg-surface-800 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Start Safety Mode and allow location permission to see live tracking.
        </div>
      )}
    </div>
  );
};

export default LiveSafetyWidget;
