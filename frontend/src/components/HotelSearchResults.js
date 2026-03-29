import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaSearch,
  FaMapMarkerAlt,
  FaStar,
  FaHeart,
  FaRegHeart,
  FaWifi,
  FaParking,
  FaSwimmingPool,
  FaUtensils,
  FaCoffee,
  FaBath,
  FaTv,
  FaDumbbell,
  FaSnowflake,
  FaConciergeBell,
  FaSpa,
  FaShuttleVan,
  FaGlassMartini,
  FaTimes,
  FaChevronDown,
  FaChevronUp,
  FaFilter,
  FaSort,
  FaCalendarAlt,
  FaUsers,
  FaBed,
  FaArrowLeft,
  FaCheck,
  FaFire,
  FaClock,
  FaPercent,
  FaThumbsUp,
  FaMap,
  FaExclamationTriangle,
  FaRobot
} from 'react-icons/fa';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const API_ROOT = (process.env.REACT_APP_API_URL || process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000')
  .replace(/\/api\/?$/, '');

// Fix for default marker icons in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Custom hotel marker icon
const createHotelIcon = (price, isActive) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background: ${isActive ? '#0071c2' : '#fff'};
      color: ${isActive ? '#fff' : '#0071c2'};
      padding: 6px 10px;
      border-radius: 6px;
      border: 2px solid #0071c2;
      font-weight: bold;
      font-size: 12px;
      white-space: nowrap;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      transform: translate(-50%, -100%);
    ">PKR ${price?.toLocaleString() || 'N/A'}</div>`,
    iconSize: [80, 40],
    iconAnchor: [40, 40],
  });
};

// Map controller component
function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);
  return null;
}

// Loading Screen Component with Animation
const LoadingScreen = ({ searchParams }) => {
  const [loadingStage, setLoadingStage] = useState(0);
  const [dotsCount, setDotsCount] = useState(1);

  const loadingMessages = [
    'Connecting',
    'Searching available hotels',
    'Fetching real-time prices',
    'Comparing room options',
    'Verifying availability',
    'Almost ready — finalizing results'
  ];

  useEffect(() => {
    const stageInterval = setInterval(() => {
      setLoadingStage(prev => (prev < loadingMessages.length - 1 ? prev + 1 : prev));
    }, 6000); // 6s per stage = ~36s total to cycle through

    const dotsInterval = setInterval(() => {
      setDotsCount(prev => (prev < 3 ? prev + 1 : 1));
    }, 500);

    return () => {
      clearInterval(stageInterval);
      clearInterval(dotsInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-sky-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
      <div className="text-center max-w-lg px-6">
        {/* Animated Hotel Icon */}
        <div className="relative mb-8">
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="w-32 h-32 mx-auto bg-gradient-to-br from-blue-500 to-sky-600 rounded-3xl flex items-center justify-center shadow-2xl"
          >
            <FaSearch className="text-white text-5xl" />
          </motion.div>

          {/* Orbiting dots */}
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute w-4 h-4 bg-sky-400 rounded-full"
              style={{
                top: '50%',
                left: '50%',
              }}
              animate={{
                x: [0, Math.cos((i * 120 + 360) * Math.PI / 180) * 80, 0],
                y: [0, Math.sin((i * 120 + 360) * Math.PI / 180) * 80, 0],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.3,
                ease: "easeInOut"
              }}
            />
          ))}
        </div>

        {/* Search Info */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
            Searching Hotels in {searchParams?.destination || 'Lahore'}
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            {searchParams?.checkIn && searchParams?.checkOut && (
              <span>
                {new Date(searchParams.checkIn).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {' - '}
                {new Date(searchParams.checkOut).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                {' • '}
              </span>
            )}
            {searchParams?.adults || 2} adults
            {searchParams?.children > 0 && `, ${searchParams.children} children`}
          </p>
        </div>

        {/* Progress Steps */}
        <div className="space-y-3 mb-8">
          {loadingMessages.map((message, index) => (
            <motion.div
              key={message}
              initial={{ opacity: 0, x: -20 }}
              animate={{
                opacity: index <= loadingStage ? 1 : 0.3,
                x: 0
              }}
              transition={{ delay: index * 0.3 }}
              className="flex items-center gap-3"
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${index < loadingStage
                ? 'bg-green-500'
                : index === loadingStage
                  ? 'bg-blue-500 animate-pulse'
                  : 'bg-gray-300 dark:bg-gray-600'
                }`}>
                {index < loadingStage ? (
                  <FaCheck className="text-white text-xs" />
                ) : index === loadingStage ? (
                  <div className="w-2 h-2 bg-white rounded-full animate-ping" />
                ) : (
                  <div className="w-2 h-2 bg-gray-400 rounded-full" />
                )}
              </div>
              <span className={`text-sm ${index <= loadingStage
                ? 'text-gray-800 dark:text-white font-medium'
                : 'text-gray-400 dark:text-gray-500'
                }`}>
                {message}
                {index === loadingStage && '.'.repeat(dotsCount)}
              </span>
            </motion.div>
          ))}
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 to-sky-400"
            initial={{ width: '0%' }}
            animate={{ width: `${((loadingStage + 1) / loadingMessages.length) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>

        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          Finding the best deals from 1000+ properties
        </p>
      </div>
    </div>
  );
};

// Filter Sidebar Component
const FilterSidebar = ({
  filters,
  setFilters,
  priceRange,
  setPriceRange,
  maxPrice,
  minPrice,
  hotels,
  onClearAll
}) => {
  const [expandedSections, setExpandedSections] = useState({
    budget: true,
    rating: true,
    stars: true,
    propertyType: true,
    amenities: true,
    meals: true
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const FilterSection = ({ title, section, children }) => (
    <div className="border-b border-gray-200 dark:border-gray-700 py-4">
      <button
        onClick={() => toggleSection(section)}
        className="flex items-center justify-between w-full text-left"
      >
        <h4 className="font-semibold text-gray-800 dark:text-white">{title}</h4>
        {expandedSections[section] ? (
          <FaChevronUp className="text-gray-500" />
        ) : (
          <FaChevronDown className="text-gray-500" />
        )}
      </button>
      <AnimatePresence>
        {expandedSections[section] && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  const amenitiesList = [
    { id: 'wifi', label: 'Free WiFi', icon: FaWifi },
    { id: 'parking', label: 'Free Parking', icon: FaParking },
    { id: 'pool', label: 'Swimming Pool', icon: FaSwimmingPool },
    { id: 'restaurant', label: 'Restaurant', icon: FaUtensils },
    { id: 'airConditioning', label: 'Air Conditioning', icon: FaSnowflake },
    { id: 'gym', label: 'Gym/Fitness', icon: FaDumbbell },
    { id: 'spa', label: 'Spa', icon: FaSpa },
    { id: 'roomService', label: 'Room Service', icon: FaConciergeBell },
    { id: 'bar', label: 'Bar/Lounge', icon: FaGlassMartini },
    { id: 'shuttle', label: 'Airport Shuttle', icon: FaShuttleVan },
    { id: 'tv', label: 'TV', icon: FaTv },
    { id: 'coffeeMaker', label: 'Coffee/Tea Maker', icon: FaCoffee },
    { id: 'bathtub', label: 'Bathtub', icon: FaBath }
  ];

  const propertyTypes = [
    { id: 'hotel', label: 'Hotel' },
    { id: 'apartment', label: 'Apartment/Flat' },
    { id: 'guesthouse', label: 'Guesthouse/B&B' },
    { id: 'resort', label: 'Resort' },
    { id: 'villa', label: 'Villa' },
    { id: 'hostel', label: 'Hostel' },
    { id: 'homestay', label: 'Homestay' }
  ];

  const mealOptions = [
    { id: 'breakfast', label: 'Breakfast Included' },
    { id: 'halfBoard', label: 'Half Board' },
    { id: 'fullBoard', label: 'Full Board' },
    { id: 'allInclusive', label: 'All Inclusive' },
    { id: 'selfCatering', label: 'Self Catering' }
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5 sticky top-24">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <FaFilter className="text-blue-600" />
          Filters
        </h3>
        <button
          onClick={onClearAll}
          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
        >
          Clear all
        </button>
      </div>

      {/* Budget/Price Range */}
      <FilterSection title="Your budget (per night)" section="budget">
        <div className="space-y-4">
          <input
            type="range"
            min={minPrice}
            max={maxPrice}
            value={priceRange.max}
            onChange={(e) => setPriceRange(prev => ({ ...prev, max: parseInt(e.target.value) }))}
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-gray-500 dark:text-gray-400">MIN</label>
              <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1">
                <span className="text-xs text-gray-500">PKR</span>
                <input
                  type="number"
                  value={priceRange.min}
                  onChange={(e) => setPriceRange(prev => ({ ...prev, min: parseInt(e.target.value) || 0 }))}
                  className="w-full bg-transparent text-sm text-gray-800 dark:text-white outline-none pl-1"
                />
              </div>
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500 dark:text-gray-400">MAX</label>
              <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1">
                <span className="text-xs text-gray-500">PKR</span>
                <input
                  type="number"
                  value={priceRange.max}
                  onChange={(e) => setPriceRange(prev => ({ ...prev, max: parseInt(e.target.value) || maxPrice }))}
                  className="w-full bg-transparent text-sm text-gray-800 dark:text-white outline-none pl-1"
                />
              </div>
            </div>
          </div>
        </div>
      </FilterSection>

      {/* Guest Rating */}
      <FilterSection title="Guest rating" section="rating">
        <div className="space-y-2">
          {[
            { value: 9, label: 'Exceptional', sublabel: '9+' },
            { value: 8, label: 'Excellent', sublabel: '8+' },
            { value: 7, label: 'Very Good', sublabel: '7+' },
            { value: 6, label: 'Good', sublabel: '6+' }
          ].map(rating => {
            const count = hotels.filter(h => (h.rating || 0) >= rating.value).length;
            return (
              <label key={rating.value} className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="radio"
                  name="rating"
                  checked={filters.rating === rating.value}
                  onChange={() => setFilters(prev => ({
                    ...prev,
                    rating: prev.rating === rating.value ? null : rating.value
                  }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="flex-1 text-gray-700 dark:text-gray-300 group-hover:text-blue-600">
                  {rating.label} ({rating.sublabel})
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">({count})</span>
              </label>
            );
          })}
        </div>
      </FilterSection>

      {/* Star Rating */}
      <FilterSection title="Star rating" section="stars">
        <div className="flex flex-wrap gap-2">
          {[5, 4, 3, 2, 1].map(star => (
            <button
              key={star}
              onClick={() => {
                setFilters(prev => ({
                  ...prev,
                  stars: prev.stars === star ? null : star
                }));
              }}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg border transition-all ${filters.stars === star
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
                }`}
            >
              {star}
              <FaStar className={filters.stars === star ? 'text-yellow-300' : 'text-yellow-500'} />
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Property Type */}
      <FilterSection title="Property type" section="propertyType">
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {propertyTypes.map(type => {
            const count = hotels.filter(h =>
              h.property_type?.toLowerCase().includes(type.id) ||
              h.name?.toLowerCase().includes(type.id)
            ).length;
            return (
              <label key={type.id} className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={filters.propertyTypes?.includes(type.id) || false}
                  onChange={(e) => {
                    setFilters(prev => ({
                      ...prev,
                      propertyTypes: e.target.checked
                        ? [...(prev.propertyTypes || []), type.id]
                        : (prev.propertyTypes || []).filter(t => t !== type.id)
                    }));
                  }}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="flex-1 text-gray-700 dark:text-gray-300 group-hover:text-blue-600">
                  {type.label}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">({count})</span>
              </label>
            );
          })}
        </div>
      </FilterSection>

      {/* Amenities */}
      <FilterSection title="Popular amenities" section="amenities">
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {amenitiesList.map(amenity => {
            const Icon = amenity.icon;
            return (
              <label key={amenity.id} className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={filters.amenities?.[amenity.id] || false}
                  onChange={(e) => {
                    setFilters(prev => ({
                      ...prev,
                      amenities: {
                        ...prev.amenities,
                        [amenity.id]: e.target.checked
                      }
                    }));
                  }}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <Icon className="text-gray-500 dark:text-gray-400 w-4 h-4" />
                <span className="flex-1 text-gray-700 dark:text-gray-300 group-hover:text-blue-600">
                  {amenity.label}
                </span>
              </label>
            );
          })}
        </div>
      </FilterSection>

      {/* Meal Options */}
      <FilterSection title="Meals" section="meals">
        <div className="space-y-2">
          {mealOptions.map(meal => (
            <label key={meal.id} className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={filters.meals?.[meal.id] || false}
                onChange={(e) => {
                  setFilters(prev => ({
                    ...prev,
                    meals: {
                      ...prev.meals,
                      [meal.id]: e.target.checked
                    }
                  }));
                }}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="flex-1 text-gray-700 dark:text-gray-300 group-hover:text-blue-600">
                {meal.label}
              </span>
            </label>
          ))}
        </div>
      </FilterSection>
    </div>
  );
};

// Hotel Card Component — Booking.com Production Style
const HotelCard = ({ hotel, searchParams, isFavorite, onToggleFavorite, onBook, isActive }) => {
  const getPrice = () => {
    return hotel.double_bed_price_per_day || hotel.single_bed_price_per_day || hotel.price || 0;
  };

  const getRatingLabel = (rating) => {
    if (rating >= 9) return 'Exceptional';
    if (rating >= 8) return 'Excellent';
    if (rating >= 7) return 'Very Good';
    if (rating >= 6) return 'Good';
    return 'Pleasant';
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0
    }).format(price);
  };

  const calculateNights = () => {
    if (!searchParams?.checkIn || !searchParams?.checkOut) return 1;
    const checkIn = new Date(searchParams.checkIn);
    const checkOut = new Date(searchParams.checkOut);
    return Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24)) || 1;
  };

  const nights = calculateNights();
  const pricePerNight = getPrice();
  const totalPrice = pricePerNight * nights;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0, scale: isActive ? 1.02 : 1 }}
      transition={{ duration: 0.3 }}
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-xl transition-all overflow-hidden border ${isActive ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-200 dark:border-gray-700'
        }`}
    >
      <div className="flex flex-col md:flex-row">
        {/* Hotel Image */}
        <div className="relative w-full md:w-72 h-52 md:h-auto flex-shrink-0">
          <img
            src={hotel.image || 'https://via.placeholder.com/400x300?text=Hotel'}
            alt={hotel.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.src = 'https://via.placeholder.com/400x300?text=Hotel+Image';
            }}
          />

          {/* Favorite Button */}
          <button
            onClick={() => onToggleFavorite(hotel.id)}
            className="absolute top-3 right-3 w-10 h-10 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
          >
            {isFavorite ? (
              <FaHeart className="text-red-500 text-lg" />
            ) : (
              <FaRegHeart className="text-gray-600 dark:text-gray-400 text-lg" />
            )}
          </button>

          {/* Badges Stack */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {hotel.is_genius && (
              <span className="bg-blue-700 text-white text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1">
                <FaThumbsUp className="text-[10px]" /> Genius
              </span>
            )}
            {hotel.sustainability_badge && (
              <span className="bg-emerald-600 text-white text-xs font-bold px-2 py-0.5 rounded">
                🌱 Sustainable
              </span>
            )}
            {hotel.has_deal && (
              <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                <FaPercent className="text-[10px]" /> {hotel.deal_label || 'Deal'}
              </span>
            )}
            {hotel.is_sold_out && (
              <span className="bg-gray-600 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                Sold Out
              </span>
            )}
            {hotel.is_limited && !hotel.is_sold_out && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                <FaFire className="text-[10px]" /> {hotel.rooms_left ? `Only ${hotel.rooms_left} left!` : 'Few left!'}
              </span>
            )}
          </div>
        </div>

        {/* Hotel Details */}
        <div className="flex-1 p-5 flex flex-col">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                {hotel.stars && (
                  <div className="flex">
                    {[...Array(hotel.stars)].map((_, i) => (
                      <FaStar key={i} className="text-yellow-500 text-sm" />
                    ))}
                  </div>
                )}
                {hotel.property_type && (
                  <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded">
                    {hotel.property_type}
                  </span>
                )}
              </div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-white hover:text-blue-600 cursor-pointer">
                {hotel.name}
              </h3>
              <div className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 mt-1">
                <FaMapMarkerAlt />
                <span className="hover:underline cursor-pointer">{hotel.address || hotel.location}</span>
                {hotel.distance_from_center && (
                  <span className="text-gray-500 dark:text-gray-400 ml-2">
                    • {hotel.distance_from_center}
                  </span>
                )}
              </div>
            </div>

            {/* Rating Badge */}
            {hotel.rating > 0 && (
              <div className="text-right flex-shrink-0 ml-4">
                <div className="flex items-center gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-white text-right">
                      {getRatingLabel(hotel.rating)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {hotel.review_count ? `${hotel.review_count} reviews` : ''}
                    </p>
                  </div>
                  <div className="bg-blue-600 text-white px-2.5 py-1.5 rounded-lg rounded-bl-none font-bold">
                    {hotel.rating.toFixed(1)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* AI Match Info (for AI recommendations) */}
          {hotel.match_score > 0 && (
            <div className="flex items-start gap-2 my-2 bg-blue-50 dark:bg-blue-900/15 border border-blue-100 dark:border-blue-800 rounded-lg px-3 py-2">
              <FaRobot className="text-blue-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 rounded-full">
                    {Math.round(hotel.match_score * 100)}% match
                  </span>
                </div>
                {hotel.ai_reason && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 leading-snug">{hotel.ai_reason}</p>
                )}
              </div>
            </div>
          )}

          {/* Amenities */}
          <div className="flex flex-wrap gap-2 my-3">
            {hotel.wifi_available && (
              <span className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                <FaWifi /> Free WiFi
              </span>
            )}
            {hotel.parking_available && (
              <span className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                <FaParking /> Parking
              </span>
            )}
            {hotel.amenities?.slice(0, 3).map((amenity, idx) => (
              <span key={idx} className="text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                {amenity}
              </span>
            ))}
          </div>

          {/* Room Type Badge — real Booking.com room type */}
          <div className="flex items-center flex-wrap gap-1.5 my-2">
            {/* Room type badge — color varies by type */}
            {(() => {
              const colors = {
                'Double Room': 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-700',
                'Triple Room': 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-700',
                'Quad Room': 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-700',
                'Quint Room': 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-700',
                'Family Room': 'bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-900/40 dark:text-pink-300 dark:border-pink-700',
                'Suite': 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-700',
                'Deluxe Room': 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700',
                'Single Room': 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600',
                'Dormitory': 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/40 dark:text-teal-300 dark:border-teal-700',
                'Entire Property': 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700',
              };
              // Show ALL room types from the rooms array
              const roomTypes = hotel.rooms?.length > 0
                ? [...new Set(hotel.rooms.map(r => r.room_type).filter(Boolean))]
                : [(hotel.room_type || 'Standard Room')];

              return roomTypes.map((rt, idx) => {
                const c = colors[rt] || 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700';
                return (
                  <span key={idx} className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${c}`}>
                    <FaBed className="shrink-0" />
                    {rt}
                  </span>
                );
              });
            })()}
            {hotel.meal_plan && (
              <span className="inline-flex items-center text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full border border-green-200 dark:border-green-700">
                {hotel.meal_plan}
              </span>
            )}
            {hotel.cancellation_policy === 'Free Cancellation' && (
              <span className="inline-flex items-center text-xs font-medium bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-700">
                Free Cancel
              </span>
            )}
          </div>

          {/* Room Info & Availability */}
          {hotel.availability_status && (
            <p className={`text-sm mb-2 ${
              hotel.is_sold_out ? 'text-gray-500 dark:text-gray-400 font-medium' :
              hotel.is_limited ? 'text-red-600 dark:text-red-400 font-medium' :
              'text-green-600 dark:text-green-400'
              }`}>
              <FaClock className="inline mr-1" />
              {hotel.availability_status}
            </p>
          )}

          {/* Price & CTA */}
          <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-700 flex items-end justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {nights} night{nights > 1 ? 's' : ''}, {searchParams?.adults || 2} adult{(searchParams?.adults || 2) > 1 ? 's' : ''}
              </p>
              {/* Show crossed-out original price if deal exists */}
              {hotel.original_price && hotel.price_per_night && hotel.original_price > hotel.price_per_night && (
                <div className="flex items-center gap-2">
                  <p className="text-sm text-gray-400 line-through">
                    PKR {formatPrice(Math.round(hotel.original_price / (hotel.nights || 1)))}
                  </p>
                  <span className="text-xs font-bold text-green-600 bg-green-50 dark:bg-green-900/30 dark:text-green-400 px-1.5 py-0.5 rounded">
                    -{Math.round((1 - hotel.price_per_night / hotel.original_price) * 100)}%
                  </span>
                </div>
              )}
              <p className="text-3xl font-bold text-gray-800 dark:text-white">
                {pricePerNight ? `PKR ${formatPrice(pricePerNight)}` : <span className="text-lg text-gray-400">Price on request</span>}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {pricePerNight
                  ? <>
                      {hotel.taxes_text
                        ? <span className="text-xs">{hotel.taxes_text}</span>
                        : <span>+taxes & fees</span>}
                      <span className="ml-1">• Total: PKR {formatPrice(totalPrice)}</span>
                    </>
                  : 'See availability for prices'}
              </p>
            </div>

            <div className="flex flex-col items-end gap-2">
              <button
                onClick={() => onBook(hotel)}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors shadow-md hover:shadow-lg whitespace-nowrap"
              >
                See availability
              </button>
              {hotel.cancellation_policy === 'Free Cancellation' && (
                <span className="text-xs text-green-600 dark:text-green-400 font-medium">Free cancellation</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// Main Component
const HotelSearchResults = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const initialSearchParams = location.state || {};

  // Detect AI recommendation mode
  const isAiRecommendation = !!initialSearchParams.aiRecommendation;
  const aiHotels = initialSearchParams.aiHotels || [];
  const aiSummary = initialSearchParams.aiSummary || '';
  const aiProfile = initialSearchParams.aiProfile || {};
  const aiTotalFound = initialSearchParams.aiTotalFound || 0;
  const aiMatchedAttractions = initialSearchParams.aiMatchedAttractions || [];

  // Search params state (mutable)
  const [searchParams, setSearchParams] = useState(initialSearchParams);

  // Modify Search Modal
  const [showModifySearch, setShowModifySearch] = useState(false);
  const [modifyDestination, setModifyDestination] = useState(initialSearchParams.destination || '');
  const [modifyCheckIn, setModifyCheckIn] = useState(initialSearchParams.checkIn || '');
  const [modifyCheckOut, setModifyCheckOut] = useState(initialSearchParams.checkOut || '');
  const [modifyAdults, setModifyAdults] = useState(initialSearchParams.adults || 2);
  const [modifyChildren, setModifyChildren] = useState(initialSearchParams.children || 0);
  const [modifyRoomType, setModifyRoomType] = useState(initialSearchParams.roomType || 'double');

  // State
  const [hotels, setHotels] = useState([]);
  const [filteredHotels, setFilteredHotels] = useState([]);
  const [loading, setLoading] = useState(!isAiRecommendation);
  const [error, setError] = useState('');
  const [scraperMeta, setScraperMeta] = useState(null);

  // Sorting
  const [sortBy, setSortBy] = useState(isAiRecommendation ? 'ai_ranking' : 'best_match');

  // Filters
  const [filters, setFilters] = useState({
    rating: null,
    stars: null,
    propertyTypes: [],
    amenities: {},
    meals: {}
  });

  // Price Range
  const [priceRange, setPriceRange] = useState({ min: 0, max: 200000 });
  const [actualPriceRange, setActualPriceRange] = useState({ min: 0, max: 200000 });

  // Map
  const [showMap, setShowMap] = useState(false);
  const [mapCenter] = useState([31.5204, 74.3587]);
  const [activeHotel, setActiveHotel] = useState(null);

  // Favorites
  const [favorites, setFavorites] = useState(new Set());

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const hotelsPerPage = 15;

  // Mobile filter
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const hasInitialFetchRef = useRef(false);

  // Open modify search modal
  const openModifySearch = () => {
    setModifyDestination(searchParams.destination || '');
    setModifyCheckIn(searchParams.checkIn || '');
    setModifyCheckOut(searchParams.checkOut || '');
    setModifyAdults(searchParams.adults || 2);
    setModifyChildren(searchParams.children || 0);
    setModifyRoomType(searchParams.roomType || 'double');
    setShowModifySearch(true);
  };

  // Handle modify search submission
  const handleModifySearch = () => {
    const newSearchParams = {
      destination: modifyDestination,
      checkIn: modifyCheckIn,
      checkOut: modifyCheckOut,
      adults: modifyAdults,
      children: modifyChildren,
      roomType: modifyRoomType
    };
    setSearchParams(newSearchParams);
    setShowModifySearch(false);
    setLoading(true);
    setCurrentPage(1);

    // Fetch hotels with new params
    fetchHotelsWithParams(newSearchParams);
  };

  // Fetch hotels on mount (or load AI results directly)
  useEffect(() => {
    if (hasInitialFetchRef.current) return;
    hasInitialFetchRef.current = true;

    if (isAiRecommendation && aiHotels.length > 0) {
      loadAiRecommendations();
    } else {
      fetchHotels();
    }
    // Load favorites from localStorage
    const savedFavorites = JSON.parse(localStorage.getItem('favoriteHotels') || '[]');
    setFavorites(new Set(savedFavorites));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load AI recommendations directly (skip scraping)
  const loadAiRecommendations = () => {
    const seenKeys = new Set();
    const params = searchParams;
    const transformedHotels = aiHotels.reduce((acc, hotel, index) => {
      let key = (hotel.url || '').toLowerCase();
      if (key) { key = key.split('?')[0]; }
      else { key = (hotel.name || '').toLowerCase().trim(); }
      if (!key || seenKeys.has(key)) return acc;
      seenKeys.add(key);

      let pricePerNight = hotel.price_per_night || hotel.double_bed_price_per_day || null;
      if (!pricePerNight && hotel.price) {
        const priceMatch = hotel.price.replace(/,/g, '').match(/\d+(\.\d+)?/);
        if (priceMatch) pricePerNight = parseFloat(priceMatch[0]) || null;
      }
      if (!pricePerNight && hotel.total_stay_price && hotel.nights > 0) {
        pricePerNight = Math.round(hotel.total_stay_price / hotel.nights);
      }
      pricePerNight = pricePerNight || null;

      const ratingValue = typeof hotel.rating === 'number'
        ? hotel.rating
        : typeof hotel.review_rating === 'number'
        ? hotel.review_rating
        : parseFloat((hotel.review_rating || hotel.rating || '0').toString()) || 0;

      let stars = hotel.stars || null;

      let reviewNum = hotel.review_count || hotel.review_count_num || null;
      if (reviewNum && typeof reviewNum !== 'number') {
        const revMatch = reviewNum.toString().replace(/,/g, '').match(/\d+/);
        reviewNum = revMatch ? parseInt(revMatch[0]) : null;
      }

      const hotelAddress = hotel.location || hotel.location_area || hotel.address || `${params.destination || 'Lahore'}, Pakistan`;
      const roomType = hotel.room_type || 'Standard Room';
      const maxOccupancy = hotel.max_occupancy || 2;

      acc.push({
        id: `ai-${acc.length}`,
        name: hotel.name || 'Hotel',
        url: hotel.url || null,
        city: params.destination || 'Lahore',
        address: hotelAddress,
        location: hotelAddress,
        description: hotel.amenities?.join(', ') || hotel.room_info || 'Hotel',
        rating: ratingValue,
        stars: stars,
        property_type: hotel.property_type || 'Hotel',
        availability_status: hotel.availability_status || 'Available',
        rooms_left: hotel.rooms_left || null,
        is_limited: hotel.is_limited || false,
        is_sold_out: hotel.is_sold_out || false,
        has_deal: hotel.has_deal || false,
        deal_label: hotel.deal_label || null,
        available_rooms: hotel.rooms_left != null ? hotel.rooms_left : null,
        image: hotel.image_url || hotel.image || `https://via.placeholder.com/400x300?text=${encodeURIComponent(hotel.name?.slice(0, 20) || 'Hotel')}`,
        review_count: reviewNum,
        rating_label: hotel.rating_label || null,
        distance_from_center: hotel.distance_from_center || '',
        wifi_available: hotel.wifi_available || (hotel.amenities?.some(a => a.toLowerCase().includes('wifi')) ?? false),
        parking_available: hotel.parking_available || (hotel.amenities?.some(a => a.toLowerCase().includes('parking')) ?? false),
        pool_available: hotel.pool_available || false,
        breakfast_available: hotel.breakfast_available || false,
        amenities: hotel.amenities || [],
        price_per_night: pricePerNight,
        double_bed_price_per_day: pricePerNight,
        total_stay_price: hotel.total_stay_price || null,
        original_price: hotel.original_price || null,
        taxes_text: hotel.taxes_text || null,
        nights: hotel.nights || 1,
        is_scraped: true,
        room_type: roomType,
        room_info: hotel.room_info || roomType,
        max_occupancy: maxOccupancy,
        occupancy_match: hotel.occupancy_match !== false,
        meal_plan: hotel.meal_plan || null,
        cancellation_policy: hotel.cancellation_policy || null,
        rooms: hotel.rooms?.length ? hotel.rooms : [{
          room_type: roomType,
          max_occupancy: maxOccupancy,
          price_per_night: pricePerNight,
          total_price: hotel.total_stay_price || null,
          cancellation_policy: hotel.cancellation_policy || null,
          meal_plan: hotel.meal_plan || null,
          availability: hotel.availability_status || 'Available',
          occupancy_match: hotel.occupancy_match !== false,
        }],
        latitude: hotel.latitude || 31.5204 + (Math.random() - 0.5) * 0.1,
        longitude: hotel.longitude || 74.3587 + (Math.random() - 0.5) * 0.1,
        // AI-specific fields
        match_score: hotel.match_score || 0,
        ai_reason: hotel.ai_reason || '',
      });
      return acc;
    }, []);

    setHotels(transformedHotels);
    setFilteredHotels(transformedHotels);

    if (transformedHotels.length > 0) {
      const prices = transformedHotels.map(h => h.double_bed_price_per_day).filter(p => p > 0);
      if (prices.length > 0) {
        const minP = Math.min(...prices);
        const maxP = Math.max(...prices);
        setActualPriceRange({ min: minP, max: maxP });
        setPriceRange({ min: minP, max: maxP });
      }
    }

    setScraperMeta({
      verified: true,
      coverage_pct: null,
      reported_count: aiTotalFound || transformedHotels.length,
      scraped_count: transformedHotels.length,
      verification_notes: [],
      elapsed_seconds: null,
    });

    setLoading(false);
  };

  const fetchHotels = async () => {
    fetchHotelsWithParams(searchParams);
  };

  const fetchHotelsWithParams = async (params) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_ROOT}/api/scraper/scrape-hotels/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: params.destination || 'Lahore',
          checkin: params.checkIn,
          checkout: params.checkOut,
          adults: parseInt(params.adults) || 2,
          rooms: 1,
          children: parseInt(params.children) || 0,
          use_cache: true,
          coverage_priority: false,
          deep_search: false,
          quick_mode: true,
          // Match Booking URL sort order so first page hotels and prices align
          order: 'price',
        })
      });

      let data = {};
      try {
        data = await response.json();
      } catch {
        data = {};
      }

      // Auto-retry once on 503 (scraper at capacity) after a short delay
      if (response.status === 503 && !params._retried503) {
        console.warn('Scraper at capacity, retrying in 4 seconds...');
        await new Promise(r => setTimeout(r, 4000));
        return fetchHotelsWithParams({ ...params, _retried503: true });
      }

      // Auto-retry transient backend errors (e.g., sqlite lock during job creation)
      if ((response.status >= 500 || response.status === 429) && !params._retried5xx) {
        console.warn(`Backend transient error ${response.status}, retrying in 3 seconds...`);
        await new Promise(r => setTimeout(r, 3000));
        return fetchHotelsWithParams({ ...params, _retried5xx: true });
      }

      if (!response.ok) {
        throw new Error(data?.error || data?.message || `Failed to initiate scrape (${response.status}).`);
      }

      // If backend returned a job_id but no cached hotels, poll for results
      if (data.success && data.job_id && (!data.hotels || data.hotels.length === 0)) {
        console.log(`No cache. Polling job ${data.job_id}...`);
        const POLL_INTERVAL = 2000;
        // Keep polling window aligned with backend runtime budget.
        const MAX_POLLS = 180; // ~360s total polling
        let pollHotels = [];
        let pollMeta = {};
        let jobFailed = false;
        let failError = '';
        let lastStatus = 'QUEUED';
        let lastProgress = 0;

        for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
          await new Promise(r => setTimeout(r, POLL_INTERVAL));
          try {
            const statusRes = await fetch(`${API_ROOT}/api/scraper/job-status/${data.job_id}/`);
            const statusData = await statusRes.json();
            console.log(`[poll ${attempt + 1}] status=${statusData.status} hotels=${statusData.hotel_count}`);
            lastStatus = statusData.status || lastStatus;
            lastProgress = Number(statusData.progress_pct || 0);

            if (statusData.status === 'COMPLETED' || statusData.status === 'PARTIAL') {
              const resultsRes = await fetch(`${API_ROOT}/api/scraper/results/${data.job_id}/`);
              const resultsData = await resultsRes.json();
              pollHotels = resultsData.hotels || [];
              pollMeta = resultsData.meta || {};
              break;
            }
            if (statusData.status === 'FAILED') {
              jobFailed = true;
              failError = statusData.error || 'Scraper job failed';
              if (String(failError).toLowerCase().includes('timed out')) {
                failError = 'Scraper took too long. Try again once, or narrow dates/guests for faster results';
              }
              break;
            }
          } catch (pollErr) {
            console.warn(`Poll attempt ${attempt + 1} error:`, pollErr.message);
            // Network hiccup — keep polling
          }
        }

        if (jobFailed) {
          throw new Error(`Hotel search failed: ${failError}. Please try again.`);
        }
        if (pollHotels.length === 0) {
          throw new Error(
            `Search is still running (${lastStatus}${lastProgress ? `, ${lastProgress}%` : ''}). ` +
            'Please tap Try Again to continue polling this search.'
          );
        }

        // Treat polled results like a successful cached response
        data.hotels = pollHotels;
        data.meta = pollMeta;
        data.success = true;
      }

      if (data.success && data.hotels?.length > 0) {
        const seenKeys = new Set();
        const transformedHotels = data.hotels.reduce((acc, hotel, index) => {
          // Strong de-dup key: normalised URL (without query) or fallback to name
          let key = (hotel.url || '').toLowerCase();
          if (key) {
            key = key.split('?')[0];
          } else {
            key = (hotel.name || '').toLowerCase().trim();
          }
          if (!key || seenKeys.has(key)) {
            return acc;
          }
          seenKeys.add(key);

          // ── Price: prefer direct numeric fields ────────────────────────
          let pricePerNight =
            hotel.price_per_night ||
            hotel.double_bed_price_per_day ||
            null;

          if (!pricePerNight && hotel.price) {
            const priceMatch = hotel.price.replace(/,/g, '').match(/\d+(\.\d+)?/);
            if (priceMatch) pricePerNight = parseFloat(priceMatch[0]) || null;
          }

          if (!pricePerNight && hotel.total_stay_price && hotel.nights > 0) {
            pricePerNight = Math.round(hotel.total_stay_price / hotel.nights);
          }

          pricePerNight = pricePerNight || null; // null = show "Price on request"

          // ── Rating ────────────────────────────────────────────────────────
          const ratingValue = typeof hotel.rating === 'number'
            ? hotel.rating
            : parseFloat((hotel.rating || '0').toString()) || 0;

          // ── Star rating (real-time from Booking.com) ──────────────────
          const stars = hotel.stars || null;

          // ── Review count ──────────────────────────────────────────────────
          let reviewNum = hotel.review_count || null;
          if (reviewNum && typeof reviewNum !== 'number') {
            const revMatch = reviewNum.toString().replace(/,/g, '').match(/\d+/);
            reviewNum = revMatch ? parseInt(revMatch[0]) : null;
          }

          // ── Address / distance ────────────────────────────────────────────
          const hotelAddress = hotel.location || hotel.address || 'Lahore, Pakistan';
          const distanceText = hotel.distance_from_center || '';

          // ── Real room type from Booking.com ───────────────────────────────
          const roomType = hotel.room_type || 'Standard Room';
          const maxOccupancy = hotel.max_occupancy || 2;

          acc.push({
            id: `scraped-${acc.length}`,
            name: hotel.name || 'Hotel',
            url: hotel.url || null,
            city: params.destination || 'Lahore',
            address: hotelAddress,
            location: hotelAddress,
            description: hotel.amenities?.join(', ') || hotel.room_info || 'Hotel in Lahore',
            rating: ratingValue,
            stars: stars,
            property_type: hotel.property_type || 'Hotel',
            availability_status: hotel.availability_status || 'Available',
            rooms_left: hotel.rooms_left || null,
            is_limited: hotel.is_limited || false,
            is_sold_out: hotel.is_sold_out || false,
            has_deal: hotel.has_deal || false,
            deal_label: hotel.deal_label || null,
            available_rooms: hotel.rooms_left != null ? hotel.rooms_left : null,
            image: hotel.image_url || hotel.image || `https://via.placeholder.com/400x300?text=${encodeURIComponent(hotel.name?.slice(0, 20) || 'Hotel')}`,
            review_count: reviewNum,
            rating_label: hotel.rating_label || null,
            distance_from_center: distanceText,
            wifi_available: hotel.wifi_available || (hotel.amenities?.some(a => a.toLowerCase().includes('wifi')) ?? false),
            parking_available: hotel.parking_available || (hotel.amenities?.some(a => a.toLowerCase().includes('parking')) ?? false),
            pool_available: hotel.pool_available || false,
            breakfast_available: hotel.breakfast_available || false,
            amenities: hotel.amenities || [],

            // ── Pricing (real Booking.com price) ─────────────────────────────
            price_per_night: pricePerNight,
            double_bed_price_per_day: pricePerNight,   // alias used by price filter
            total_stay_price: hotel.total_stay_price || null,
            original_price: hotel.original_price || null,  // for showing crossed-out price
            taxes_text: hotel.taxes_text || null,
            nights: hotel.nights || 1,
            is_scraped: true,

            // ── Real room info from Booking.com ───────────────────────────────
            room_type: roomType,
            room_info: hotel.room_info || roomType,
            max_occupancy: maxOccupancy,
            occupancy_match: hotel.occupancy_match !== false,
            meal_plan: hotel.meal_plan || null,
            cancellation_policy: hotel.cancellation_policy || null,

            // ── Rooms array with real data ────────────────────────────────────
            rooms: hotel.rooms?.length ? hotel.rooms : [{
              room_type: roomType,
              max_occupancy: maxOccupancy,
              price_per_night: pricePerNight,
              total_price: hotel.total_stay_price || null,
              cancellation_policy: hotel.cancellation_policy || null,
              meal_plan: hotel.meal_plan || null,
              availability: hotel.availability_status || 'Available',
              occupancy_match: hotel.occupancy_match !== false,
            }],

            latitude: hotel.latitude || 31.5204 + (Math.random() - 0.5) * 0.1,
            longitude: hotel.longitude || 74.3587 + (Math.random() - 0.5) * 0.1,
          });
          return acc;
        }, []);

        // Store scraper metadata for verification display
        const meta = data.meta || {};
        setScraperMeta({
          verified: meta.verified !== false,
          coverage_pct: meta.coverage_pct || null,
          reported_count: meta.reported_count || null,
          scraped_count: meta.scraped_count || transformedHotels.length,
          verification_notes: meta.verification_notes || [],
          elapsed_seconds: meta.elapsed_seconds || null,
        });

        setHotels(transformedHotels);
        setFilteredHotels(transformedHotels);
        setError(''); // Clear any previous errors on success

        // Calculate actual price range
        const prices = transformedHotels.map(h => h.double_bed_price_per_day);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        setActualPriceRange({ min: minPrice, max: maxPrice });
        setPriceRange({ min: minPrice, max: maxPrice });
      } else {
        throw new Error(data.message || 'No hotels found');
      }
    } catch (err) {
      console.error('Error fetching hotels:', err);
      setError(err.message || 'Failed to fetch hotels. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Apply filters and sorting
  useEffect(() => {
    let result = [...hotels];

    // Price filter
    result = result.filter(hotel => {
      const price = hotel.double_bed_price_per_day || hotel.price || 0;
      return price >= priceRange.min && price <= priceRange.max;
    });

    // Rating filter
    if (filters.rating) {
      result = result.filter(hotel => (hotel.rating || 0) >= filters.rating);
    }

    // Star rating filter
    if (filters.stars) {
      result = result.filter(hotel => hotel.stars === filters.stars);
    }

    // Property type filter
    if (filters.propertyTypes?.length > 0) {
      result = result.filter(hotel => {
        const hotelType = (hotel.property_type || hotel.name || '').toLowerCase();
        return filters.propertyTypes.some(type => hotelType.includes(type));
      });
    }

    // Amenities filter
    if (Object.values(filters.amenities || {}).some(v => v)) {
      result = result.filter(hotel => {
        const amenitiesStr = (hotel.amenities || []).join(' ').toLowerCase() + ' ' + (hotel.description || '').toLowerCase();

        if (filters.amenities.wifi && !hotel.wifi_available && !amenitiesStr.includes('wifi')) return false;
        if (filters.amenities.parking && !hotel.parking_available && !amenitiesStr.includes('parking')) return false;
        if (filters.amenities.pool && !amenitiesStr.includes('pool')) return false;
        if (filters.amenities.restaurant && !amenitiesStr.includes('restaurant')) return false;
        if (filters.amenities.gym && !amenitiesStr.includes('gym') && !amenitiesStr.includes('fitness')) return false;
        if (filters.amenities.spa && !amenitiesStr.includes('spa')) return false;
        if (filters.amenities.airConditioning && !amenitiesStr.includes('air') && !amenitiesStr.includes('ac')) return false;
        if (filters.amenities.roomService && !amenitiesStr.includes('room service')) return false;
        if (filters.amenities.bar && !amenitiesStr.includes('bar') && !amenitiesStr.includes('lounge')) return false;
        if (filters.amenities.shuttle && !amenitiesStr.includes('shuttle') && !amenitiesStr.includes('airport')) return false;
        if (filters.amenities.tv && !amenitiesStr.includes('tv') && !amenitiesStr.includes('television')) return false;
        if (filters.amenities.coffeeMaker && !amenitiesStr.includes('coffee') && !amenitiesStr.includes('tea')) return false;
        if (filters.amenities.bathtub && !amenitiesStr.includes('bathtub') && !amenitiesStr.includes('bath')) return false;

        return true;
      });
    }

    // Meals filter
    if (Object.values(filters.meals || {}).some(v => v)) {
      result = result.filter(hotel => {
        const desc = (hotel.description || '').toLowerCase() + (hotel.amenities || []).join(' ').toLowerCase();

        if (filters.meals.breakfast && !desc.includes('breakfast')) return false;
        if (filters.meals.halfBoard && !desc.includes('half board')) return false;
        if (filters.meals.fullBoard && !desc.includes('full board')) return false;
        if (filters.meals.allInclusive && !desc.includes('all inclusive')) return false;

        return true;
      });
    }

    // Sorting
    switch (sortBy) {
      case 'ai_ranking':
        result.sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
        break;
      case 'best_match':
        result.sort((a, b) => {
          const scoreA = (a.rating || 0) * 10 + (a.has_deal ? 5 : 0);
          const scoreB = (b.rating || 0) * 10 + (b.has_deal ? 5 : 0);
          return scoreB - scoreA;
        });
        break;
      case 'top_reviewed':
        result.sort((a, b) => (b.review_count || 0) - (a.review_count || 0));
        break;
      case 'lowest_price':
        result.sort((a, b) => {
          const priceA = a.double_bed_price_per_day || a.price || 0;
          const priceB = b.double_bed_price_per_day || b.price || 0;
          return priceA - priceB;
        });
        break;
      case 'highest_price':
        result.sort((a, b) => {
          const priceA = a.double_bed_price_per_day || a.price || 0;
          const priceB = b.double_bed_price_per_day || b.price || 0;
          return priceB - priceA;
        });
        break;
      case 'hot_deals':
        result.sort((a, b) => (b.has_deal ? 1 : 0) - (a.has_deal ? 1 : 0));
        break;
      default:
        break;
    }

    setFilteredHotels(result);
    setCurrentPage(1);
  }, [hotels, sortBy, priceRange, filters]);

  const toggleFavorite = (hotelId) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(hotelId)) {
        newFavorites.delete(hotelId);
      } else {
        newFavorites.add(hotelId);
      }
      localStorage.setItem('favoriteHotels', JSON.stringify([...newFavorites]));
      return newFavorites;
    });
  };

  const handleBookHotel = (hotel) => {
    navigate('/hotel-details', {
      state: {
        hotel: hotel,
        searchParams: {
          destination: searchParams.destination,
          checkIn: searchParams.checkIn,
          checkOut: searchParams.checkOut,
          adults: searchParams.adults || 2,
          children: searchParams.children || 0,
          roomType: searchParams.roomType || 'double',
          infants: searchParams.infants || 0
        }
      }
    });
  };

  const clearAllFilters = () => {
    setFilters({
      rating: null,
      stars: null,
      propertyTypes: [],
      amenities: {},
      meals: {}
    });
    setPriceRange(actualPriceRange);
  };

  // Pagination
  const indexOfLastHotel = currentPage * hotelsPerPage;
  const indexOfFirstHotel = indexOfLastHotel - hotelsPerPage;
  const currentHotels = filteredHotels.slice(indexOfFirstHotel, indexOfLastHotel);
  const totalPages = Math.ceil(filteredHotels.length / hotelsPerPage);

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-PK').format(price);
  };

  // Show loading screen
  if (loading) {
    return <LoadingScreen searchParams={searchParams} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Modify Search Modal */}
      <AnimatePresence>
        {showModifySearch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setShowModifySearch(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <FaSearch className="text-white text-lg" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Modify Search</h2>
                    <p className="text-blue-100 text-sm">Update your search criteria</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowModifySearch(false)}
                  className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-colors"
                >
                  <FaTimes className="text-white text-lg" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5">
                {/* Destination */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    <FaMapMarkerAlt className="inline mr-2 text-blue-500" />
                    Destination
                  </label>
                  <input
                    type="text"
                    value={modifyDestination}
                    onChange={(e) => setModifyDestination(e.target.value)}
                    placeholder="Enter city or hotel name"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>

                {/* Dates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      <FaCalendarAlt className="inline mr-2 text-blue-500" />
                      Check-in Date
                    </label>
                    <input
                      type="date"
                      value={modifyCheckIn}
                      onChange={(e) => setModifyCheckIn(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      <FaCalendarAlt className="inline mr-2 text-blue-500" />
                      Check-out Date
                    </label>
                    <input
                      type="date"
                      value={modifyCheckOut}
                      onChange={(e) => setModifyCheckOut(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                {/* Guests */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      <FaUsers className="inline mr-2 text-blue-500" />
                      Adults
                    </label>
                    <select
                      value={modifyAdults}
                      onChange={(e) => setModifyAdults(parseInt(e.target.value))}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    >
                      {[1, 2, 3, 4, 5, 6].map(n => (
                        <option key={n} value={n}>{n} Adult{n > 1 ? 's' : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Children
                    </label>
                    <select
                      value={modifyChildren}
                      onChange={(e) => setModifyChildren(parseInt(e.target.value))}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    >
                      {[0, 1, 2, 3, 4].map(n => (
                        <option key={n} value={n}>{n} Child{n !== 1 ? 'ren' : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      <FaBed className="inline mr-2 text-blue-500" />
                      Room Type
                    </label>
                    <select
                      value={modifyRoomType}
                      onChange={(e) => setModifyRoomType(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    >
                      <option value="all">All Room Types</option>
                      <option value="single">Single Room</option>
                      <option value="double">Double Room</option>
                      <option value="triple">Triple Room</option>
                      <option value="quad">Quad Room</option>
                      <option value="quint">Quint Room</option>
                      <option value="family">Family Room</option>
                      <option value="suite">Suite</option>
                      <option value="deluxe">Deluxe Room</option>
                      <option value="dormitory">Dormitory</option>
                      <option value="entire">Entire Property</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-gray-50 dark:bg-gray-700/50 px-6 py-4 flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowModifySearch(false)}
                  className="px-6 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleModifySearch}
                  className="px-8 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
                >
                  <FaSearch />
                  Search Hotels
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header with Search Summary */}
      <div className="bg-blue-600 dark:bg-blue-800 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col lg:flex-row gap-4 items-center">
            {/* Back Button */}
            <button
              onClick={() => navigate('/dashboard')}
              className="lg:hidden absolute left-4 top-4 p-2 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <FaArrowLeft />
            </button>

            {/* Search Info Card */}
            <div className="flex-1 bg-white dark:bg-gray-700 rounded-xl p-3 flex flex-wrap items-center gap-4 shadow-inner">
              <div className="flex items-center gap-2 px-3 py-2 border-r border-gray-200 dark:border-gray-600">
                <FaMapMarkerAlt className="text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="font-semibold text-gray-800 dark:text-white">{searchParams.destination || 'Lahore'}</p>
                  <p className="text-xs text-green-600 dark:text-green-400">{filteredHotels.length} properties</p>
                </div>
              </div>

              <div className="flex items-center gap-2 px-3 py-2 border-r border-gray-200 dark:border-gray-600">
                <FaCalendarAlt className="text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-white">
                    {searchParams.checkIn ? new Date(searchParams.checkIn).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Check-in'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {searchParams.checkIn ? new Date(searchParams.checkIn).toLocaleDateString('en-US', { weekday: 'short' }) : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 px-3 py-2 border-r border-gray-200 dark:border-gray-600">
                <FaCalendarAlt className="text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-white">
                    {searchParams.checkOut ? new Date(searchParams.checkOut).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Check-out'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {searchParams.checkOut ? new Date(searchParams.checkOut).toLocaleDateString('en-US', { weekday: 'short' }) : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 px-3 py-2">
                <FaUsers className="text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-white">
                    {searchParams.adults || 2} adults
                    {searchParams.children > 0 && `, ${searchParams.children} children`}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">1 room</p>
                </div>
              </div>
            </div>

            {/* Search Button */}
            <button
              onClick={openModifySearch}
              className="px-8 py-3 bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold rounded-xl transition-colors shadow-lg flex items-center gap-2"
            >
              <FaSearch />
              Modify Search
            </button>
          </div>
        </div>

        {/* Results Info Banner */}
        {scraperMeta && scraperMeta.scraped_count > 0 && (
          <div className="bg-blue-500 dark:bg-blue-600 py-2 px-4">
            <div className="max-w-7xl mx-auto flex items-center justify-center gap-3 text-sm">
              <FaExclamationTriangle />
              <span className="font-medium">
                Showing {scraperMeta.scraped_count} live-priced properties{isAiRecommendation ? ' — AI-powered recommendations by Travello' : ' — real-time prices from Booking.com'}
              </span>
            </div>
          </div>
        )}

        {/* Urgency Banner */}
        <div className="bg-orange-500 dark:bg-orange-600 py-2 px-4">
          <div className="max-w-7xl mx-auto flex items-center justify-center gap-3 text-sm">
            <FaClock />
            <span className="font-medium">
              Hurry! {Math.floor(Math.random() * 30) + 20}% of properties on our site are fully booked!
            </span>
            <span className="hidden sm:inline">
              Rooms in {searchParams.destination || 'Lahore'} are in high demand.
            </span>
          </div>
        </div>
      </div>

      {/* Sorting Bar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-[140px] z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            <span className="text-gray-700 dark:text-gray-300 font-medium whitespace-nowrap flex items-center gap-2">
              <FaSort /> Sort by:
            </span>

            {[
              ...(isAiRecommendation ? [{ id: 'ai_ranking', label: 'AI Ranking', icon: <FaRobot className="text-blue-400" /> }] : []),
              { id: 'best_match', label: 'Best match', icon: <FaThumbsUp /> },
              { id: 'top_reviewed', label: 'Top reviewed', icon: <FaStar className="text-yellow-500" /> },
              { id: 'lowest_price', label: 'Lowest price first', icon: null },
              { id: 'highest_price', label: 'Highest price first', icon: null },
              { id: 'hot_deals', label: 'Hot Deals!', icon: <FaFire className="text-red-500" /> }
            ].map(option => (
              <button
                key={option.id}
                onClick={() => setSortBy(option.id)}
                className={`px-4 py-2 rounded-full whitespace-nowrap transition-all flex items-center gap-2 ${sortBy === option.id
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
              >
                {option.icon}
                {option.label}
              </button>
            ))}

            <div className="ml-auto flex items-center gap-2">
              {/* Mobile Filter Toggle */}
              <button
                onClick={() => setShowMobileFilters(true)}
                className="lg:hidden px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg flex items-center gap-2"
              >
                <FaFilter /> Filters
              </button>

              {/* Map Toggle */}
              <button
                onClick={() => setShowMap(!showMap)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <FaMap />
                {showMap ? 'Show List' : 'Show on Map'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <button
              onClick={fetchHotels}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        )}

        <div className="flex gap-6">
          {/* Filters Sidebar - Desktop */}
          <div className="w-80 flex-shrink-0 hidden lg:block">
            <FilterSidebar
              filters={filters}
              setFilters={setFilters}
              priceRange={priceRange}
              setPriceRange={setPriceRange}
              maxPrice={actualPriceRange.max}
              minPrice={actualPriceRange.min}
              hotels={hotels}
              onClearAll={clearAllFilters}
            />
          </div>

          {/* Mobile Filters Modal */}
          <AnimatePresence>
            {showMobileFilters && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 z-50 lg:hidden"
                onClick={() => setShowMobileFilters(false)}
              >
                <motion.div
                  initial={{ x: '-100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '-100%' }}
                  transition={{ type: 'spring', damping: 25 }}
                  className="absolute left-0 top-0 h-full w-80 bg-white dark:bg-gray-800 overflow-y-auto"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white">Filters</h3>
                    <button
                      onClick={() => setShowMobileFilters(false)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                    >
                      <FaTimes />
                    </button>
                  </div>
                  <FilterSidebar
                    filters={filters}
                    setFilters={setFilters}
                    priceRange={priceRange}
                    setPriceRange={setPriceRange}
                    maxPrice={actualPriceRange.max}
                    minPrice={actualPriceRange.min}
                    hotels={hotels}
                    onClearAll={clearAllFilters}
                  />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Hotels List / Map */}
          <div className="flex-1">
            {!showMap ? (
              <>
                {/* Results Count */}
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-gray-600 dark:text-gray-400">
                    <span className="font-semibold text-gray-800 dark:text-white">{filteredHotels.length}</span> properties found
                    {totalPages > 1 && ` • Page ${currentPage} of ${totalPages}`}
                  </p>
                </div>

                {/* AI Recommendation Banner */}
                {isAiRecommendation && (
                  <div className="mb-4 space-y-3">
                    {aiSummary && (
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                        <div className="flex gap-3">
                          <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center shrink-0">
                            <FaRobot className="text-white text-sm" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">AI Personalized Recommendations</p>
                            <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">{aiSummary}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    {aiMatchedAttractions.length > 0 && (
                      <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                          <strong>Hotels near your interests:</strong> {aiMatchedAttractions.join(', ')}
                        </p>
                      </div>
                    )}
                    {aiProfile && Object.keys(aiProfile).length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {aiProfile.destination && <span className="px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-full">📍 {aiProfile.destination}</span>}
                        {aiProfile.interests && <span className="px-2.5 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-medium rounded-full">🎯 {aiProfile.interests}</span>}
                        {aiProfile.travel_style && <span className="px-2.5 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-medium rounded-full">✨ {aiProfile.travel_style}</span>}
                        {aiProfile.budget && <span className="px-2.5 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-medium rounded-full">💰 {aiProfile.budget}</span>}
                      </div>
                    )}
                  </div>
                )}

                {/* Hotels Grid */}
                <div className="space-y-4">
                  {currentHotels.map((hotel) => (
                    <HotelCard
                      key={hotel.id}
                      hotel={hotel}
                      searchParams={searchParams}
                      isFavorite={favorites.has(hotel.id)}
                      onToggleFavorite={toggleFavorite}
                      onBook={handleBookHotel}
                      isActive={activeHotel === hotel.id}
                    />
                  ))}
                </div>

                {/* No Results */}
                {filteredHotels.length === 0 && !error && (
                  <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl">
                    <FaSearch className="text-6xl text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">No hotels match your filters</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">Try adjusting your search criteria</p>
                    <button
                      onClick={clearAllFilters}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Clear All Filters
                    </button>
                  </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-8 flex justify-center items-center gap-2">
                    <button
                      onClick={() => {
                        setCurrentPage(prev => Math.max(prev - 1, 1));
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      disabled={currentPage === 1}
                      className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Previous
                    </button>

                    {[...Array(Math.min(5, totalPages))].map((_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }

                      return (
                        <button
                          key={pageNum}
                          onClick={() => {
                            setCurrentPage(pageNum);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className={`w-10 h-10 rounded-lg ${currentPage === pageNum
                            ? 'bg-blue-600 text-white'
                            : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    <button
                      onClick={() => {
                        setCurrentPage(prev => Math.min(prev + 1, totalPages));
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            ) : (
              /* Map View */
              <div className="h-[calc(100vh-300px)] rounded-xl overflow-hidden shadow-lg">
                <MapContainer
                  center={mapCenter}
                  zoom={12}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                  <MapController center={mapCenter} zoom={12} />

                  {filteredHotels.map(hotel => (
                    hotel.latitude && hotel.longitude && (
                      <Marker
                        key={hotel.id}
                        position={[hotel.latitude, hotel.longitude]}
                        icon={createHotelIcon(hotel.double_bed_price_per_day, activeHotel === hotel.id)}
                        eventHandlers={{
                          click: () => {
                            setActiveHotel(hotel.id);
                            setShowMap(false);
                          }
                        }}
                      >
                        <Popup>
                          <div className="p-2 min-w-[200px]">
                            <img
                              src={hotel.image}
                              alt={hotel.name}
                              className="w-full h-24 object-cover rounded-lg mb-2"
                            />
                            <h3 className="font-bold text-gray-800">{hotel.name}</h3>
                            <p className="text-sm text-gray-600">{hotel.address}</p>
                            {hotel.rating > 0 && (
                              <div className="flex items-center gap-1 mt-1">
                                <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded">
                                  {hotel.rating.toFixed(1)}
                                </span>
                              </div>
                            )}
                            <p className="text-lg font-bold text-blue-600 mt-2">
                              PKR {formatPrice(hotel.double_bed_price_per_day)}
                              <span className="text-xs font-normal text-gray-500"> / night</span>
                            </p>
                            <button
                              onClick={() => handleBookHotel(hotel)}
                              className="w-full mt-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                            >
                              See availability
                            </button>
                          </div>
                        </Popup>
                      </Marker>
                    )
                  ))}
                </MapContainer>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HotelSearchResults;
