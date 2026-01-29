import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaCalendarAlt, FaUsers, FaBed } from 'react-icons/fa';
import { bookingAPI } from '../services/api';

const HotelBooking = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { hotel, roomType, checkIn, checkOut } = location.state || {};

  const [formData, setFormData] = useState({
    rooms: 1,
    checkInDate: checkIn || '',
    checkOutDate: checkOut || '',
  });

  const [loading, setLoading] = useState(false);

  if (!hotel || !roomType) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">No hotel selected</p>
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

  const getPricePerDay = () => {
    switch(roomType) {
      case 'single':
        return parseFloat(hotel.single_bed_price_per_day);
      case 'double':
        return parseFloat(hotel.double_bed_price_per_day || hotel.single_bed_price_per_day * 1.4);
      case 'triple':
        return parseFloat(hotel.triple_bed_price_per_day || hotel.single_bed_price_per_day * 1.6);
      case 'quad':
        return parseFloat(hotel.quad_bed_price_per_day || hotel.single_bed_price_per_day * 1.7);
      case 'family':
        return parseFloat(hotel.family_room_price_per_day);
      default:
        return parseFloat(hotel.single_bed_price_per_day);
    }
  };

  const pricePerDay = getPricePerDay();

  const calculateTotalPrice = () => {
    if (!formData.checkInDate || !formData.checkOutDate) return 0;
    
    const checkIn = new Date(formData.checkInDate);
    const checkOut = new Date(formData.checkOutDate);
    const days = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
    
    if (days <= 0) return 0;
    
    return days * pricePerDay * formData.rooms;
  };

  const totalPrice = calculateTotalPrice();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.checkInDate || !formData.checkOutDate) {
      alert('Please select check-in and check-out dates');
      return;
    }

    if (new Date(formData.checkOutDate) <= new Date(formData.checkInDate)) {
      alert('Check-out date must be after check-in date');
      return;
    }

    if (formData.rooms > hotel.available_rooms) {
      alert(`Only ${hotel.available_rooms} rooms available`);
      return;
    }

    setLoading(true);

    try {
      // Check if this is a scraped hotel
      if (hotel.is_scraped) {
        // For scraped hotels, show booking summary and contact info
        const confirmed = window.confirm(
          `📞 Direct Booking Required\n\n` +
          `Hotel: ${hotel.name}\n` +
          `Room Type: ${roomType}\n` +
          `Check-in: ${formData.checkInDate}\n` +
          `Check-out: ${formData.checkOutDate}\n` +
          `Total: PKR ${totalPrice.toLocaleString('en-PK')}\n\n` +
          `This hotel requires direct confirmation. ` +
          `We'll save your booking request and the hotel will contact you within 24 hours.\n\n` +
          `Click OK to proceed, or Cancel to go back.`
        );
        
        if (!confirmed) {
          setLoading(false);
          return;
        }
        
        // Create a local booking object for scraped hotels
        const localBooking = {
          id: `local-${Date.now()}`,
          hotel: hotel.name,
          hotel_name: hotel.name,
          location: hotel.location,
          room_type: roomType,
          rooms_booked: formData.rooms,
          check_in: formData.checkInDate,
          check_out: formData.checkOutDate,
          total_price: totalPrice,
          status: 'PENDING_CONFIRMATION',
          payment_method: 'ARRIVAL',
          is_scraped: true,
          created_at: new Date().toISOString()
        };
        
        // Save to localStorage for display in bookings page
        const savedBookings = JSON.parse(localStorage.getItem('scrapedBookings') || '[]');
        savedBookings.push(localBooking);
        localStorage.setItem('scrapedBookings', JSON.stringify(savedBookings));
        
        // Show success message
        alert('✅ Booking Request Submitted!\n\nYour booking request has been saved. The hotel will contact you within 24 hours to confirm availability and payment details.');
        
        // Redirect to bookings page
        navigate('/dashboard?tab=bookings');
        return;
      }
      
      // For database hotels, proceed with normal API call
      const bookingData = {
        hotel: hotel.id,
        room_type: roomType,
        rooms_booked: formData.rooms,
        check_in_date: formData.checkInDate,
        check_out_date: formData.checkOutDate,
        total_price: totalPrice,
      };

      const response = await bookingAPI.createBooking(bookingData);
      
      // Navigate to payment page with booking details
      navigate('/payment', { state: { booking: response.data } });
    } catch (error) {
      console.error('Error creating booking:', error);
      alert(error.response?.data?.error || 'Failed to create booking. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8"
        >
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-6">
            Confirm Your Booking
          </h1>

          {/* Hotel Summary */}
          <div className="mb-8 p-6 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
              {hotel.hotel_name}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              Location: {hotel.location}
            </p>
            <div className="flex items-center gap-2 mb-2">
              <FaBed className="text-sky-600" />
              <span className="text-gray-700 dark:text-gray-300">
                Room Type : <span className="font-semibold capitalize">{roomType}</span>
              </span>
            </div>
            <p className="text-lg font-bold text-sky-600 dark:text-sky-400">
              PKR {pricePerDay.toLocaleString('en-PK')} per day
            </p>
          </div>

          {/* Booking Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Number of Rooms */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Number of Rooms
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaUsers className="text-gray-400" />
                </div>
                <select
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={formData.rooms}
                  onChange={(e) => setFormData({ ...formData, rooms: parseInt(e.target.value) })}
                  required
                >
                  {[...Array(Math.min(hotel.available_rooms, 10)).keys()].map((n) => (
                    <option key={n + 1} value={n + 1}>
                      {n + 1} {n + 1 === 1 ? 'Room' : 'Rooms'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Check-in Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Check-in Date
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaCalendarAlt className="text-gray-400" />
                </div>
                <input
                  type="date"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={formData.checkInDate}
                  onChange={(e) => setFormData({ ...formData, checkInDate: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
            </div>

            {/* Check-out Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Check-out Date
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaCalendarAlt className="text-gray-400" />
                </div>
                <input
                  type="date"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={formData.checkOutDate}
                  onChange={(e) => setFormData({ ...formData, checkOutDate: e.target.value })}
                  min={formData.checkInDate || new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
            </div>

            {/* Price Summary */}
            {totalPrice > 0 && (
              <div className="p-6 bg-sky-50 dark:bg-sky-900/30 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                  Price Summary
                </h3>
                <div className="space-y-2 text-gray-700 dark:text-gray-300">
                  <div className="flex justify-between">
                    <span>Price per day:</span>
                    <span>PKR {pricePerDay.toLocaleString('en-PK')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Number of rooms:</span>
                    <span>{formData.rooms}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Number of days:</span>
                    <span>
                      {Math.ceil((new Date(formData.checkOutDate) - new Date(formData.checkInDate)) / (1000 * 60 * 60 * 24))}
                    </span>
                  </div>
                  <div className="border-t border-gray-300 dark:border-gray-600 pt-2 mt-2">
                    <div className="flex justify-between text-xl font-bold text-sky-600 dark:text-sky-400">
                      <span>Total Price:</span>
                      <span>PKR {totalPrice.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => navigate('/hotels')}
                className="flex-1 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || totalPrice === 0}
                className="flex-1 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Processing...' : 'Proceed to Payment'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default HotelBooking;