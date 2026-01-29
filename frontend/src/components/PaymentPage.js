import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaCreditCard, FaSpinner, FaExclamationTriangle } from 'react-icons/fa';
import { bookingAPI, paymentAPI } from '../services/api';

/**
 * PaymentPage Component
 * 
 * Handles ONLINE payment flow:
 * 1. Receives booking_id from route params or location state
 * 2. Fetches booking details
 * 3. Creates Stripe Checkout session
 * 4. Redirects user to Stripe
 * 
 * Route: /payment/:booking_id
 * Alternative: /payment with location.state.booking_id
 */
const PaymentPage = () => {
  const navigate = useNavigate();
  const { bookingId: paramBookingId } = useParams();
  const location = useLocation();
  const stateBookingId = location.state?.booking_id || location.state?.bookingId;

  const bookingId = paramBookingId || stateBookingId;

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  // Fetch booking details
  useEffect(() => {
    const fetchBooking = async () => {
      if (!bookingId) {
        setError('No booking ID provided');
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const response = await bookingAPI.getBooking(bookingId);
        const bookingData = response.data?.booking || response.data;
        
        // Verify payment method is ONLINE
        if (bookingData.payment_method !== 'ONLINE') {
          setError('This booking is not set for online payment');
          setLoading(false);
          return;
        }

        // Verify booking is not already paid
        if (bookingData.status === 'PAID') {
          setError('This booking has already been paid');
          setLoading(false);
          return;
        }

        setBooking(bookingData);
        setError(null);
      } catch (err) {
        console.error('Error fetching booking:', err);
        const errorMsg = err.response?.data?.error || err.response?.data?.detail || 'Failed to load booking details';
        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    };

    fetchBooking();
  }, [bookingId]);

  // Create payment session and redirect to Stripe
  const handleCreateSession = async () => {
    if (!bookingId) {
      setError('Missing booking ID');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const response = await paymentAPI.createSession(bookingId);
      const sessionUrl = response.data?.session_url;

      if (!sessionUrl) {
        throw new Error('No session URL received from server');
      }

      // Redirect to Stripe Checkout
      window.location.href = sessionUrl;
    } catch (err) {
      console.error('Error creating payment session:', err);
      const errorMsg = err.response?.data?.error || err.message || 'Failed to create payment session';
      setError(errorMsg);
      setCreating(false);
    }
  };

  // Auto-create session on mount if booking is ready
  useEffect(() => {
    if (booking && !creating && !error && loading === false) {
      // Small delay to ensure UI is rendered before redirecting
      const timer = setTimeout(() => {
        handleCreateSession();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [booking, creating, error, loading]);

  if (!bookingId) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <FaExclamationTriangle className="text-red-600 dark:text-red-400 text-2xl" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Invalid Request</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            No booking ID provided. Please make sure you're coming from a valid booking.
          </p>
          <button
            onClick={() => navigate('/hotels')}
            className="px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium transition-colors"
          >
            Back to Hotels
          </button>
        </motion.div>
      </div>
    );
  }

  if (error && !booking) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <FaExclamationTriangle className="text-red-600 dark:text-red-400 text-2xl" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Error</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/my-bookings')}
              className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
            >
              My Bookings
            </button>
            <button
              onClick={() => navigate('/hotels')}
              className="flex-1 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium transition-colors"
            >
              Browse Hotels
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const hotelName = booking?.hotel_details?.name || booking?.hotel || 'Hotel';
  const roomType = booking?.room_type_details?.type || booking?.room_type;
  const totalPrice = parseFloat(booking?.total_price || 0);
  const checkIn = booking?.check_in ? new Date(booking.check_in).toLocaleDateString() : '—';
  const checkOut = booking?.check_out ? new Date(booking.check_out).toLocaleDateString() : '—';
  const nights = booking?.number_of_nights || 0;
  const rooms = booking?.rooms_booked || 1;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-sky-500 to-blue-600 px-6 py-8 text-white">
            <div className="flex items-center gap-3 mb-2">
              <FaCreditCard className="text-2xl" />
              <h1 className="text-3xl font-bold">Secure Payment</h1>
            </div>
            <p className="text-sky-100">Complete your booking with Stripe</p>
          </div>

          <div className="p-6 sm:p-8">
            {/* Loading State */}
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-sky-100 dark:bg-sky-900/30 rounded-full mb-4">
                  <FaSpinner className="text-sky-600 dark:text-sky-400 text-2xl animate-spin" />
                </div>
                <p className="text-gray-600 dark:text-gray-400">Loading booking details...</p>
              </div>
            ) : booking ? (
              <>
                {/* Booking Summary */}
                <div className="mb-8 p-6 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Booking Summary</h2>

                  <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Hotel:</span>
                      <span className="font-semibold">{hotelName}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Room Type:</span>
                      <span className="font-semibold capitalize">{roomType}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Check-in:</span>
                      <span className="font-semibold">{checkIn}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Check-out:</span>
                      <span className="font-semibold">{checkOut}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Number of Nights:</span>
                      <span className="font-semibold">{nights}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Number of Rooms:</span>
                      <span className="font-semibold">{rooms}</span>
                    </div>

                    <div className="border-t border-gray-200 dark:border-gray-600 pt-3 mt-3">
                      <div className="flex justify-between text-lg font-bold text-sky-600 dark:text-sky-400">
                        <span>Total Amount:</span>
                        <span>
                          PKR {totalPrice.toLocaleString('en-PK', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info Box */}
                <div className="mb-8 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    You will be redirected to Stripe Checkout to complete your payment securely.
                  </p>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg">
                    <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => navigate('/my-bookings')}
                    disabled={creating}
                    className="flex-1 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateSession}
                    disabled={creating}
                    className="flex-1 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {creating ? (
                      <>
                        <FaSpinner className="animate-spin" />
                        Redirecting to Stripe...
                      </>
                    ) : (
                      <>
                        <FaCreditCard />
                        Pay Now with Stripe
                      </>
                    )}
                  </button>
                </div>

                {/* Security Info */}
                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    🔒 Your payment information is secure and encrypted. Powered by Stripe.
                  </p>
                </div>
              </>
            ) : null}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default PaymentPage;
