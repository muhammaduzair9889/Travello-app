import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaFilter, FaSyncAlt, FaCalendarAlt, FaHotel, FaUser, FaMoneyBillWave, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import { bookingAPI, hotelAPI } from '../services/api';

const STATUS_OPTIONS = ['PENDING', 'PAID', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];
const PAYMENT_OPTIONS = ['ONLINE', 'ARRIVAL'];

const statusStyles = {
  PENDING: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-700 dark:text-yellow-300',
    label: 'Pending'
  },
  PAID: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-700 dark:text-green-300',
    label: 'Paid'
  },
  CONFIRMED: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-700 dark:text-blue-300',
    label: 'Confirmed'
  },
  COMPLETED: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-700 dark:text-emerald-300',
    label: 'Completed'
  },
  CANCELLED: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-300',
    label: 'Cancelled'
  }
};

const AdminBookings = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    hotel: '',
    status: '',
    payment_method: '',
    start_date: '',
    end_date: '',
    user: ''
  });
  const [statusUpdates, setStatusUpdates] = useState({});
  const [isFiltering, setIsFiltering] = useState(false);

  useEffect(() => {
    const isAdmin = localStorage.getItem('isAdmin') === 'true';
    if (!isAdmin) {
      navigate('/login');
      return;
    }
    loadHotelsAndBookings();
  }, [navigate]);

  const loadHotelsAndBookings = async () => {
    setLoading(true);
    setError(null);
    try {
      const [hotelsRes] = await Promise.all([
        hotelAPI.getAllHotels(),
      ]);
      setHotels(hotelsRes.data || []);
      await fetchBookings();
    } catch (err) {
      console.error('Failed to load admin data', err);
      setError('Failed to load admin bookings.');
    } finally {
      setLoading(false);
    }
  };

  const fetchBookings = async () => {
    setIsFiltering(true);
    setError(null);
    try {
      const params = Object.entries(filters).reduce((acc, [key, value]) => {
        if (value) acc[key] = value;
        return acc;
      }, {});
      const res = await bookingAPI.getAdminBookings(params);
      setBookings(res.data?.bookings || res.data || []);
    } catch (err) {
      console.error('Failed to fetch bookings', err);
      setError(err.response?.data?.error || 'Unable to fetch bookings.');
    } finally {
      setIsFiltering(false);
    }
  };

  const clearFilters = () => {
    setFilters({ hotel: '', status: '', payment_method: '', start_date: '', end_date: '', user: '' });
  };

  const handleStatusChange = (bookingId, value) => {
    setStatusUpdates((prev) => ({ ...prev, [bookingId]: value }));
  };

  const applyStatusUpdate = async (bookingId) => {
    const newStatus = statusUpdates[bookingId];
    if (!newStatus) return;
    try {
      const res = await bookingAPI.updateBookingStatus(bookingId, newStatus);
      const updated = res.data?.booking || res.data;
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? updated : b)));
    } catch (err) {
      console.error('Failed to update status', err);
      setError(err.response?.data?.error || err.response?.data?.detail || 'Failed to update booking status.');
    }
  };

  const filteredCount = useMemo(() => bookings.length, [bookings]);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-2 border-sky-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-300">Loading admin bookings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Admin Bookings</h1>
            <p className="text-gray-600 dark:text-gray-400">View, filter, and update all bookings</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={fetchBookings}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg flex items-center gap-2"
            >
              <FaSyncAlt /> Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg flex items-center gap-2">
            <FaExclamationTriangle />
            <span>{error}</span>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-4 mb-6">
          <div className="flex items-center gap-2 mb-4 text-gray-700 dark:text-gray-200 font-semibold">
            <FaFilter /> Filters
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Hotel</label>
              <select
                value={filters.hotel}
                onChange={(e) => setFilters((f) => ({ ...f, hotel: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-white px-3 py-2"
              >
                <option value="">All Hotels</option>
                {hotels.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-white px-3 py-2"
              >
                <option value="">All Statuses</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Payment Method</label>
              <select
                value={filters.payment_method}
                onChange={(e) => setFilters((f) => ({ ...f, payment_method: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-white px-3 py-2"
              >
                <option value="">All Methods</option>
                {PAYMENT_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Start Date</label>
                <input
                  type="date"
                  value={filters.start_date}
                  onChange={(e) => setFilters((f) => ({ ...f, start_date: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-white px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">End Date</label>
                <input
                  type="date"
                  value={filters.end_date}
                  onChange={(e) => setFilters((f) => ({ ...f, end_date: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-white px-3 py-2"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">User (name or email)</label>
              <input
                type="text"
                placeholder="e.g. Ali, ali@example.com"
                value={filters.user}
                onChange={(e) => setFilters((f) => ({ ...f, user: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-white px-3 py-2"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mt-4">
            <button
              onClick={fetchBookings}
              disabled={isFiltering}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-60"
            >
              <FaFilter /> Apply Filters
            </button>
            <button
              onClick={() => { clearFilters(); }}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg"
            >
              Clear
            </button>
            <span className="text-gray-600 dark:text-gray-400 text-sm flex items-center gap-2">
              {filteredCount} bookings
            </span>
          </div>
        </div>

        {/* Bookings Table */}
        <div className="space-y-4">
          {bookings.map((booking) => {
            const styles = statusStyles[booking.status] || statusStyles.PENDING;
            const price = parseFloat(booking.total_price || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            return (
              <motion.div
                key={booking.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm"
              >
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 text-white flex items-center justify-center font-bold text-lg">
                      {booking.hotel_details?.name?.[0]?.toUpperCase() || 'H'}
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Booking #{booking.id}</p>
                      <h3 className="text-xl font-semibold text-gray-800 dark:text-white">{booking.hotel_details?.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{booking.hotel_details?.city}</p>
                    </div>
                  </div>

                  <span className={`${styles.bg} ${styles.text} px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2 self-start md:self-auto`}>
                    <FaCheckCircle /> {styles.label}
                  </span>
                </div>

                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
                      <FaHotel /> <span className="font-semibold">Room</span>
                    </div>
                    <p className="text-gray-800 dark:text-white capitalize">{booking.room_type_details?.type}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{typeof booking.rooms_booked === 'object' && booking.rooms_booked !== null ? (typeof booking.rooms_booked.rooms_booked === 'number' ? booking.rooms_booked.rooms_booked : 1) : (typeof booking.rooms_booked === 'number' ? booking.rooms_booked : 1)} {(typeof booking.rooms_booked === 'object' && booking.rooms_booked !== null ? (typeof booking.rooms_booked.rooms_booked === 'number' ? booking.rooms_booked.rooms_booked : 1) : (typeof booking.rooms_booked === 'number' ? booking.rooms_booked : 1)) === 1 ? 'room' : 'rooms'}</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
                      <FaCalendarAlt /> <span className="font-semibold">Dates</span>
                    </div>
                    <p className="text-gray-800 dark:text-white">{formatDate(booking.check_in)} → {formatDate(booking.check_out)}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Created: {formatDate(booking.created_at)}</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
                      <FaUser /> <span className="font-semibold">Guest</span>
                    </div>
                    <p className="text-gray-800 dark:text-white">{booking.guest_name || booking.user_details?.name || 'N/A'}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{booking.guest_email || booking.user_details?.email || ''}</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
                      <FaMoneyBillWave /> <span className="font-semibold">Payment</span>
                    </div>
                    <p className="text-gray-800 dark:text-white">{booking.payment_method}</p>
                    <p className="text-xl font-bold text-sky-600 dark:text-sky-400">PKR {price}</p>
                    {booking.payment && (
                      <div className="mt-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          <span className="font-semibold">Status:</span> {booking.payment.status || 'N/A'}{booking.payment.is_successful ? ' (Successful)' : ''}
                        </p>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          <span className="font-semibold">Amount:</span> {booking.payment.amount} {booking.payment.currency}
                        </p>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          <span className="font-semibold">Method:</span> {booking.payment.payment_method_type || '—'}
                        </p>
                        {(booking.payment.brand || booking.payment.last4) && (
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            <span className="font-semibold">Card:</span> {booking.payment.brand || '—'} {booking.payment.last4 ? `•••• ${booking.payment.last4}` : ''}
                          </p>
                        )}
                        {booking.payment.error_message && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">Error: {booking.payment.error_message}</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 lg:col-span-2">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Update Status</p>
                    <div className="flex flex-wrap gap-3">
                      <select
                        value={statusUpdates[booking.id] || booking.status}
                        onChange={(e) => handleStatusChange(booking.id, e.target.value)}
                        className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-white px-3 py-2"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => applyStatusUpdate(booking.id)}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
                      >
                        Update
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}

          {bookings.length === 0 && (
            <div className="p-6 bg-white dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl text-center text-gray-600 dark:text-gray-400">
              No bookings found for the selected filters.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminBookings;
