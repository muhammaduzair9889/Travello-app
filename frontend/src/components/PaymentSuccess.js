import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaCheckCircle, FaHome, FaBook } from 'react-icons/fa';

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [bookingId, setBookingId] = useState(null);
  const [sessionId, setSessionId] = useState(null);

  useEffect(() => {
    const booking = searchParams.get('booking_id');
    const session = searchParams.get('session_id');
    
    setBookingId(booking);
    setSessionId(session);

    // Auto redirect after 10 seconds
    const timer = setTimeout(() => {
      navigate('/dashboard');
    }, 10000);

    return () => clearTimeout(timer);
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 text-center"
      >
        {/* Success Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="mb-6"
        >
          <div className="mx-auto w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
            <FaCheckCircle className="text-6xl text-green-600 dark:text-green-400" />
          </div>
        </motion.div>

        {/* Success Message */}
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-4">
          Payment Successful! 🎉
        </h1>
        
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Your booking has been confirmed. You will receive a confirmation email shortly.
        </p>

        {/* Booking Details */}
        {bookingId && (
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Booking ID
            </p>
            <p className="font-mono font-bold text-gray-800 dark:text-white">
              {bookingId}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => navigate('/dashboard?tab=bookings')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <FaBook />
            View My Bookings
          </button>
          
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <FaHome />
            Back to Dashboard
          </button>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400 mt-6">
          Redirecting to dashboard in 10 seconds...
        </p>
      </motion.div>
    </div>
  );
};

export default PaymentSuccess;
