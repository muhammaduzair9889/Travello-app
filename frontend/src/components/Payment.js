import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaCheckCircle, FaCreditCard } from 'react-icons/fa';
import { bookingAPI } from '../services/api';

const Payment = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { booking } = location.state || {};

  const [loading, setLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  if (!booking) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">No booking found</p>
          <button
            onClick={() => navigate('/hotels')}
            className="px-6 py-3 bg-sky-600 text-white rounded-lg"
          >
            Browse Hotels
          </button>
        </div>
      </div>
    );
  }

  const handleConfirmPayment = async () => {
    setLoading(true);

    try {
      await bookingAPI.confirmPayment(booking.id);
      setPaymentSuccess(true);
      
      // Redirect to bookings page after 2 seconds
      setTimeout(() => {
        navigate('/my-bookings');
      }, 2000);
    } catch (error) {
      console.error('Error confirming payment:', error);
      alert(error.response?.data?.error || 'Payment failed. Please try again.');
      setLoading(false);
    }
  };

  if (paymentSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <FaCheckCircle className="text-green-600 dark:text-green-400 text-5xl" />
          </div>
          <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-4">
            Payment Successful!
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            Your booking has been confirmed.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Redirecting to your bookings...
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-sky-100 dark:bg-sky-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <FaCreditCard className="text-sky-600 dark:text-sky-400 text-3xl" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
              Complete Payment
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Review your booking details and confirm payment
            </p>
          </div>

          {/* Booking Summary */}
          <div className="mb-8 p-6 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
              Booking Summary
            </h2>
            
            <div className="space-y-3 text-gray-700 dark:text-gray-300">
              <div className="flex justify-between">
                <span>Hotel:</span>
                <span className="font-semibold">{booking.hotel_details?.hotel_name}</span>
              </div>
              <div className="flex justify-between">
                <span>Location:</span>
                <span>{booking.hotel_details?.location}</span>
              </div>
              <div className="flex justify-between">
                <span>Room Type:</span>
                <span className="capitalize">{booking.room_type}</span>
              </div>
              <div className="flex justify-between">
                <span>Number of Rooms:</span>
                <span>{typeof booking.rooms_booked === 'object' && booking.rooms_booked !== null ? (typeof booking.rooms_booked.rooms_booked === 'number' ? booking.rooms_booked.rooms_booked : 1) : (typeof booking.rooms_booked === 'number' ? booking.rooms_booked : 1)}</span>
              </div>
              <div className="flex justify-between">
                <span>Check-in:</span>
                <span>{new Date(booking.check_in_date).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Check-out:</span>
                <span>{new Date(booking.check_out_date).toLocaleDateString()}</span>
              </div>
              
              <div className="border-t border-gray-300 dark:border-gray-600 pt-3 mt-3">
                <div className="flex justify-between text-2xl font-bold text-sky-600 dark:text-sky-400">
                  <span>Total Amount:</span>
                  <span>PKR {parseFloat(booking.total_price).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Notice */}
          <div className="mb-8 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>Note:</strong> This is a simulated payment. In a real application, you would integrate with a payment gateway like Stripe or PayPal.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={() => navigate('/hotels')}
              disabled={loading}
              className="flex-1 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmPayment}
              disabled={loading}
              className="flex-1 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : 'Confirm Payment'}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Payment;