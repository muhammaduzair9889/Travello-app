import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { notificationAPI } from '../services/api';
import { FaBell, FaCheck, FaCheckDouble, FaTrash, FaTimes } from 'react-icons/fa';

/* ──────────────────────────────────────────────
   Category config
────────────────────────────────────────────── */
const CATEGORY_STYLE = {
  booking:   { bg: 'bg-blue-50 dark:bg-blue-900/20',   border: 'border-blue-200 dark:border-blue-800',   text: 'text-blue-700 dark:text-blue-300',   badge: 'bg-blue-100 text-blue-700' },
  payment:   { bg: 'bg-green-50 dark:bg-green-900/20',  border: 'border-green-200 dark:border-green-800',  text: 'text-green-700 dark:text-green-300',  badge: 'bg-green-100 text-green-700' },
  itinerary: { bg: 'bg-purple-50 dark:bg-purple-900/20',border: 'border-purple-200 dark:border-purple-800',text: 'text-purple-700 dark:text-purple-300',badge: 'bg-purple-100 text-purple-700' },
  promo:     { bg: 'bg-amber-50 dark:bg-amber-900/20',  border: 'border-amber-200 dark:border-amber-800',  text: 'text-amber-700 dark:text-amber-300',  badge: 'bg-amber-100 text-amber-700' },
  system:    { bg: 'bg-gray-50 dark:bg-gray-800/50',    border: 'border-gray-200 dark:border-gray-700',    text: 'text-gray-700 dark:text-gray-300',    badge: 'bg-gray-100 text-gray-700' },
};

const getCategoryStyle = (cat) => CATEGORY_STYLE[cat] || CATEGORY_STYLE.system;

const PRIORITY_DOT = {
  high:   'bg-red-500',
  normal: 'bg-blue-500',
  low:    'bg-gray-400',
};

/* ──────────────────────────────────────────────
   Single Notification Item
────────────────────────────────────────────── */
const NotificationItem = ({ notif, onMarkRead, onDelete }) => {
  const cs = getCategoryStyle(notif.category);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
      className={`relative group rounded-xl border p-3.5 transition-all duration-200 ${
        notif.is_read
          ? 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 opacity-70'
          : `${cs.bg} ${cs.border} shadow-sm`
      }`}
    >
      {/* Unread indicator */}
      {!notif.is_read && (
        <span className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full ${PRIORITY_DOT[notif.priority] || PRIORITY_DOT.normal} ring-2 ring-white dark:ring-gray-800`} />
      )}

      <div className="flex items-start gap-3">
        {/* Icon */}
        <span className="text-2xl flex-shrink-0 mt-0.5">{notif.icon || '🔔'}</span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className={`text-sm font-semibold ${notif.is_read ? 'text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>
              {notif.title}
            </h4>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cs.badge}`}>
              {notif.category}
            </span>
          </div>
          <p className={`text-xs mt-1 leading-relaxed ${notif.is_read ? 'text-gray-400 dark:text-gray-500' : 'text-gray-600 dark:text-gray-300'}`}>
            {notif.message}
          </p>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">{notif.time_ago}</p>
        </div>

        {/* Hover actions */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {!notif.is_read && (
            <button
              onClick={() => onMarkRead(notif.id)}
              title="Mark as read"
              className="p-1.5 rounded-lg hover:bg-white/80 dark:hover:bg-gray-700 text-gray-400 hover:text-green-600 transition-colors"
            >
              <FaCheck className="text-xs" />
            </button>
          )}
          <button
            onClick={() => onDelete(notif.id)}
            title="Delete"
            className="p-1.5 rounded-lg hover:bg-white/80 dark:hover:bg-gray-700 text-gray-400 hover:text-red-500 transition-colors"
          >
            <FaTrash className="text-xs" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

/* ──────────────────────────────────────────────
   Main Notification Center
────────────────────────────────────────────── */
export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // all | unread
  const panelRef = useRef(null);

  /* ── Fetch unread count (polling every 30s) ── */
  const fetchCount = useCallback(async () => {
    try {
      const res = await notificationAPI.unreadCount();
      setUnreadCount(res.data?.unread || 0);
    } catch {
      // Silently ignore — API may not be ready
    }
  }, []);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  /* ── Fetch notifications when panel opens ── */
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter === 'unread' ? { unread: 1 } : {};
      const res = await notificationAPI.list(params);
      setNotifications(res.data?.results || res.data || []);
    } catch {
      setNotifications([]);
    } finally { setLoading(false); }
  }, [filter]);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  /* ── Close on outside click ── */
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  /* ── Actions ── */
  const handleMarkRead = async (id) => {
    try {
      await notificationAPI.markRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationAPI.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {}
  };

  const handleDelete = async (id) => {
    try {
      await notificationAPI.deleteOne(id);
      const deleted = notifications.find(n => n.id === id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (deleted && !deleted.is_read) setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {}
  };

  const handleClearRead = async () => {
    try {
      await notificationAPI.clearRead();
      setNotifications(prev => prev.filter(n => !n.is_read));
    } catch {}
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* ── Bell Button ── */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(prev => !prev)}
        className="relative p-2.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all duration-200"
      >
        <FaBell className="text-lg" />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-0.5 -right-0.5 min-w-[20px] h-5 flex items-center justify-center px-1 text-[10px] font-bold text-white bg-red-500 rounded-full ring-2 ring-white dark:ring-gray-900"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* ── Dropdown Panel ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-[380px] max-h-[520px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50 flex flex-col"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-800">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white text-sm">Notifications</h3>
                {unreadCount > 0 && (
                  <p className="text-[11px] text-gray-400">{unreadCount} unread</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    title="Mark all as read"
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-green-600 transition-colors"
                  >
                    <FaCheckDouble className="text-sm" />
                  </button>
                )}
                <button
                  onClick={handleClearRead}
                  title="Clear read notifications"
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <FaTrash className="text-sm" />
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 transition-colors"
                >
                  <FaTimes className="text-sm" />
                </button>
              </div>
            </div>

            {/* Filter tabs */}
            <div className="flex border-b border-gray-100 dark:border-gray-700 px-4">
              {[
                { value: 'all',    label: 'All' },
                { value: 'unread', label: 'Unread' },
              ].map(tab => (
                <button
                  key={tab.value}
                  onClick={() => setFilter(tab.value)}
                  className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                    filter === tab.value
                      ? 'border-violet-500 text-violet-600 dark:text-violet-400'
                      : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Notification list */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-12">
                  <span className="text-4xl">🔔</span>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-3">
                    {filter === 'unread' ? 'All caught up!' : 'No notifications yet'}
                  </p>
                  <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">
                    Booking confirmations, payment alerts & more will appear here
                  </p>
                </div>
              ) : (
                <AnimatePresence>
                  {notifications.map(notif => (
                    <NotificationItem
                      key={notif.id}
                      notif={notif}
                      onMarkRead={handleMarkRead}
                      onDelete={handleDelete}
                    />
                  ))}
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
