import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaWifi, FaParking, FaStar, FaSearch, FaMapMarkerAlt, FaUtensils, FaClock } from 'react-icons/fa';
import { hotelAPI } from '../services/api';

const HotelsList = () => {
  const navigate = useNavigate();
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchHotels();
  }, []);

  // Memoized filtered hotels - only recomputes when dependencies change
  const filteredHotels = useMemo(() => {
    if (!searchQuery) return hotels;
    
    const query = searchQuery.toLowerCase();
    return hotels.filter(
      (hotel) =>
        hotel.name?.toLowerCase().includes(query) ||
        hotel.address?.toLowerCase().includes(query) ||
        hotel.city?.toLowerCase().includes(query)
    );
  }, [searchQuery, hotels]);

  const fetchHotels = async () => {
    try {
      const response = await hotelAPI.getAllHotels();
      setHotels(response.data);
    } catch (error) {
      console.error('Error fetching hotels:', error);
      alert('Failed to load hotels. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBookRoom = useCallback((hotel, roomType) => {
    navigate(`/hotels/${hotel.id}`, { state: { roomType } });
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-sky-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading hotels...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white mb-2">
            Browse Hotels
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            Find and book your perfect stay
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-6 sm:mb-8">
          <div className="relative max-w-2xl">
            <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
              <FaSearch className="text-gray-400 text-sm sm:text-base" />
            </div>
            <input
              type="text"
              className="w-full pl-10 sm:pl-12 pr-4 py-3 sm:py-4 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm sm:text-base"
              placeholder="Search by hotel name or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Hotels Grid */}
        {filteredHotels.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              No hotels found. Try a different search.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredHotels.map((hotel) => (
              <motion.div
                key={hotel.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-shadow"
              >
                {/* Hotel Image */}
                <div className="h-48 bg-gradient-to-r from-sky-400 to-blue-500 relative overflow-hidden">
                  {hotel.image ? (
                    <img
                      src={hotel.image}
                      alt={hotel.name || 'Hotel'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white text-4xl font-bold">
                      {(hotel.name || 'H').charAt(0)}
                    </div>
                  )}
                  {/* Rating Badge */}
                  <div className="absolute top-4 right-4 bg-white dark:bg-gray-800 px-3 py-1 rounded-full flex items-center gap-1">
                    <FaStar className="text-yellow-500" />
                    <span className="font-semibold text-gray-800 dark:text-white">
                      {Number(hotel.rating ?? 0).toFixed(1)}
                    </span>
                  </div>
                </div>

                {/* Hotel Details */}
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                    {hotel.name || 'Hotel'}
                  </h3>
                  
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-3">
                    <FaMapMarkerAlt className="text-sky-600" />
                    <span className="text-sm">{hotel.city}</span>
                  </div>

                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                    {hotel.description}
                  </p>

                  {/* Amenities */}
                  <div className="flex flex-wrap gap-3 mb-4">
                    {hotel.wifi_available && (
                      <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                        <FaWifi className="text-sky-600" />
                        <span>WiFi</span>
                      </div>
                    )}
                    {hotel.parking_available && (
                      <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                        <FaParking className="text-sky-600" />
                        <span>Parking</span>
                      </div>
                    )}
                    {hotel.breakfast_available && (
                      <div className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400 font-semibold">
                        <FaUtensils className="text-green-600 dark:text-green-400" />
                        <span>Breakfast</span>
                      </div>
                    )}
                  </div>

                  {/* Additional Details */}
                  <div className="flex items-center justify-between mb-4 text-xs text-gray-500 dark:text-gray-400">
                    {hotel.reviewCount > 0 && (
                      <div className="flex items-center gap-1">
                        <FaStar className="text-yellow-500" />
                        <span>{hotel.reviewCount} reviews</span>
                      </div>
                    )}
                    {hotel.lastBooked && (
                      <div className="flex items-center gap-1">
                        <FaClock className="text-gray-400" />
                        <span>Last booked {hotel.lastBooked}</span>
                      </div>
                    )}
                  </div>

                  {/* Availability */}
                  <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Available Rooms: <span className="font-semibold text-gray-800 dark:text-white">{hotel.available_rooms}</span> / {hotel.total_rooms}
                    </p>
                  </div>

                  {/* Pricing - Room Types from API */}
                  {(hotel.room_types || []).length > 0 ? (
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {hotel.room_types.slice(0, 4).map((rt) => {
                        const colors = {
                          single: { bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400' },
                          double: { bg: 'bg-green-50 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400' },
                          triple: { bg: 'bg-orange-50 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400' },
                          quad: { bg: 'bg-yellow-50 dark:bg-yellow-900/30', text: 'text-yellow-600 dark:text-yellow-400' },
                          family: { bg: 'bg-purple-50 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400' },
                        };
                        const color = colors[rt.type] || colors.single;
                        return (
                          <div key={rt.id} className={`text-center p-2 ${color.bg} rounded-lg`}>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1 capitalize">{rt.type} Room</p>
                            <p className={`text-base font-bold ${color.text}`}>
                              PKR {Number(rt.price_per_night).toLocaleString('en-PK')}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">per day</p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mb-4 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-center">
                      <p className="text-xs text-gray-600 dark:text-gray-400">Room types not configured</p>
                    </div>
                  )}

                  {/* Booking Buttons - Dynamic Room Types */}
                  {(hotel.room_types || []).length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {hotel.room_types.map((rt) => {
                        const colors = {
                          single: 'bg-blue-600 hover:bg-blue-700',
                          double: 'bg-green-600 hover:bg-green-700',
                          triple: 'bg-orange-600 hover:bg-orange-700',
                          quad: 'bg-yellow-600 hover:bg-yellow-700',
                          family: 'bg-purple-600 hover:bg-purple-700',
                        };
                        const btnColor = colors[rt.type] || colors.single;
                        return (
                          <button
                            key={rt.id}
                            onClick={() => handleBookRoom(hotel, rt.type)}
                            disabled={rt.available_rooms === 0}
                            className={`py-2 ${btnColor} text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs capitalize`}
                          >
                            Book {rt.type}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <button
                      onClick={() => handleBookRoom(hotel, 'single')}
                      disabled={hotel.available_rooms === 0}
                      className="w-full py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                      title={hotel.available_rooms === 0 ? 'No rooms available' : 'Book now'}
                    >
                      Book Now
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Back Button */}
        <div className="mt-8 text-center">
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default HotelsList;