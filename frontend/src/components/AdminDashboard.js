import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaHotel, FaBook, FaUsers, FaSignOutAlt, FaBars } from 'react-icons/fa';
import { hotelAPI, bookingAPI } from '../services/api';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalHotels: 0,
    totalBookings: 0,
    totalRevenue: 0,
  });

  useEffect(() => {
    // Check if user is admin
    const isAdmin = localStorage.getItem('isAdmin') === 'true';
    if (!isAdmin) {
      navigate('/login');
      return;
    }
    
    fetchStats();
  }, [navigate]);

  const fetchStats = async () => {
    try {
      const hotelsResponse = await hotelAPI.getAllHotels();
      const bookingsResponse = await bookingAPI.getAllBookings();
      
      const totalRevenue = bookingsResponse.data
        .filter(b => b.payment_status)
        .reduce((sum, b) => sum + parseFloat(b.total_price), 0);
      
      setStats({
        totalHotels: hotelsResponse.data.length,
        totalBookings: bookingsResponse.data.length,
        totalRevenue: totalRevenue,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('isAdmin');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      {/* Top Navigation */}
      <header className="sticky top-0 z-10 w-full bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 sm:px-6 py-4 transition-colors duration-200">
        <div className="flex items-center gap-3 sm:gap-4">
          <FaBars className="text-gray-600 dark:text-gray-300 w-5 h-5 md:hidden cursor-pointer hover:text-gray-800 dark:hover:text-white transition-colors" />
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
              Admin Dashboard
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 hidden sm:block">
              Manage hotels and bookings
            </p>
          </div>
        </div>
        
        <button 
          onClick={handleSignOut}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 text-sm sm:text-base text-white bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 rounded-lg font-medium transition-all duration-200 shadow-sm hover:shadow-md"
        >
          <FaSignOutAlt />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="p-4 sm:p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5 sm:p-6 border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">Total Hotels</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white">{stats.totalHotels}</p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-sky-100 dark:bg-sky-900/30 rounded-lg flex items-center justify-center transition-colors">
                  <FaHotel className="text-sky-600 dark:text-sky-400 text-xl sm:text-2xl" />
                </div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5 sm:p-6 border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">Total Bookings</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white">{stats.totalBookings}</p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center transition-colors">
                  <FaBook className="text-purple-600 dark:text-purple-400 text-xl sm:text-2xl" />
                </div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5 sm:p-6 border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all duration-200 sm:col-span-2 lg:col-span-1"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">Total Revenue</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white">
                    PKR {stats.totalRevenue ? stats.totalRevenue.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                  </p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center transition-colors">
                  <FaUsers className="text-green-600 dark:text-green-400 text-xl sm:text-2xl" />
                </div>
              </div>
            </motion.div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <motion.button
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/admin/hotels')}
              className="p-6 sm:p-8 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <FaHotel className="text-3xl sm:text-4xl mb-3 sm:mb-4" />
              <h3 className="text-xl sm:text-2xl font-bold mb-2">Manage Hotels</h3>
              <p className="text-xs sm:text-sm opacity-90">Add, edit, or remove hotels from the system</p>
            </motion.button>

            <motion.button
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/admin/bookings')}
              className="p-6 sm:p-8 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <FaBook className="text-3xl sm:text-4xl mb-3 sm:mb-4" />
              <h3 className="text-xl sm:text-2xl font-bold mb-2">Manage Bookings</h3>
              <p className="text-xs sm:text-sm opacity-90">View, filter, and update all bookings</p>
            </motion.button>

            <motion.button
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';
                const baseUrl = apiUrl.replace(/\/api$/, '');
                const adminUrl = `${baseUrl}/admin/`;
                window.open(adminUrl, '_blank');
              }}
              className="p-6 sm:p-8 bg-gradient-to-r from-gray-600 to-gray-800 hover:from-gray-700 hover:to-gray-900 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <FaUsers className="text-3xl sm:text-4xl mb-3 sm:mb-4" />
              <h3 className="text-xl sm:text-2xl font-bold mb-2">Admin Panel</h3>
              <p className="text-xs sm:text-sm opacity-90">Open Django Admin (users, payments, data)</p>
            </motion.button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;