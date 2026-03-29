import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { FaSearch, FaMapMarkerAlt, FaStar, FaHeart, FaRegHeart, FaWifi, FaParking, FaSwimmingPool, FaUtensils } from 'react-icons/fa';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { searchLahoreHotels } from '../services/hotelSearchAPI';

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
    html: `<div class="marker-pin ${isActive ? 'marker-active' : ''}" style="
      background: ${isActive ? '#0071c2' : '#fff'};
      color: ${isActive ? '#fff' : '#0071c2'};
      padding: 4px 8px;
      border-radius: 4px;
      border: 2px solid #0071c2;
      font-weight: bold;
      font-size: 12px;
      white-space: nowrap;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    ">PKR ${price.toLocaleString()}</div>`,
    iconSize: [60, 30],
    iconAnchor: [30, 30],
  });
};

// Map controller component to update center
function MapController({ center, zoom }) {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);
  
  return null;
}

const HotelResults = () => {
  const [searchParams, setSearchParams] = useState({
    destination: 'Lahore',
    checkIn: '',
    checkOut: '',
    adults: 2,
    children: 0,
    infants: 0,
    roomType: 'double',
    rooms: 1
  });

  const [hotels, setHotels] = useState([]);
  const [filteredHotels, setFilteredHotels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Sorting and filtering
  const [sortBy, setSortBy] = useState('best_match');
  const [priceRange, setPriceRange] = useState({ min: 0, max: 250000 });
  const [selectedFilters, setSelectedFilters] = useState({
    internetAccess: false,
    kitchen: false,
    coffeeMaker: false,
    bathtub: false,
    excellentLocation: false,
    swimmingPool: false,
    carPark: false,
    rating: null,
    neighborhoods: [],
    distanceToCenter: null
  });
  
  // Map state
  const [showMap, setShowMap] = useState(false);
  const [mapCenter] = useState([31.5204, 74.3587]); // Lahore coordinates
  const [mapZoom] = useState(12);
  const [activeHotel, setActiveHotel] = useState(null);
  
  // Favorites
  const [favorites, setFavorites] = useState(new Set());
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [hotelsPerPage] = useState(25);
  
  const hotelRefs = useRef({});

  const handleSearch = async (params = searchParams) => {
    setLoading(true);
    setError('');

    try {
      const response = await searchLahoreHotels({
        checkIn: params.checkIn,
        checkOut: params.checkOut,
        adults: params.adults,
        children: params.children,
        roomType: params.roomType,
        onRefresh: (freshData) => {
          // Background scrape completed — swap in fresh real-time data
          const freshHotels = freshData.hotels || [];
          if (freshHotels.length > 0) {
            setHotels(freshHotels);
          }
        }
      });

      const hotelsList = response?.hotels || response || [];
      setHotels(hotelsList);
      setFilteredHotels(hotelsList);
      
      // Calculate price range
      if (hotelsList.length > 0) {
        const prices = hotelsList.map(h => h.double_bed_price_per_day || h.price || 0);
        setPriceRange({
          min: Math.min(...prices),
          max: Math.max(...prices)
        });
      }
    } catch (err) {
      console.error('Search error:', err);
      setError(err.message || 'Failed to search hotels');
    } finally {
      setLoading(false);
    }
  };

  // Load initial data (runs once on mount)
  useEffect(() => {
    // Initialize with default values on component mount
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowYear = tomorrow.getFullYear();
    const tomorrowMonth = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const tomorrowDay = String(tomorrow.getDate()).padStart(2, '0');
    const checkIn = `${tomorrowYear}-${tomorrowMonth}-${tomorrowDay}`;
    
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 3);
    const afterYear = dayAfter.getFullYear();
    const afterMonth = String(dayAfter.getMonth() + 1).padStart(2, '0');
    const afterDay = String(dayAfter.getDate()).padStart(2, '0');
    const checkOut = `${afterYear}-${afterMonth}-${afterDay}`;
    
    const adults = 2;
    const roomType = 'double';

    setSearchParams(prev => ({ ...prev, checkIn, checkOut, adults, roomType }));
  }, []);

  // Apply filters and sorting
  useEffect(() => {
    let result = [...hotels];

    // Apply filters
    result = result.filter(hotel => {
      const price = hotel.double_bed_price_per_day || hotel.price || 0;
      if (price < priceRange.min || price > priceRange.max) return false;

      if (selectedFilters.rating) {
        if (hotel.rating < selectedFilters.rating) return false;
      }

      if (selectedFilters.excellentLocation && hotel.rating < 8) return false;
      if (selectedFilters.internetAccess && !hotel.amenities?.wifi) return false;
      if (selectedFilters.swimmingPool && !hotel.amenities?.pool) return false;
      if (selectedFilters.carPark && !hotel.amenities?.parking) return false;

      return true;
    });

    // Apply sorting
    switch (sortBy) {
      case 'best_match':
        result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case 'top_reviewed':
        result.sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0));
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
      case 'distance':
        // Sort by distance from center (31.5204, 74.3587)
        result.sort((a, b) => {
          const distA = calculateDistance(31.5204, 74.3587, a.latitude, a.longitude);
          const distB = calculateDistance(31.5204, 74.3587, b.latitude, b.longitude);
          return distA - distB;
        });
        break;
      default:
        break;
    }

    setFilteredHotels(result);
    setCurrentPage(1);
  }, [hotels, sortBy, priceRange, selectedFilters]);

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const toggleFavorite = (hotelId) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(hotelId)) {
        newFavorites.delete(hotelId);
      } else {
        newFavorites.add(hotelId);
      }
      // Save to localStorage
      localStorage.setItem('favoriteHotels', JSON.stringify([...newFavorites]));
      return newFavorites;
    });
  };

  const scrollToHotel = (hotelId) => {
    const element = hotelRefs.current[hotelId];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setActiveHotel(hotelId);
      setTimeout(() => setActiveHotel(null), 2000);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0
    }).format(price);
  };

  // Pagination
  const indexOfLastHotel = currentPage * hotelsPerPage;
  const indexOfFirstHotel = indexOfLastHotel - hotelsPerPage;
  const currentHotels = filteredHotels.slice(indexOfFirstHotel, indexOfLastHotel);
  const totalPages = Math.ceil(filteredHotels.length / hotelsPerPage);

  const paginate = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Search Header */}
      <div className="bg-blue-600 dark:bg-blue-800 text-white py-6 px-4 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1 bg-white dark:bg-gray-700 rounded-lg p-4 flex items-center gap-4">
              <FaMapMarkerAlt className="text-blue-600 dark:text-blue-400" />
              <div className="flex-1">
                <input
                  type="text"
                  value={searchParams.destination}
                  onChange={(e) => setSearchParams(prev => ({ ...prev, destination: e.target.value }))}
                  className="w-full text-gray-800 dark:text-white bg-transparent outline-none"
                  placeholder="Where are you going?"
                />
                <p className="text-sm text-gray-500 dark:text-gray-400">{filteredHotels.length} properties</p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <input
                type="date"
                value={searchParams.checkIn}
                onChange={(e) => setSearchParams(prev => ({ ...prev, checkIn: e.target.value }))}
                className="px-4 py-2 rounded-lg text-gray-800 dark:text-white dark:bg-gray-700"
              />
              <input
                type="date"
                value={searchParams.checkOut}
                onChange={(e) => setSearchParams(prev => ({ ...prev, checkOut: e.target.value }))}
                className="px-4 py-2 rounded-lg text-gray-800 dark:text-white dark:bg-gray-700"
              />
            </div>
            
            <button
              onClick={() => handleSearch()}
              className="px-8 py-3 bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold rounded-lg transition-colors flex items-center gap-2"
            >
              <FaSearch />
              SEARCH
            </button>
          </div>
        </div>
      </div>

      {/* Sorting Bar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="text-gray-700 dark:text-gray-300 font-medium whitespace-nowrap">Sort by:</span>
            
            {[
              { id: 'best_match', label: 'Best match', icon: null },
              { id: 'top_reviewed', label: 'Top reviewed', icon: <FaStar /> },
              { id: 'lowest_price', label: 'Lowest price first', icon: null },
              { id: 'distance', label: 'Distance', icon: null },
              { id: 'hot_deals', label: 'Hot Deals!', icon: null }
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
            
            <button
              onClick={() => setShowMap(!showMap)}
              className="ml-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {showMap ? 'Show List' : 'Show on Map'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Filters Sidebar */}
          <div className="w-80 flex-shrink-0 hidden lg:block">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 sticky top-24">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Filters</h3>
              
              {/* Price Range */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Your budget (per night)</h4>
                <input
                  type="range"
                  min={priceRange.min}
                  max={priceRange.max}
                  className="w-full"
                />
                <div className="flex justify-between mt-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">PKR {priceRange.min.toLocaleString()}</span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">PKR {priceRange.max.toLocaleString()}</span>
                </div>
              </div>

              {/* Popular Filters */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Popular filters for Lahore</h4>
                {[
                  { id: 'internetAccess', label: 'Internet access' },
                  { id: 'kitchen', label: 'Kitchen' },
                  { id: 'coffeeMaker', label: 'Coffee/tea maker' },
                  { id: 'bathtub', label: 'Bathtub' },
                  { id: 'excellentLocation', label: 'Location: 8+ Excellent' },
                  { id: 'swimmingPool', label: 'Swimming pool' },
                  { id: 'carPark', label: 'Car park' }
                ].map(filter => (
                  <label key={filter.id} className="flex items-center gap-2 mb-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedFilters[filter.id]}
                      onChange={(e) => setSelectedFilters(prev => ({ ...prev, [filter.id]: e.target.checked }))}
                      className="w-4 h-4"
                    />
                    <span className="text-gray-700 dark:text-gray-300">{filter.label}</span>
                  </label>
                ))}
              </div>

              {/* Guest Rating */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Guest rating</h4>
                {[
                  { value: 9, label: '9+ Exceptional', count: hotels.filter(h => h.rating >= 9).length },
                  { value: 8, label: '8+ Excellent', count: hotels.filter(h => h.rating >= 8 && h.rating < 9).length },
                  { value: 7, label: '7+ Very good', count: hotels.filter(h => h.rating >= 7 && h.rating < 8).length },
                  { value: 6, label: '6+ Good', count: hotels.filter(h => h.rating >= 6 && h.rating < 7).length }
                ].map(rating => (
                  <label key={rating.value} className="flex items-center gap-2 mb-2 cursor-pointer">
                    <input
                      type="radio"
                      name="rating"
                      checked={selectedFilters.rating === rating.value}
                      onChange={() => setSelectedFilters(prev => ({ ...prev, rating: rating.value }))}
                      className="w-4 h-4"
                    />
                    <span className="text-gray-700 dark:text-gray-300">{rating.label} ({rating.count})</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {loading && (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-400">Searching hotels...</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
                <p className="text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {!loading && !showMap && (
              <>
                <div className="mb-4 text-gray-600 dark:text-gray-400">
                  <p>{filteredHotels.length} properties found • Page {currentPage} of {totalPages}</p>
                </div>

                <div className="space-y-4">
                  {currentHotels.map((hotel) => (
                    <motion.div
                      key={hotel.id}
                      ref={el => hotelRefs.current[hotel.id] = el}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ 
                        opacity: 1, 
                        y: 0,
                        scale: activeHotel === hotel.id ? 1.02 : 1
                      }}
                      transition={{ duration: 0.3 }}
                      className={`bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-xl transition-all overflow-hidden flex gap-4 ${
                        activeHotel === hotel.id ? 'ring-4 ring-blue-500' : ''
                      }`}
                    >
                      {/* Hotel Image */}
                      <div className="w-72 h-64 flex-shrink-0">
                        <img
                          src={hotel.image}
                          alt={hotel.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.src = 'https://via.placeholder.com/400x300?text=Hotel+Image';
                          }}
                        />
                      </div>

                      {/* Hotel Details */}
                      <div className="flex-1 p-6 flex flex-col">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-1">
                              {hotel.name}
                            </h3>
                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
                              <FaMapMarkerAlt />
                              <span>{hotel.address || hotel.location}</span>
                            </div>
                            {hotel.availability && (
                              <span className={`text-xs font-medium px-2 py-0.5 rounded ${hotel.is_limited ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}`}>
                                {hotel.availability}
                              </span>
                            )}
                          </div>
                          
                          <button
                            onClick={() => toggleFavorite(hotel.id)}
                            className="text-2xl text-red-500 hover:scale-110 transition-transform"
                          >
                            {favorites.has(hotel.id) ? <FaHeart /> : <FaRegHeart />}
                          </button>
                        </div>

                        {/* Rating */}
                        {hotel.rating > 0 && (
                          <div className="flex items-center gap-2 mb-3">
                            <div className="bg-blue-600 text-white px-2 py-1 rounded font-bold">
                              {hotel.rating.toFixed(1)}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-800 dark:text-white">
                                {hotel.rating >= 9 ? 'Exceptional' : hotel.rating >= 8 ? 'Excellent' : hotel.rating >= 7 ? 'Very Good' : 'Good'}
                              </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">{hotel.reviewCount ? `${hotel.reviewCount.toLocaleString()} reviews` : ''}</p>
                            </div>
                          </div>
                        )}

                        {/* Amenities */}
                        <div className="flex gap-3 mb-4">
                          {hotel.amenities?.wifi && (
                            <div className="flex items-center gap-1 text-green-600" title="WiFi">
                              <FaWifi />
                            </div>
                          )}
                          {hotel.amenities?.parking && (
                            <div className="flex items-center gap-1 text-green-600" title="Parking">
                              <FaParking />
                            </div>
                          )}
                          {hotel.amenities?.pool && (
                            <div className="flex items-center gap-1 text-green-600" title="Pool">
                              <FaSwimmingPool />
                            </div>
                          )}
                          {hotel.amenities?.restaurant && (
                            <div className="flex items-center gap-1 text-green-600" title="Restaurant">
                              <FaUtensils />
                            </div>
                          )}
                        </div>

                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">
                          {hotel.description}
                        </p>

                        <div className="mt-auto flex items-end justify-between">
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {(() => {
                                const d1 = new Date(searchParams.checkIn);
                                const d2 = new Date(searchParams.checkOut);
                                const nights = Math.max(1, Math.ceil((d2 - d1) / (1000*60*60*24)));
                                return `${nights} night${nights > 1 ? 's' : ''}, ${searchParams.adults} adult${searchParams.adults > 1 ? 's' : ''}`;
                              })()}
                            </p>
                            <p className="text-3xl font-bold text-blue-600">
                              {formatPrice(hotel.double_bed_price_per_day || hotel.price)}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">per night</p>
                          </div>
                          
                          <button
                            onClick={() => window.location.href = `/hotel-booking?hotelId=${hotel.id}`}
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors"
                          >
                            See availability
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-8 flex justify-center gap-2">
                    <button
                      onClick={() => paginate(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg disabled:opacity-50"
                    >
                      Previous
                    </button>
                    
                    {[...Array(Math.min(10, totalPages))].map((_, i) => (
                      <button
                        key={i + 1}
                        onClick={() => paginate(i + 1)}
                        className={`px-4 py-2 rounded-lg ${
                          currentPage === i + 1
                            ? 'bg-blue-600 text-white'
                            : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                    
                    <button
                      onClick={() => paginate(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Map View */}
            {!loading && showMap && (
              <div className="h-[calc(100vh-250px)] rounded-lg overflow-hidden shadow-lg">
                <MapContainer
                  center={mapCenter}
                  zoom={mapZoom}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                  <MapController center={mapCenter} zoom={mapZoom} />
                  
                  {filteredHotels.map(hotel => (
                    hotel.latitude && hotel.longitude && (
                      <Marker
                        key={hotel.id}
                        position={[hotel.latitude, hotel.longitude]}
                        icon={createHotelIcon(hotel.double_bed_price_per_day || hotel.price, activeHotel === hotel.id)}
                        eventHandlers={{
                          click: () => {
                            setShowMap(false);
                            setTimeout(() => scrollToHotel(hotel.id), 100);
                          }
                        }}
                      >
                        <Popup>
                          <div className="p-2">
                            <h3 className="font-bold">{hotel.name}</h3>
                            <p className="text-sm text-gray-600">{hotel.address}</p>
                            <p className="text-lg font-bold text-blue-600 mt-2">
                              {formatPrice(hotel.double_bed_price_per_day || hotel.price)}
                            </p>
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

export default HotelResults;
