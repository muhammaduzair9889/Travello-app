import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaHotel, FaBook, FaSignOutAlt, FaBars, FaChartLine, FaMoneyBillWave,
  FaPercentage, FaArrowUp, FaArrowDown, FaSyncAlt, FaTimesCircle,
  FaUsers, FaBrain, FaBell
} from 'react-icons/fa';
import { bookingAPI, hotelAPI } from '../services/api';
import WeatherWidget from './WeatherWidget';
import AdminSafetyMonitor from './safety/AdminSafetyMonitor';
import {
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, RadialBarChart, RadialBar, FunnelChart, Funnel, LabelList
} from 'recharts';

/* ─── Color Palette ─── */
const STATUS_COLORS = { PAID: '#22c55e', CONFIRMED: '#3b82f6', COMPLETED: '#6366f1', PENDING: '#f59e0b', CANCELLED: '#ef4444' };
const STATUS_LABELS = { PAID: 'Paid', CONFIRMED: 'Confirmed', COMPLETED: 'Completed', PENDING: 'Pending', CANCELLED: 'Cancelled' };

/* ─── Chart Tooltip ─── */
const ChartTooltip = ({ active, payload, label, prefix = '' }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 dark:text-gray-200 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="flex justify-between gap-4">
          <span>{p.name}:</span>
          <span className="font-bold">{prefix}{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</span>
        </p>
      ))}
    </div>
  );
};

/* ─── Period Filter ─── */
const PERIODS = [
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
  { value: '1y', label: '1 Year' },
  { value: 'all', label: 'All Time' },
];

/* ─── Format helpers ─── */
const fmtPKR = (v) => `PKR ${Number(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtShort = (v) => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v?.toString() || '0';
};
const fmtDate = (d) => {
  if (!d) return '';
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const NoDataState = ({ text = 'No data available for this period' }) => (
  <div className="h-full min-h-[220px] flex items-center justify-center text-xs text-gray-400 dark:text-gray-500">
    {text}
  </div>
);

/* ════════════════════════════════════════════════════
   ADMIN DASHBOARD
════════════════════════════════════════════════════ */
const AdminDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState('30d');
  const [hotelFilter, setHotelFilter] = useState('');
  const [hotels, setHotels] = useState([]);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // overview | manage
  const [topHotelMetric, setTopHotelMetric] = useState('revenue');
  const [topHotelsWindow, setTopHotelsWindow] = useState(10);
  const [occupancyTarget, setOccupancyTarget] = useState(80);

  /* ── Auth check ── */
  useEffect(() => {
    const isAdmin = localStorage.getItem('isAdmin') === 'true';
    if (!isAdmin) { navigate('/login'); return; }
    // Load fresh data initially for admin dashboard
    hotelAPI.getHotelsFresh().then(r => setHotels(r.data || [])).catch(() => {});
  }, [navigate]);

  // Auto-refresh hotel data every 30 seconds when on manage tab (real-time inventory updates)
  useEffect(() => {
    if (activeTab === 'manage') {
      // Fetch immediately when switching to manage tab
      hotelAPI.getHotelsFresh().then(r => setHotels(r.data || [])).catch(() => {});
      
      // Set up auto-refresh interval
      const interval = setInterval(() => {
        hotelAPI.getHotelsFresh().then(r => setHotels(r.data || [])).catch(() => {});
      }, 30000); // Refresh every 30 seconds
      
      // Clean up interval when switching away from manage tab
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  /* ── Fetch analytics ── */
  const fetchAnalytics = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    else setRefreshing(true);
    try {
      const params = {
        period,
        top_hotels_window: topHotelsWindow,
        occupancy_target: occupancyTarget,
      };
      if (hotelFilter) params.hotel = hotelFilter;
      const res = await bookingAPI.getAnalytics(params);
      setData(res.data);
    } catch (err) {
      console.error('Analytics error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period, hotelFilter, topHotelsWindow, occupancyTarget]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  const handleSignOut = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('admin_access_token');
    localStorage.removeItem('admin_refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('admin');
    localStorage.removeItem('isAdmin');
    navigate('/admin-login', { replace: true });
  };

  /* ── KPI data ── */
  const kpi = data?.kpi || {};

  /* ── Pie data ── */
  const statusPie = useMemo(() =>
    (data?.status_distribution || []).map(s => ({
      name: STATUS_LABELS[s.status] || s.status,
      value: s.count,
      revenue: s.revenue,
      color: STATUS_COLORS[s.status] || '#9ca3af',
    })), [data]);

  const paymentPie = useMemo(() =>
    (data?.payment_distribution || []).map(p => ({
      name: p.payment_method === 'ONLINE' ? 'Online Payment' : 'Pay on Arrival',
      value: p.count,
      revenue: p.revenue,
      color: p.payment_method === 'ONLINE' ? '#6366f1' : '#f59e0b',
    })), [data]);

  const bookingsTrend = useMemo(
    () => (data?.bookings_over_time || []).map(row => ({
      date: row.date,
      confirmed: Number(row.confirmed ?? row.paid ?? row.completed ?? 0),
      cancelled: Number(row.cancelled ?? 0),
      pending: Number(row.pending ?? 0),
    })),
    [data]
  );

  const bookingSourceDonut = useMemo(() => {
    const sourceColors = {
      web: '#0ea5e9',
      mobile: '#f97316',
      ai_recommendation: '#14b8a6',
      manual_search: '#8b5cf6',
    };
    const sourceLabels = {
      web: 'Web',
      mobile: 'Mobile',
      ai_recommendation: 'AI Recommendation',
      manual_search: 'Manual Search',
    };

    const src = data?.booking_source_distribution || [];
    return src.map((s) => {
      const raw = String(s.source || s.channel || '').toLowerCase().replace(/\s+/g, '_');
      const normalized = raw.includes('ai')
        ? 'ai_recommendation'
        : raw.includes('manual') || raw.includes('search')
          ? 'manual_search'
          : raw.includes('mobile')
            ? 'mobile'
            : 'web';

      return {
        name: sourceLabels[normalized],
        value: Number(s.count || s.bookings || 0),
        color: sourceColors[normalized],
      };
    });
  }, [data]);

  const aiBooked = useMemo(() => {
    const aiSlice = bookingSourceDonut.find(s => s.name === 'AI Recommendation');
    return Number(aiSlice?.value || data?.recommendation_funnel?.booked || 0);
  }, [bookingSourceDonut, data]);

  const ctrTrend = useMemo(() => {
    const raw = data?.recommendation_ctr_over_time || [];
    if (raw.length) {
      return raw.map((r) => ({
        date: r.date,
        ctr: Number(r.ctr ?? r.value ?? 0),
      }));
    }
    const fallbackCtr = Number(data?.recommendation_ctr || kpi.conversion_rate || 0);
    return (data?.revenue_over_time || []).map((r) => ({
      date: r.date,
      ctr: fallbackCtr,
    }));
  }, [data, kpi.conversion_rate]);

  const ctrDisplayValue = useMemo(() => {
    if (!ctrTrend.length) return 0;
    const latestNonZero = [...ctrTrend].reverse().find((r) => Number(r.ctr || 0) > 0);
    return Number(latestNonZero?.ctr ?? ctrTrend[ctrTrend.length - 1]?.ctr ?? 0);
  }, [ctrTrend]);

  const recommendationFunnel = useMemo(() => {
    const explicit = data?.recommendation_funnel;
    if (explicit) {
      return [
        { name: 'Recommended', value: Number(explicit.recommended || 0), fill: '#334155' },
        { name: 'Viewed', value: Number(explicit.viewed || 0), fill: '#0ea5e9' },
        { name: 'Booked', value: Number(explicit.booked || 0), fill: '#22c55e' },
      ];
    }

    const lastCtr = Number(ctrTrend[ctrTrend.length - 1]?.ctr || 0);
    const booked = aiBooked;
    const recommended = lastCtr > 0 ? Math.round(booked / (lastCtr / 100)) : booked;
    const viewed = Math.max(booked, Math.round(recommended * 0.55));

    return [
      { name: 'Recommended', value: recommended, fill: '#334155' },
      { name: 'Viewed', value: viewed, fill: '#0ea5e9' },
      { name: 'Booked', value: booked, fill: '#22c55e' },
    ];
  }, [data, ctrTrend, aiBooked]);

  const modelMetricsTrend = useMemo(() => {
    const raw = data?.model_metrics_over_time || [];
    if (raw.length) {
      return raw.map((r) => ({
        date: r.date,
        precision: Number(r.precision || 0),
        recall: Number(r.recall || 0),
        f1: Number(r.f1 || r.f1_score || 0),
      }));
    }

    const precision = Number(data?.model_metrics?.precision || 0);
    const recall = Number(data?.model_metrics?.recall || 0);
    const f1 = Number(data?.model_metrics?.f1 || data?.model_metrics?.f1_score || 0);

    return (data?.revenue_over_time || []).map((r) => ({
      date: r.date,
      precision,
      recall,
      f1,
    }));
  }, [data]);

  const occupancyRate = useMemo(
    () => clamp(Number(data?.occupancy_rate || kpi.occupancy_rate || 0), 0, 100),
    [data, kpi.occupancy_rate]
  );

  const occupancyGaugeData = useMemo(() => ([{ name: 'Occupancy', value: occupancyRate, fill: '#0284c7' }]), [occupancyRate]);

  const cancellationTrend = useMemo(() => {
    const raw = data?.refund_cancellation_trend || [];
    if (raw.length) {
      return raw.map((r) => ({
        date: r.date,
        cancelled: Number(r.cancelled || 0),
        refunded: Number(r.refunded || 0),
      }));
    }

    return (data?.bookings_over_time || []).map((r) => ({
      date: r.date,
      cancelled: Number(r.cancelled || 0),
      refunded: Number(r.refunded || 0),
    }));
  }, [data]);

  const topHotelsChartData = useMemo(() => {
    const rows = (data?.top_hotels || []).map((h) => ({
      name: h.name,
      revenue: Number(h.revenue || 0),
      bookings: Number(h.bookings || 0),
      conversion_rate: Number(h.conversion_rate || 0),
    }));

    const sorted = [...rows].sort((a, b) => Number(b[topHotelMetric] || 0) - Number(a[topHotelMetric] || 0));
    return sorted.slice(0, 8).reverse();
  }, [data, topHotelMetric]);

  const roomTypeHorizontal = useMemo(() => {
    const canonical = ['Single', 'Double', 'Family', 'Suite'];
    const rows = data?.room_type_distribution || [];
    return canonical.map((label) => {
      const found = rows.find((r) => String(r.type || '').toLowerCase() === label.toLowerCase());
      return { type: label, count: Number(found?.count || 0) };
    });
  }, [data]);

  const locationHeatmap = useMemo(() => {
    const rows = data?.customer_location_distribution || data?.location_distribution || [];
    const top = [...rows]
      .map((r) => ({
        place: r.city || r.country || r.location || 'Unknown',
        count: Number(r.count || r.bookings || 0),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const maxVal = Math.max(...top.map((t) => t.count), 1);
    return top.map((t) => ({
      ...t,
      intensity: clamp(t.count / maxVal, 0.08, 1),
    }));
  }, [data]);

  const bookingStatusCard = useMemo(() => {
    const status = data?.status_distribution || [];
    const lookup = status.reduce((acc, s) => {
      const key = String(s.status || '').toUpperCase();
      acc[key] = Number(s.count || 0);
      return acc;
    }, {});
    return {
      confirmed: lookup.CONFIRMED + lookup.PAID + lookup.COMPLETED,
      cancelled: lookup.CANCELLED,
      pending: lookup.PENDING,
    };
  }, [data]);

  const activeBookingsToday = useMemo(() => Number(data?.active_bookings_today || kpi.active_bookings_today || bookingStatusCard.confirmed || 0), [data, kpi.active_bookings_today, bookingStatusCard.confirmed]);

  const alerts = useMemo(() => {
    const out = [];
    const totalOps = bookingStatusCard.confirmed + bookingStatusCard.cancelled + bookingStatusCard.pending;
    const cancelRate = totalOps > 0 ? (bookingStatusCard.cancelled / totalOps) * 100 : 0;
    const ctrNow = Number(ctrTrend[ctrTrend.length - 1]?.ctr || 0);
    const ctrPrev = Number(ctrTrend[ctrTrend.length - 2]?.ctr || ctrNow);
    const modelNow = modelMetricsTrend[modelMetricsTrend.length - 1] || { precision: 0, recall: 0, f1: 0 };

    if (cancelRate >= 25) {
      out.push({ level: 'high', text: `High cancellation rate detected (${cancelRate.toFixed(1)}%)` });
    }
    if (occupancyRate < occupancyTarget) {
      out.push({ level: 'medium', text: `Low occupancy risk (${occupancyRate.toFixed(1)}%) vs target ${occupancyTarget.toFixed(0)}%` });
    }
    if (ctrNow < ctrPrev - 2) {
      out.push({ level: 'high', text: `Recommendation CTR dropped from ${ctrPrev.toFixed(1)}% to ${ctrNow.toFixed(1)}%` });
    }
    if (modelNow.f1 > 0 && modelNow.f1 < 0.6) {
      out.push({ level: 'medium', text: `Model F1 score below threshold (${modelNow.f1.toFixed(2)})` });
    }

    if (!out.length) {
      out.push({ level: 'ok', text: 'No critical operational alerts. System is stable.' });
    }

    return out;
  }, [bookingStatusCard, ctrTrend, occupancyRate, modelMetricsTrend, occupancyTarget]);

  const exportCsv = useCallback(() => {
    const lines = [];
    const add = (row = []) => lines.push(row.map((v) => {
      const cell = String(v ?? '').replace(/"/g, '""');
      return `"${cell}"`;
    }).join(','));

    add(['Travello Executive Analytics Report']);
    add(['Generated At', new Date().toISOString()]);
    add(['Period', period]);
    add(['Hotel Filter', hotelFilter || 'All Hotels']);
    add(['Top Hotels Window', topHotelsWindow]);
    add(['Occupancy Target', `${occupancyTarget}%`]);
    add([]);

    add(['KPIs']);
    add(['Total Revenue', kpi.total_revenue || 0]);
    add(['Total Bookings', kpi.total_bookings || 0]);
    add(['Conversion Rate %', kpi.conversion_rate || 0]);
    add(['Occupancy Rate %', occupancyRate]);
    add(['Active Bookings Today', activeBookingsToday]);
    add([]);

    add(['Recommendation Funnel']);
    add(['Recommended', recommendationFunnel[0]?.value || 0]);
    add(['Viewed', recommendationFunnel[1]?.value || 0]);
    add(['Booked', recommendationFunnel[2]?.value || 0]);
    add([]);

    add(['Top Hotels']);
    add(['Hotel', 'Revenue', 'Bookings', 'Conversion Rate']);
    (data?.top_hotels || []).forEach((h) => add([h.name, h.revenue, h.bookings, h.conversion_rate]));
    add([]);

    add(['CTR Over Time']);
    add(['Date', 'CTR %']);
    ctrTrend.forEach((r) => add([r.date, r.ctr]));
    add([]);

    add(['Model Metrics']);
    add(['Date', 'Precision', 'Recall', 'F1']);
    modelMetricsTrend.forEach((m) => add([m.date, m.precision, m.recall, m.f1]));
    add([]);

    add(['Refund & Cancellation Trend']);
    add(['Date', 'Cancelled', 'Refunded']);
    cancellationTrend.forEach((c) => add([c.date, c.cancelled, c.refunded]));

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `travello-analytics-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [
    period,
    hotelFilter,
    topHotelsWindow,
    occupancyTarget,
    kpi,
    occupancyRate,
    activeBookingsToday,
    recommendationFunnel,
    data,
    ctrTrend,
    modelMetricsTrend,
    cancellationTrend,
  ]);

  const exportPdf = useCallback(() => {
    const topRows = (data?.top_hotels || []).slice(0, topHotelsWindow)
      .map((h) => `<tr><td>${h.name}</td><td>${Number(h.revenue || 0).toLocaleString()}</td><td>${Number(h.bookings || 0).toLocaleString()}</td><td>${Number(h.conversion_rate || 0).toFixed(1)}%</td></tr>`)
      .join('');

    const alertRows = alerts.map((a) => `<li><strong>${a.level.toUpperCase()}</strong>: ${a.text}</li>`).join('');

    const html = `
      <html>
        <head>
          <title>Travello Executive Report</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 28px; color: #0f172a; }
            h1, h2 { margin: 0 0 10px 0; }
            h1 { font-size: 22px; }
            h2 { font-size: 15px; margin-top: 24px; }
            p, li { font-size: 12px; line-height: 1.5; }
            .meta { color: #475569; margin-bottom: 12px; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 12px 0; }
            .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; background: #f8fafc; }
            .k { font-size: 11px; color: #475569; }
            .v { font-size: 18px; font-weight: 700; margin-top: 3px; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th, td { border: 1px solid #cbd5e1; padding: 7px; font-size: 11px; text-align: left; }
            th { background: #e2e8f0; }
          </style>
        </head>
        <body>
          <h1>Travello Admin Executive Analytics Report</h1>
          <p class="meta">Generated: ${new Date().toLocaleString()} | Period: ${period} | Occupancy Target: ${occupancyTarget}% | Top Hotels Window: ${topHotelsWindow}</p>

          <div class="grid">
            <div class="card"><div class="k">Total Revenue</div><div class="v">${fmtPKR(kpi.total_revenue)}</div></div>
            <div class="card"><div class="k">Total Bookings</div><div class="v">${Number(kpi.total_bookings || 0).toLocaleString()}</div></div>
            <div class="card"><div class="k">Recommendation CTR</div><div class="v">${Number(ctrTrend[ctrTrend.length - 1]?.ctr || 0).toFixed(2)}%</div></div>
            <div class="card"><div class="k">Occupancy Rate</div><div class="v">${occupancyRate.toFixed(1)}%</div></div>
            <div class="card"><div class="k">Active Bookings Today</div><div class="v">${Number(activeBookingsToday || 0).toLocaleString()}</div></div>
            <div class="card"><div class="k">Model F1 (Latest)</div><div class="v">${Number(modelMetricsTrend[modelMetricsTrend.length - 1]?.f1 || 0).toFixed(4)}</div></div>
          </div>

          <h2>Recommendation Funnel</h2>
          <p>Recommended: ${recommendationFunnel[0]?.value || 0}, Viewed: ${recommendationFunnel[1]?.value || 0}, Booked: ${recommendationFunnel[2]?.value || 0}</p>

          <h2>Top Performing Hotels</h2>
          <table>
            <thead><tr><th>Hotel</th><th>Revenue (PKR)</th><th>Bookings</th><th>Conversion Rate</th></tr></thead>
            <tbody>${topRows || '<tr><td colspan="4">No data available</td></tr>'}</tbody>
          </table>

          <h2>Operational Alerts</h2>
          <ul>${alertRows}</ul>
        </body>
      </html>
    `;

    const reportWindow = window.open('', '_blank', 'noopener,noreferrer,width=1080,height=820');
    if (!reportWindow) return;
    reportWindow.document.write(html);
    reportWindow.document.close();
    reportWindow.focus();
    setTimeout(() => reportWindow.print(), 350);
  }, [
    data,
    topHotelsWindow,
    alerts,
    period,
    occupancyTarget,
    kpi,
    ctrTrend,
    occupancyRate,
    activeBookingsToday,
    modelMetricsTrend,
    recommendationFunnel,
  ]);

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-3 border-indigo-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-300 font-medium">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* ─── Header ─── */}
      <header className="sticky top-0 z-20 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FaBars className="text-gray-500 w-5 h-5 md:hidden cursor-pointer" />
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">Admin Dashboard</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">Analytics & Management</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => fetchAnalytics(false)} disabled={refreshing}
              className="p-2 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <FaSyncAlt className={`text-sm ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={handleSignOut}
              className="flex items-center gap-2 px-3 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-all shadow-sm">
              <FaSignOutAlt /><span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6">
        {/* ─── Tabs ─── */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <button onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${activeTab === 'overview' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
            <FaChartLine className="inline mr-2" />Analytics Overview
          </button>
          <button onClick={() => setActiveTab('manage')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${activeTab === 'manage' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
            <FaHotel className="inline mr-2" />Quick Actions
          </button>
        </div>

        {/* Weather Widget */}
        <div className="mb-6 max-w-2xl">
          <WeatherWidget showDetails={true} compact={false} />
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'overview' ? (
            <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>

              {/* ─── Filters ─── */}
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <div className="flex bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
                  {PERIODS.map(p => (
                    <button key={p.value} onClick={() => setPeriod(p.value)}
                      className={`px-3 py-2 text-xs font-semibold transition-colors ${period === p.value ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <select value={hotelFilter} onChange={e => setHotelFilter(e.target.value)}
                  className="px-3 py-2 text-xs font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-700 dark:text-gray-200 shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                  <option value="">All Hotels</option>
                  {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>

                <select
                  value={topHotelsWindow}
                  onChange={(e) => setTopHotelsWindow(Number(e.target.value || 10))}
                  className="px-3 py-2 text-xs font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-700 dark:text-gray-200 shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value={5}>Top 5 Hotels</option>
                  <option value={10}>Top 10 Hotels</option>
                  <option value={15}>Top 15 Hotels</option>
                  <option value={20}>Top 20 Hotels</option>
                </select>

                <select
                  value={occupancyTarget}
                  onChange={(e) => setOccupancyTarget(Number(e.target.value || 80))}
                  className="px-3 py-2 text-xs font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-700 dark:text-gray-200 shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value={70}>Occupancy Target 70%</option>
                  <option value={75}>Occupancy Target 75%</option>
                  <option value={80}>Occupancy Target 80%</option>
                  <option value={85}>Occupancy Target 85%</option>
                  <option value={90}>Occupancy Target 90%</option>
                </select>

                <button
                  onClick={exportCsv}
                  className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-gray-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Export CSV
                </button>
                <button
                  onClick={exportPdf}
                  className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-white hover:bg-slate-900 transition-colors"
                >
                  Export PDF
                </button>
              </div>

              <AdminSafetyMonitor />

              {/* ─── KPI Cards ─── */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
                <KPICard icon={FaMoneyBillWave} iconBg="bg-green-100 dark:bg-green-900/30" iconColor="text-green-600 dark:text-green-400"
                  label="Total Revenue" value={fmtPKR(kpi.total_revenue)} change={kpi.revenue_growth} delay={0} />
                <KPICard icon={FaBook} iconBg="bg-indigo-100 dark:bg-indigo-900/30" iconColor="text-indigo-600 dark:text-indigo-400"
                  label="Total Bookings" value={kpi.total_bookings} change={kpi.booking_growth} delay={0.05} />
                <KPICard icon={FaPercentage} iconBg="bg-amber-100 dark:bg-amber-900/30" iconColor="text-amber-600 dark:text-amber-400"
                  label="Conversion Rate" value={`${kpi.conversion_rate || 0}%`} delay={0.1} />
                <KPICard icon={FaBrain} iconBg="bg-cyan-100 dark:bg-cyan-900/30" iconColor="text-cyan-600 dark:text-cyan-400"
                  label="Recommendation CTR" value={`${ctrDisplayValue.toFixed(1)}%`} delay={0.15} />
              </div>

              {/* ─── Top Row: Revenue Trend + Booking Status + Active Bookings ─── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                <ChartCard title="Revenue Trend" subtitle="Daily revenue trajectory (PKR)" className="lg:col-span-2">
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={data?.revenue_over_time || []} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11 }} stroke="#9ca3af" />
                      <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11 }} stroke="#9ca3af" />
                      <Tooltip content={<ChartTooltip prefix="PKR " />} />
                      <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#0ea5e9" strokeWidth={2.8} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Booking Status" subtitle="Confirmed vs Cancelled vs Pending">
                  <div className="grid grid-cols-1 gap-3">
                    <ResponsiveContainer width="100%" height={190}>
                      <PieChart>
                        <Pie data={statusPie} cx="50%" cy="50%" innerRadius={42} outerRadius={72} paddingAngle={2} dataKey="value">
                          {statusPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip formatter={(v, n, p) => [v, p.payload.name]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <MetricMiniCard label="Confirmed" value={bookingStatusCard.confirmed} tone="emerald" />
                      <MetricMiniCard label="Cancelled" value={bookingStatusCard.cancelled} tone="red" />
                      <MetricMiniCard label="Pending" value={bookingStatusCard.pending} tone="amber" />
                    </div>
                  </div>
                </ChartCard>
              </div>

              {/* ─── Operational Core Row ─── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                <ChartCard title="Bookings Trend" subtitle="Stacked status outcomes" className="lg:col-span-2">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={bookingsTrend} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11 }} stroke="#9ca3af" />
                      <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="confirmed" stackId="status" name="Confirmed" fill="#22c55e" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="cancelled" stackId="status" name="Cancelled" fill="#ef4444" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="pending" stackId="status" name="Pending" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Active Bookings Today" subtitle="Real-time operational volume">
                  <div className="h-[260px] flex flex-col justify-between">
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-900/50 p-5 border border-slate-200 dark:border-slate-700">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Active Orders</p>
                      <p className="text-4xl font-bold text-slate-800 dark:text-white mt-2">{activeBookingsToday.toLocaleString()}</p>
                      <p className="text-xs text-slate-500 mt-1">Includes confirmed and in-progress stays</p>
                    </div>
                    <AlertsPanel alerts={alerts} />
                  </div>
                </ChartCard>
              </div>

              {/* ─── Second Row: Top Hotels + Room Types + Payment ─── */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                <ChartCard title="Top Performing Hotels" subtitle="Ranked by selected KPI">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] text-gray-500">Metric</span>
                    <select
                      value={topHotelMetric}
                      onChange={(e) => setTopHotelMetric(e.target.value)}
                      className="text-[11px] px-2 py-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md"
                    >
                      <option value="revenue">Revenue</option>
                      <option value="bookings">Bookings</option>
                      <option value="conversion_rate">Conversion Rate</option>
                    </select>
                  </div>
                  {topHotelsChartData.length ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={topHotelsChartData} layout="vertical" margin={{ top: 0, right: 5, left: 25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                        <YAxis dataKey="name" type="category" width={95} tick={{ fontSize: 10 }} stroke="#9ca3af" />
                        <Tooltip content={<ChartTooltip prefix={topHotelMetric === 'revenue' ? 'PKR ' : ''} />} />
                        <Bar dataKey={topHotelMetric} name={topHotelMetric.replace('_', ' ')} fill="#0284c7" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <NoDataState />}
                </ChartCard>

                <ChartCard title="Room Type Distribution" subtitle="Demand by inventory class">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={roomTypeHorizontal} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                      <YAxis dataKey="type" type="category" width={60} tick={{ fontSize: 11 }} stroke="#9ca3af" />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="count" name="Bookings" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Payment Method Distribution" subtitle="Online vs pay on arrival">
                  {paymentPie.length ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={paymentPie} cx="50%" cy="50%" innerRadius={46} outerRadius={76} paddingAngle={4} dataKey="value">
                          {paymentPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <NoDataState />}
                </ChartCard>
              </div>

              {/* ─── Third Row: Recommendation Funnel + CTR + Booking Source ─── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                <ChartCard title="Recommendation Conversion Funnel" subtitle="Recommended -> Viewed -> Booked">
                  {recommendationFunnel.some(r => r.value > 0) ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <FunnelChart>
                        <Tooltip content={<ChartTooltip />} />
                        <Funnel dataKey="value" data={recommendationFunnel} isAnimationActive fill="#0ea5e9">
                          <LabelList position="right" fill="#334155" stroke="none" dataKey="name" />
                          <LabelList position="inside" fill="#ffffff" stroke="none" dataKey="value" formatter={(v) => Number(v).toLocaleString()} />
                        </Funnel>
                      </FunnelChart>
                    </ResponsiveContainer>
                  ) : <NoDataState text="Recommendation funnel data unavailable" />}
                </ChartCard>

                <ChartCard title="Recommendation CTR Trend" subtitle="Click-through effectiveness over time">
                  {ctrTrend.length ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={ctrTrend} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                        <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11 }} stroke="#9ca3af" />
                        <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" domain={[0, 'auto']} />
                        <Tooltip content={<ChartTooltip prefix="" />} formatter={(v) => [`${Number(v).toFixed(2)}%`, 'CTR']} />
                        <Line dataKey="ctr" name="CTR" stroke="#14b8a6" strokeWidth={2.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : <NoDataState />}
                </ChartCard>

                <ChartCard title="Booking Source Distribution" subtitle="Traffic channel mix">
                  {bookingSourceDonut.length ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={bookingSourceDonut} cx="50%" cy="50%" innerRadius={45} outerRadius={82} paddingAngle={4} dataKey="value">
                          {bookingSourceDonut.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <NoDataState />}
                </ChartCard>
              </div>

              {/* ─── Fourth Row: Cumulative Revenue + Cancellation Trend + Occupancy ─── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                <ChartCard title="Cumulative Revenue" subtitle="Long-term earnings growth">
                  {data?.cumulative_revenue?.length ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={data?.cumulative_revenue || []} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                        <defs>
                          <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#0284c7" stopOpacity={0.26} />
                            <stop offset="100%" stopColor="#0284c7" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                        <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11 }} stroke="#9ca3af" />
                        <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11 }} stroke="#9ca3af" />
                        <Tooltip content={<ChartTooltip prefix="PKR " />} />
                        <Area type="monotone" dataKey="cumulative" name="Cumulative Revenue" stroke="#0284c7" strokeWidth={2.5} fill="url(#cumGrad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : <NoDataState />}
                </ChartCard>

                <ChartCard title="Refund & Cancellation Trend" subtitle="Operational and policy risk signal">
                  {cancellationTrend.length ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={cancellationTrend} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                        <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11 }} stroke="#9ca3af" />
                        <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Line dataKey="cancelled" name="Cancelled" stroke="#ef4444" strokeWidth={2.2} dot={false} />
                        <Line dataKey="refunded" name="Refunded" stroke="#f97316" strokeWidth={2.2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : <NoDataState />}
                </ChartCard>

                <ChartCard title="Hotel Occupancy Rate" subtitle="Inventory utilization KPI">
                  <ResponsiveContainer width="100%" height={250}>
                    <RadialBarChart
                      cx="50%"
                      cy="57%"
                      innerRadius="62%"
                      outerRadius="92%"
                      barSize={18}
                      data={occupancyGaugeData}
                      startAngle={180}
                      endAngle={0}
                    >
                      <RadialBar dataKey="value" cornerRadius={12} background />
                      <text x="50%" y="53%" textAnchor="middle" dominantBaseline="middle" className="fill-slate-800 dark:fill-white" style={{ fontSize: '28px', fontWeight: 700 }}>
                        {`${occupancyRate.toFixed(1)}%`}
                      </text>
                      <text x="50%" y="67%" textAnchor="middle" dominantBaseline="middle" className="fill-slate-500 dark:fill-slate-400" style={{ fontSize: '11px', fontWeight: 600 }}>
                        Occupancy
                      </text>
                    </RadialBarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              {/* ─── Additional Intelligence Row: Model Metrics + Geo Heatmap ─── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                <ChartCard title="Model Quality Metrics" subtitle="Precision, Recall, F1 drift monitoring">
                  {modelMetricsTrend.length ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={modelMetricsTrend} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                        <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11 }} stroke="#9ca3af" />
                        <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" domain={[0, 1]} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Line dataKey="precision" name="Precision" stroke="#2563eb" strokeWidth={2.1} dot={false} />
                        <Line dataKey="recall" name="Recall" stroke="#14b8a6" strokeWidth={2.1} dot={false} />
                        <Line dataKey="f1" name="F1" stroke="#a855f7" strokeWidth={2.1} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : <NoDataState text="Model metrics unavailable" />}
                </ChartCard>

                <ChartCard title="Customer Location Heatmap" subtitle="Demand concentration by region">
                  {locationHeatmap.length ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {locationHeatmap.map((loc) => (
                        <div
                          key={loc.place}
                          className="rounded-lg border border-slate-200 dark:border-slate-700 p-2.5"
                          style={{
                            background: `linear-gradient(135deg, rgba(2,132,199,${loc.intensity}), rgba(2,132,199,0.08))`,
                          }}
                        >
                          <p className="text-[11px] font-semibold text-slate-900 dark:text-white truncate">{loc.place}</p>
                          <p className="text-[10px] text-slate-700 dark:text-slate-300 mt-1">{loc.count.toLocaleString()} bookings</p>
                        </div>
                      ))}
                    </div>
                  ) : <NoDataState text="Location distribution unavailable" />}
                </ChartCard>
              </div>

              {/* ─── Recent Bookings Table ─── */}
              <ChartCard title="Recent Bookings" subtitle={`Latest ${data?.recent_bookings?.length || 0} entries`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 px-3 font-semibold text-gray-500 dark:text-gray-400">Hotel</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-500 dark:text-gray-400">Guest</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-500 dark:text-gray-400">Check-in</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-500 dark:text-gray-400">Amount</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-500 dark:text-gray-400">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.recent_bookings || []).map(b => (
                        <tr key={b.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                          <td className="py-2.5 px-3 font-medium text-gray-800 dark:text-white truncate max-w-[150px]">{b.hotel_name}</td>
                          <td className="py-2.5 px-3 text-gray-600 dark:text-gray-300">{b.guest_name || '—'}</td>
                          <td className="py-2.5 px-3 text-gray-600 dark:text-gray-300">{fmtDate(b.check_in)}</td>
                          <td className="py-2.5 px-3 font-semibold text-gray-800 dark:text-white">{fmtPKR(b.total_price)}</td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              b.status === 'PAID' || b.status === 'COMPLETED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : b.status === 'CONFIRMED' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                              : b.status === 'CANCELLED' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                            }`}>{STATUS_LABELS[b.status] || b.status}</span>
                          </td>
                        </tr>
                      ))}
                      {!data?.recent_bookings?.length && (
                        <tr><td colSpan={5} className="text-center py-8 text-gray-400">No bookings in this period</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </ChartCard>

            </motion.div>
          ) : (
            <motion.div key="manage" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              {/* ─── Quick Stats Row ─── */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
                <KPICard icon={FaHotel} iconBg="bg-sky-100 dark:bg-sky-900/30" iconColor="text-sky-600 dark:text-sky-400"
                  label="Total Hotels" value={kpi.total_hotels || hotels.length} delay={0} />
                <KPICard icon={FaBook} iconBg="bg-indigo-100 dark:bg-indigo-900/30" iconColor="text-indigo-600 dark:text-indigo-400"
                  label="Total Bookings" value={kpi.total_bookings} delay={0.05} />
                <KPICard icon={FaMoneyBillWave} iconBg="bg-green-100 dark:bg-green-900/30" iconColor="text-green-600 dark:text-green-400"
                  label="Total Revenue" value={fmtPKR(kpi.total_revenue)} delay={0.1} />
                <KPICard icon={FaTimesCircle} iconBg="bg-red-100 dark:bg-red-900/30" iconColor="text-red-600 dark:text-red-400"
                  label="Cancelled" value={kpi.cancelled_count || 0} delay={0.15} />
              </div>

              {/* ─── Quick Actions ─── */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => navigate('/admin/hotels')}
                  className="p-6 bg-gradient-to-br from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all">
                  <FaHotel className="text-3xl mb-3" />
                  <h3 className="text-lg font-bold mb-1">Manage Hotels</h3>
                  <p className="text-xs opacity-90">Add, edit, or remove hotels</p>
                </motion.button>

                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => navigate('/admin/bookings')}
                  className="p-6 bg-gradient-to-br from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all">
                  <FaBook className="text-3xl mb-3" />
                  <h3 className="text-lg font-bold mb-1">Manage Bookings</h3>
                  <p className="text-xs opacity-90">View, filter, and update all bookings</p>
                </motion.button>

                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';
                    const baseUrl = apiUrl.replace(/\/api$/, '');
                    window.open(`${baseUrl}/admin/`, '_blank');
                  }}
                  className="p-6 bg-gradient-to-br from-gray-600 to-gray-800 hover:from-gray-700 hover:to-gray-900 text-white rounded-xl shadow-lg hover:shadow-xl transition-all">
                  <FaUsers className="text-3xl mb-3" />
                  <h3 className="text-lg font-bold mb-1">Super Admin</h3>
                  <p className="text-xs opacity-90">Users, payments, raw data</p>
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

/* ─── KPI Card Component ─── */
const KPICard = ({ icon: Icon, iconBg, iconColor, label, value, change, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 15 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-5 hover:shadow-md transition-shadow"
  >
    <div className="flex items-start justify-between mb-3">
      <div className={`w-10 h-10 ${iconBg} rounded-xl flex items-center justify-center`}>
        <Icon className={`${iconColor} text-lg`} />
      </div>
      {change !== undefined && change !== null && (
        <span className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
          change >= 0 ? 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30' : 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30'
        }`}>
          {change >= 0 ? <FaArrowUp className="text-[8px]" /> : <FaArrowDown className="text-[8px]" />}
          {Math.abs(change)}%
        </span>
      )}
    </div>
    <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5">{label}</p>
    <p className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white truncate">{value}</p>
  </motion.div>
);

/* ─── Chart Card Wrapper ─── */
const ChartCard = ({ title, subtitle, children, className = '' }) => (
  <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-5 ${className}`}>
    <div className="mb-4">
      <h3 className="text-sm font-bold text-gray-800 dark:text-white">{title}</h3>
      {subtitle && <p className="text-[11px] text-gray-500 dark:text-gray-400">{subtitle}</p>}
    </div>
    {children}
  </div>
);

const MetricMiniCard = ({ label, value, tone = 'slate' }) => {
  const toneClasses = {
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
    red: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
    slate: 'bg-slate-50 text-slate-700 dark:bg-slate-900/20 dark:text-slate-300',
  };

  return (
    <div className={`rounded-lg px-2 py-2 ${toneClasses[tone] || toneClasses.slate}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide">{label}</p>
      <p className="text-sm font-bold mt-0.5">{Number(value || 0).toLocaleString()}</p>
    </div>
  );
};

const AlertsPanel = ({ alerts }) => (
  <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-white dark:bg-gray-800/40">
    <div className="flex items-center gap-2 mb-2">
      <FaBell className="text-[11px] text-slate-500" />
      <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Alerts</p>
    </div>
    <div className="space-y-1.5 max-h-[95px] overflow-y-auto pr-1">
      {(alerts || []).map((a, idx) => (
        <div key={`${a.text}-${idx}`} className={`text-[11px] rounded-md px-2 py-1.5 ${
          a.level === 'high'
            ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
            : a.level === 'medium'
              ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
        }`}>
          {a.text}
        </div>
      ))}
    </div>
  </div>
);

export default AdminDashboard;