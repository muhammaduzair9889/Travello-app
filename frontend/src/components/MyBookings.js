import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaHotel, FaCheckCircle, FaClock, FaTimes, FaCalendarAlt, FaCreditCard } from 'react-icons/fa';
import { bookingAPI } from '../services/api';

const MyBookings = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cancelling, setCancelling] = useState(null);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      setError(null);
      const response = await bookingAPI.getMyBookings();
      setBookings(response.data);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      setError('Failed to load bookings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) {
      return;
    }

    setCancelling(bookingId);
    try {
      await bookingAPI.cancelBooking(bookingId);
      // Refresh bookings list
      await fetchBookings();
    } catch (error) {
      console.error('Error cancelling booking:', error);
      setError(error.response?.data?.error || 'Failed to cancel booking. Please try again.');
    } finally {
      setCancelling(null);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      PENDING: {
        icon: FaClock,
        bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
        textColor: 'text-yellow-700 dark:text-yellow-400',
        label: 'Pending'
      },
      PAID: {
        icon: FaCheckCircle,
        bgColor: 'bg-green-100 dark:bg-green-900/30',
        textColor: 'text-green-700 dark:text-green-400',
        label: 'Paid'
      },
      CONFIRMED: {
        icon: FaCheckCircle,
        bgColor: 'bg-blue-100 dark:bg-blue-900/30',
        textColor: 'text-blue-700 dark:text-blue-400',
        label: 'Confirmed'
      },
      COMPLETED: {
        icon: FaCheckCircle,
        bgColor: 'bg-green-100 dark:bg-green-900/30',
        textColor: 'text-green-700 dark:text-green-400',
        label: 'Completed'
      },
      CANCELLED: {
        icon: FaTimes,
        bgColor: 'bg-red-100 dark:bg-red-900/30',
        textColor: 'text-red-700 dark:text-red-400',
        label: 'Cancelled'
      }
    };

    const config = statusConfig[status] || statusConfig.PENDING;
    const Icon = config.icon;

    return {
      ...config,
      Icon
    };
  };

  const getPaymentMethodLabel = (method) => {
    const methods = {
      'ONLINE': 'Online Payment',
      'ARRIVAL': 'Pay on Arrival'
    };
    return methods[method] || method;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-sky-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading bookings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-2">
            My Bookings
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            View and manage your hotel reservations
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg"
          >
            {error}
          </motion.div>
        )}

        {/* Bookings List */}
        {bookings.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
            <FaHotel className="text-gray-300 dark:text-gray-600 text-6xl mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 text-lg mb-4">
              No bookings yet
            </p>
            <button
              onClick={() => navigate('/hotels')}
              className="px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium transition-colors"
            >
              Browse Hotels
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {bookings.map((booking) => {
              const statusConfig = getStatusBadge(booking.status);
              const StatusIcon = statusConfig.Icon;
              const calculatedNights = booking.number_of_nights || 
                (new Date(booking.check_out) - new Date(booking.check_in)) / (1000 * 60 * 60 * 24);

              return (
                <motion.div
                  key={booking.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-shadow"
                >
                  {/* Header Section */}
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      {/* Hotel Info */}
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-gradient-to-r from-sky-400 to-blue-500 rounded-lg flex items-center justify-center text-white text-2xl font-bold shadow-md">
                          {booking.hotel_details?.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                            {booking.hotel_details?.name}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {booking.hotel_details?.city}
                          </p>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${statusConfig.bgColor} ${statusConfig.textColor} font-medium whitespace-nowrap`}>
                        <StatusIcon className="text-lg" />
                        <span>{statusConfig.label}</span>
                      </div>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="p-6">
                    {/* First Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                      {/* Room Type */}
                      <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                          Room Type
                        </p>
                        <p className="text-lg font-bold text-gray-800 dark:text-white capitalize">
                          {booking.room_type_details?.type || 'N/A'}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {typeof booking.rooms_booked === 'object' && booking.rooms_booked !== null ? (typeof booking.rooms_booked.rooms_booked === 'number' ? booking.rooms_booked.rooms_booked : 1) : (typeof booking.rooms_booked === 'number' ? booking.rooms_booked : 1)} {(typeof booking.rooms_booked === 'object' && booking.rooms_booked !== null ? (typeof booking.rooms_booked.rooms_booked === 'number' ? booking.rooms_booked.rooms_booked : 1) : (typeof booking.rooms_booked === 'number' ? booking.rooms_booked : 1)) === 1 ? 'room' : 'rooms'}
                        </p>
                      </div>

                      {/* Check-in Date */}
                      <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                          <FaCalendarAlt className="text-sky-600" />
                          Check-in
                        </p>
                        <p className="text-lg font-bold text-gray-800 dark:text-white">
                          {new Date(booking.check_in).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {new Date(booking.check_in).toLocaleDateString('en-US', { weekday: 'short' })}
                        </p>
                      </div>

                      {/* Check-out Date */}
                      <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                          <FaCalendarAlt className="text-sky-600" />
                          Check-out
                        </p>
                        <p className="text-lg font-bold text-gray-800 dark:text-white">
                          {new Date(booking.check_out).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {new Date(booking.check_out).toLocaleDateString('en-US', { weekday: 'short' })}
                        </p>
                      </div>

                      {/* Duration */}
                      <div className="p-4 bg-sky-50 dark:bg-sky-900/20 rounded-lg border border-sky-200 dark:border-sky-800">
                        <p className="text-xs font-semibold text-sky-700 dark:text-sky-400 uppercase tracking-wider mb-2">
                          Duration
                        </p>
                        <p className="text-lg font-bold text-sky-700 dark:text-sky-400">
                          {Math.ceil(calculatedNights)} {Math.ceil(calculatedNights) === 1 ? 'night' : 'nights'}
                        </p>
                        <p className="text-sm text-sky-600 dark:text-sky-300 mt-1">
                          PKR {(booking.total_price / Math.ceil(calculatedNights)).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/night
                        </p>
                      </div>
                    </div>

                    {/* Second Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                      {/* Payment Method */}
                      <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                          <FaCreditCard className="text-sky-600" />
                          Payment Method
                        </p>
                        <p className="text-lg font-bold text-gray-800 dark:text-white">
                          {getPaymentMethodLabel(booking.payment_method)}
                        </p>
                        <p className={`text-sm mt-1 ${
                          booking.payment_method === 'ONLINE' 
                            ? 'text-blue-600 dark:text-blue-400' 
                            : 'text-purple-600 dark:text-purple-400'
                        }`}>
                          {booking.payment_method === 'ONLINE' ? '🔒 Secure' : '💳 At desk'}
                        </p>
                      </div>

                      {/* Booking Status Details */}
                      <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                          Booking Status
                        </p>
                        <p className="text-lg font-bold text-gray-800 dark:text-white">
                          {booking.status}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Booked on {new Date(booking.created_at).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric'
                          })}
                        </p>
                      </div>

                      {/* Guest Info */}
                      {booking.guest_name && (
                        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                            Guest Name
                          </p>
                          <p className="text-lg font-bold text-gray-800 dark:text-white truncate">
                            {booking.guest_name}
                          </p>
                          {booking.guest_email && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 truncate">
                              {booking.guest_email}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Total Price and Action Button */}
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Amount</p>
                        <p className="text-3xl font-bold text-sky-600 dark:text-sky-400">
                          PKR {parseFloat(booking.total_price).toLocaleString('en-PK', { 
                            minimumFractionDigits: 2, 
                            maximumFractionDigits: 2 
                          })}
                        </p>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-col sm:flex-row gap-3 mt-4 md:mt-0">
                        {/* Pay Now Button - Show only for ONLINE + PENDING */}
                        {booking.payment_method === 'ONLINE' && booking.status === 'PENDING' && (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => navigate(`/payment/${booking.id}`, { state: { booking } })}
                            className="px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                          >
                            💳 Complete Payment
                          </motion.button>
                        )}

                        {/* Cancel Booking Button - Show only for PENDING bookings */}
                        {booking.status === 'PENDING' && (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleCancelBooking(booking.id)}
                            disabled={cancelling === booking.id}
                            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-50"
                          >
                            {cancelling === booking.id ? '⏳ Cancelling...' : '❌ Cancel Booking'}
                          </motion.button>
                        )}

                        {/* View Details Button */}
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => navigate(`/booking/${booking.id}`)}
                          className="px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-lg font-semibold transition-colors"
                        >
                          View Details
                        </motion.button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Back Button */}
        <div className="mt-8 text-center">
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default MyBookings;