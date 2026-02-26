import { useState, useEffect, useRef } from 'react';
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
  FaMap
} from 'react-icons/fa';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

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
    'Connecting to Booking.com',
    'Searching available hotels',
    'Fetching real-time prices',
    'Checking room availability',
    'Loading hotel images',
    'Almost ready'
  ];

  useEffect(() => {
    const stageInterval = setInterval(() => {
      setLoadingStage(prev => (prev < loadingMessages.length - 1 ? prev + 1 : prev));
    }, 2500);

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
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                index < loadingStage 
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
              <span className={`text-sm ${
                index <= loadingStage 
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
              className={`flex items-center gap-1 px-3 py-2 rounded-lg border transition-all ${
                filters.stars === star
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

// Hotel Card Component
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
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-xl transition-all overflow-hidden border ${
        isActive ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-200 dark:border-gray-700'
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

          {/* Badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-2">
            {hotel.has_deal && (
              <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                <FaPercent className="text-xs" /> Deal
              </span>
            )}
            {hotel.is_limited && (
              <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                <FaFire className="text-xs" /> {hotel.rooms_left || 'Few'} left!
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

          {/* Room Info & Availability */}
          {hotel.availability_status && (
            <p className={`text-sm mb-2 ${
              hotel.is_limited ? 'text-red-600 dark:text-red-400 font-medium' : 'text-green-600 dark:text-green-400'
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
              <p className="text-3xl font-bold text-gray-800 dark:text-white">
                {formatPrice(pricePerNight)}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                +taxes & fees • Total: {formatPrice(totalPrice)}
              </p>
            </div>
            
            <button
              onClick={() => onBook(hotel)}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors shadow-md hover:shadow-lg"
            >
              See availability
            </button>
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Sorting
  const [sortBy, setSortBy] = useState('best_match');
  
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

  // Fetch hotels on mount
  useEffect(() => {
    fetchHotels();
    // Load favorites from localStorage
    const savedFavorites = JSON.parse(localStorage.getItem('favoriteHotels') || '[]');
    setFavorites(new Set(savedFavorites));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchHotels = async () => {
    fetchHotelsWithParams(searchParams);
  };

  const fetchHotelsWithParams = async (params) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:8000/api/scraper/scrape-hotels/', {
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
          // Match Booking URL sort order so first page hotels and prices align
          order: 'price',
        })
      });

      const data = await response.json();

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

          let pricePerNight = 5000;
          if (hotel.price) {
            const priceMatch = hotel.price.match(/[\d,]+/);
            if (priceMatch) {
              pricePerNight = parseFloat(priceMatch[0].replace(/,/g, '')) || 5000;
            }
          }

          let ratingValue = 0;
          if (hotel.rating) {
            const ratingMatch = hotel.rating.toString().match(/[\d.]+/);
            if (ratingMatch) {
              ratingValue = parseFloat(ratingMatch[0]) || 0;
            }
          }

          // Determine star rating from hotel name or property type
          let stars = 3;
          const nameLower = (hotel.name || '').toLowerCase();
          if (nameLower.includes('5 star') || nameLower.includes('luxury') || nameLower.includes('pearl continental') || nameLower.includes('marriott')) stars = 5;
          else if (nameLower.includes('4 star') || nameLower.includes('premier')) stars = 4;
          else if (nameLower.includes('3 star') || nameLower.includes('comfort')) stars = 3;
          else if (nameLower.includes('2 star') || nameLower.includes('budget')) stars = 2;
          else if (nameLower.includes('hostel') || nameLower.includes('guest house')) stars = 1;

          // Parse review count to a number to avoid "836 reviews reviews" duplication
          let reviewNum = null;
          if (hotel.review_count) {
            const revMatch = hotel.review_count.toString().replace(/,/g, '').match(/\d+/);
            if (revMatch) reviewNum = parseInt(revMatch[0]);
          }

          // Separate location from distance to avoid showing same text twice
          const hotelAddress = hotel.location || hotel.distance || '';
          const distanceText = hotel.distance && hotel.location && hotel.distance !== hotel.location
            ? hotel.distance
            : '';

          acc.push({
            id: `scraped-${acc.length}`,
            name: hotel.name || 'Hotel',
            city: params.destination || 'Lahore',
            address: hotelAddress,
            location: hotelAddress,
            description: hotel.amenities?.join(', ') || 'No amenities listed',
            rating: ratingValue,
            stars: stars,
            property_type: hotel.property_type || 'Hotel',
            availability_status: hotel.availability || 'Available',
            rooms_left: hotel.rooms_left,
            is_limited: hotel.is_limited || false,
            has_deal: hotel.has_deal,
            available_rooms: hotel.rooms_left || 10,
            image: hotel.image_url || 'https://via.placeholder.com/400x300?text=Hotel',
            review_count: reviewNum,
            distance_from_center: distanceText,
            wifi_available: hotel.amenities?.some(a => a.toLowerCase().includes('wifi')) || false,
            parking_available: hotel.amenities?.some(a => a.toLowerCase().includes('parking')) || false,
            amenities: hotel.amenities || [],
            single_bed_price_per_day: Math.round(pricePerNight * 0.8),
            double_bed_price_per_day: pricePerNight,
            triple_bed_price_per_day: Math.round(pricePerNight * 1.3),
            quad_bed_price_per_day: Math.round(pricePerNight * 1.5),
            family_room_price_per_day: Math.round(pricePerNight * 1.8),
            is_scraped: true,
            latitude: hotel.latitude || 31.5204 + (Math.random() - 0.5) * 0.1,
            longitude: hotel.longitude || 74.3587 + (Math.random() - 0.5) * 0.1
          });
          return acc;
        }, []);

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
                      <option value="single">Single</option>
                      <option value="double">Double</option>
                      <option value="triple">Triple</option>
                      <option value="quad">Quad</option>
                      <option value="family">Family</option>
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
              { id: 'best_match', label: 'Best match', icon: <FaThumbsUp /> },
              { id: 'top_reviewed', label: 'Top reviewed', icon: <FaStar className="text-yellow-500" /> },
              { id: 'lowest_price', label: 'Lowest price first', icon: null },
              { id: 'highest_price', label: 'Highest price first', icon: null },
              { id: 'hot_deals', label: 'Hot Deals!', icon: <FaFire className="text-red-500" /> }
            ].map(option => (
              <button
                key={option.id}
                onClick={() => setSortBy(option.id)}
                className={`px-4 py-2 rounded-full whitespace-nowrap transition-all flex items-center gap-2 ${
                  sortBy === option.id
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
                          className={`w-10 h-10 rounded-lg ${
                            currentPage === pageNum
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
