import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaArrowLeft,
  FaStar,
  FaHeart,
  FaRegHeart,
  FaShareAlt,
  FaMapMarkerAlt,
  FaWifi,
  FaParking,
  FaSwimmingPool,
  FaUtensils,
  FaCoffee,
  FaDumbbell,
  FaSnowflake,
  FaConciergeBell,
  FaSpa,
  FaShuttleVan,
  FaTv,
  FaBath,
  FaCheck,
  FaUsers,
  FaBed,
  FaCalendarAlt,
  FaTimes,
  FaChevronLeft,
  FaChevronRight,
  FaExpand,
  FaChild,
  FaDog,
  FaInfoCircle,
  FaTag
} from 'react-icons/fa';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { reviewAPI } from '../services/api';

// Fix for default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Helper function to format price
const formatPrice = (price) => {
  return new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(price);
};

// Rating labels
const getRatingLabel = (rating) => {
  if (rating >= 9) return 'Exceptional';
  if (rating >= 8) return 'Excellent';
  if (rating >= 7) return 'Very Good';
  if (rating >= 6) return 'Good';
  if (rating >= 5) return 'Pleasant';
  return 'Fair';
};

// Generate realistic review categories based on overall rating
const generateReviewCategories = (overallRating) => {
  const variance = () => (Math.random() - 0.5) * 1.2;
  const clamp = (val) => Math.min(10, Math.max(1, val));
  
  return {
    staff: clamp(overallRating + variance()),
    facilities: clamp(overallRating - 0.2 + variance()),
    cleanliness: clamp(overallRating + 0.1 + variance()),
    comfort: clamp(overallRating + variance()),
    valueForMoney: clamp(overallRating - 0.3 + variance()),
    location: clamp(overallRating + 0.5 + variance()),
    freeWifi: clamp(overallRating + 0.2 + variance()),
  };
};



// Image Gallery Component
const ImageGallery = ({ images, hotelName, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
      >
        <FaTimes className="text-white text-xl" />
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); prevImage(); }}
        className="absolute left-4 z-10 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
      >
        <FaChevronLeft className="text-white text-xl" />
      </button>

      <motion.img
        key={currentIndex}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        src={images[currentIndex]}
        alt={`${hotelName} - Image ${currentIndex + 1}`}
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />

      <button
        onClick={(e) => { e.stopPropagation(); nextImage(); }}
        className="absolute right-4 z-10 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
      >
        <FaChevronRight className="text-white text-xl" />
      </button>

      <div className="absolute bottom-4 text-white text-sm">
        {currentIndex + 1} / {images.length}
      </div>
    </motion.div>
  );
};

// Room Type Card Component
const RoomTypeCard = ({ room, nights, searchParams, onSelect, isSelected }) => {
  const [selectedRooms, setSelectedRooms] = useState(0);

  const totalPrice = room.pricePerNight * nights;
  const taxes = Math.round(totalPrice * 0.16); // 16% taxes

  const features = [
    room.breakfastIncluded && { text: 'Good breakfast included', icon: FaCoffee, color: 'text-green-600' },
    room.freeCancellation && { text: `Free cancellation before ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`, icon: FaCheck, color: 'text-green-600' },
    room.valetParking && { text: 'Includes valet parking + high-speed internet', icon: FaCheck, color: 'text-green-600' },
    room.noPrepayment && { text: 'No prepayment needed – pay at the property', icon: FaCheck, color: 'text-green-600' },
    room.noCreditCard && { text: 'No credit card needed', icon: FaTag, color: 'text-green-600' },
  ].filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`border rounded-lg overflow-hidden transition-all ${
        isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      {/* Room Header - Hidden on mobile */}
      <div className="hidden lg:block bg-blue-600 text-white px-4 py-2 text-sm font-medium">
        <div className="grid grid-cols-5 gap-4">
          <span>Room type</span>
          <span className="text-center">Number of guests</span>
          <span className="text-center">Price for {nights} night{nights > 1 ? 's' : ''}</span>
          <span>Your choices</span>
          <span className="text-center">Select Rooms</span>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden p-4 bg-white dark:bg-gray-800 space-y-4">
        <div>
          <h4 className="text-lg text-blue-600 dark:text-blue-400 font-semibold">
            {room.name}
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1 mt-1">
            <FaBed /> {room.beds} • <FaUsers className="ml-1" /> Max {room.maxGuests || 2} guests
          </p>
        </div>
        
        <div className="flex flex-wrap gap-1">
          {room.size && (
            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">📐 {room.size}</span>
          )}
          {room.view && (
            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">🏙️ {room.view}</span>
          )}
          {room.freeWifi && (
            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">📶 Free Wifi</span>
          )}
        </div>
        
        <div className="space-y-1">
          {features.slice(0, 3).map((feature, idx) => (
            <p key={idx} className={`text-sm flex items-center gap-2 ${feature.color}`}>
              <feature.icon className="flex-shrink-0" />
              <span>{feature.text}</span>
            </p>
          ))}
        </div>
        
        <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              PKR {formatPrice(totalPrice)}
            </p>
            <p className="text-xs text-gray-500">+PKR {formatPrice(taxes)} taxes</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedRooms}
              onChange={(e) => {
                setSelectedRooms(parseInt(e.target.value));
                if (parseInt(e.target.value) > 0) {
                  onSelect(room, parseInt(e.target.value));
                }
              }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
            >
              {[0, 1, 2, 3, 4, 5].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            {selectedRooms > 0 && (
              <button
                onClick={() => onSelect(room, selectedRooms)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
              >
                Reserve
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden lg:grid grid-cols-5 gap-4 p-4 bg-white dark:bg-gray-800">
        {/* Room Info */}
        <div className="space-y-2">
          <h4 className="text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer">
            {room.name}
          </h4>
          {room.highFloor && (
            <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
              ↑ High floor
            </p>
          )}
          <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
            <FaBed /> {room.beds}
          </p>
          
          {/* Room Features */}
          <div className="flex flex-wrap gap-1 text-xs">
            {room.size && (
              <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
                📐 {room.size}
              </span>
            )}
            {room.view && (
              <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
                🏙️ {room.view}
              </span>
            )}
            {room.airConditioning && (
              <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
                ❄️ Air conditioning
              </span>
            )}
            {room.privateBathroom && (
              <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
                🚿 Attached bathroom
              </span>
            )}
            {room.flatScreenTV && (
              <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
                📺 Flat-screen TV
              </span>
            )}
            {room.minibar && (
              <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
                🍷 Minibar
              </span>
            )}
            {room.freeWifi && (
              <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
                📶 Free Wifi
              </span>
            )}
          </div>
          
          {/* Additional amenities list */}
          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5 max-h-32 overflow-y-auto">
            {room.amenities?.map((amenity, idx) => (
              <p key={idx} className="flex items-center gap-1">
                <FaCheck className="text-green-500 text-xs" /> {amenity}
              </p>
            ))}
          </div>
        </div>

        {/* Guests */}
        <div className="flex items-start justify-center">
          <div className="flex gap-1">
            {[...Array(room.maxGuests || 2)].map((_, i) => (
              <FaUsers key={i} className="text-gray-600 dark:text-gray-400" />
            ))}
          </div>
        </div>

        {/* Price */}
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            PKR {formatPrice(totalPrice)}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            +PKR {formatPrice(taxes)} taxes and fees
          </p>
        </div>

        {/* Features */}
        <div className="space-y-2">
          {features.map((feature, idx) => (
            <p key={idx} className={`text-sm flex items-start gap-2 ${feature.color}`}>
              <feature.icon className="mt-0.5 flex-shrink-0" />
              <span>{feature.text}</span>
            </p>
          ))}
          {room.geniusDiscount && (
            <p className="text-sm text-purple-600 dark:text-purple-400 flex items-center gap-2">
              <FaTag /> Genius discount may be available
            </p>
          )}
        </div>

        {/* Select Rooms */}
        <div className="flex flex-col items-center gap-3">
          <select
            value={selectedRooms}
            onChange={(e) => {
              setSelectedRooms(parseInt(e.target.value));
              if (parseInt(e.target.value) > 0) {
                onSelect(room, parseInt(e.target.value));
              }
            }}
            className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {[0, 1, 2, 3, 4, 5].map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          
          {selectedRooms > 0 && (
            <motion.button
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              onClick={() => onSelect(room, selectedRooms)}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              I'll reserve
            </motion.button>
          )}
          
          {selectedRooms > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              • You won't be charged yet
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// Review Category Bar Component
const ReviewCategoryBar = ({ label, score }) => (
  <div className="flex items-center gap-4">
    <span className="w-32 text-sm text-gray-700 dark:text-gray-300">{label}</span>
    <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
      <div 
        className="h-full bg-blue-600 rounded-full transition-all duration-500"
        style={{ width: `${(score / 10) * 100}%` }}
      />
    </div>
    <span className="w-8 text-sm font-medium text-gray-700 dark:text-gray-300">{score.toFixed(1)}</span>
  </div>
);

// Main Component
const HotelDetailsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { hotel, searchParams } = location.state || {};

  const [isFavorite, setIsFavorite] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [selectedRoomCount, setSelectedRoomCount] = useState(0);
  const [hotelReviews, setHotelReviews] = useState([]);
  const [reviewAnalytics, setReviewAnalytics] = useState(null);

  // Redirect if no hotel data
  useEffect(() => {
    if (!hotel) {
      navigate('/hotels/search-results');
    }
  }, [hotel, navigate]);

  // Load real reviews for this hotel
  useEffect(() => {
    if (hotel?.id) {
      Promise.all([
        reviewAPI.list({ hotel: hotel.id, ordering: '-created_at' }),
        reviewAPI.analytics(hotel.id),
      ]).then(([reviewsRes, analyticsRes]) => {
        setHotelReviews(reviewsRes.data || []);
        setReviewAnalytics(analyticsRes.data || null);
      }).catch(() => {});
    }
  }, [hotel?.id]);

  // Calculate nights
  const nights = useMemo(() => {
    if (!searchParams?.checkIn || !searchParams?.checkOut) return 1;
    const checkIn = new Date(searchParams.checkIn);
    const checkOut = new Date(searchParams.checkOut);
    return Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24)) || 1;
  }, [searchParams]);

  // Generate review categories based on hotel rating
  const reviewCategories = useMemo(() => {
    return generateReviewCategories(hotel?.rating || 7);
  }, [hotel?.rating]);

  // Generate room types from hotel data – use REAL scraped rooms when available
  const roomTypes = useMemo(() => {
    if (!hotel) return [];

    // ── If this hotel has real scraped rooms, use them directly ──────────
    if (hotel.rooms?.length > 0 && hotel.is_scraped) {
      return hotel.rooms.map((r, idx) => {
        const pricePerNight = r.price_per_night || hotel.double_bed_price_per_day || hotel.price || 5000;
        const rt = r.room_type || 'Standard Room';
        const isFreeCancellation = (r.cancellation_policy || '').toLowerCase().includes('free');
        const hasBreakfast = (r.meal_plan || '').toLowerCase().includes('breakfast');
        const maxGuests = r.max_occupancy || 2;

        // Map room type to bed description
        const bedMap = {
          'Single Room': '1 single bed',
          'Double Room': '1 double bed',
          'Triple Room': '3 single beds or 1 double + 1 single',
          'Quad Room': '2 double beds',
          'Quint Room': '2 double beds + 1 single',
          'Family Room': '2 double beds',
          'Suite': '1 king bed + living area',
          'Deluxe Room': '1 king bed',
          'Dormitory': 'Bunk beds',
          'Entire Property': 'Multiple rooms',
        };

        return {
          id: `scraped-room-${idx}`,
          name: rt,
          beds: bedMap[rt] || '1 double bed',
          pricePerNight: pricePerNight,
          maxGuests: maxGuests,
          size: null,
          view: null,
          highFloor: false,
          airConditioning: true,
          privateBathroom: true,
          flatScreenTV: true,
          minibar: false,
          freeWifi: true,
          breakfastIncluded: hasBreakfast,
          freeCancellation: isFreeCancellation,
          valetParking: false,
          noPrepayment: isFreeCancellation,
          noCreditCard: false,
          geniusDiscount: false,
          // Scraped extras
          meal_plan: r.meal_plan || null,
          cancellation_policy: r.cancellation_policy || null,
          availability: r.availability || 'Available',
          total_price: r.total_price || null,
          amenities: hotel.amenities || [],
        };
      });
    }

    // ── Fallback: generate standard room types from base price ───────────
    const basePrice = hotel.double_bed_price_per_day || hotel.price || 5000;
    
    return [
      {
        id: 'standard-queen',
        name: 'Standard Queen Room',
        beds: '1 queen bed',
        pricePerNight: Math.round(basePrice * 0.85),
        maxGuests: 2,
        size: '28 m²',
        view: 'City view',
        highFloor: true,
        airConditioning: true,
        privateBathroom: true,
        flatScreenTV: true,
        minibar: true,
        freeWifi: true,
        breakfastIncluded: true,
        freeCancellation: true,
        valetParking: true,
        noPrepayment: true,
        noCreditCard: true,
        geniusDiscount: true,
        amenities: [
          'Bathrobe', 'Safe', 'Toilet', 'Sofa',
          'Bathtub or shower', 'Hardwood or parquet floors',
          'Towels', 'Linens', 'Socket near the bed',
          'Tile/Marble floor', 'Desk', 'TV',
          'Slippers', 'Refrigerator', 'Telephone',
          'Ironing facilities', 'Satellite channels',
          'Tea/Coffee maker', 'Heating',
          'Hairdryer', 'Guest bathroom',
          'Walk-in closet', 'Towels/Sheets (extra fee)',
          'Cable channels', 'Wake-up service',
          'Dryer', 'Wardrobe or closet'
        ]
      },
      {
        id: 'deluxe-king',
        name: 'Deluxe King Room',
        beds: '1 king bed',
        pricePerNight: basePrice,
        maxGuests: 2,
        size: '35 m²',
        view: 'Landmark view',
        highFloor: true,
        airConditioning: true,
        privateBathroom: true,
        flatScreenTV: true,
        minibar: true,
        freeWifi: true,
        breakfastIncluded: true,
        freeCancellation: true,
        valetParking: true,
        noPrepayment: true,
        noCreditCard: false,
        geniusDiscount: true,
        amenities: [
          'Bathrobe', 'Safe', 'Toilet', 'Sofa', 'Seating Area',
          'Bathtub', 'Hardwood floors',
          'Towels', 'Premium linens', 'USB ports',
          'Marble floor', 'Work desk', 'Smart TV',
          'Slippers', 'Mini fridge', 'Telephone',
          'Iron', 'Premium channels',
          'Nespresso machine', 'Climate control',
          'Hairdryer', 'Guest bathroom',
          'Walk-in closet', 'Bathrobes provided',
          'Netflix', 'Wake-up service',
          'Laundry service', 'Wardrobe'
        ]
      },
      {
        id: 'family-suite',
        name: 'Family Suite',
        beds: '2 double beds',
        pricePerNight: Math.round(basePrice * 1.5),
        maxGuests: 4,
        size: '50 m²',
        view: 'City view',
        highFloor: false,
        airConditioning: true,
        privateBathroom: true,
        flatScreenTV: true,
        minibar: true,
        freeWifi: true,
        breakfastIncluded: true,
        freeCancellation: true,
        valetParking: true,
        noPrepayment: true,
        noCreditCard: true,
        geniusDiscount: false,
        amenities: [
          'Bathrobe', 'Safe', 'Toilet', 'Living area',
          'Bathtub and shower', 'Carpeted floors',
          'Towels', 'Linens', 'Multiple charging points',
          'Desk', '2 TVs',
          'Slippers', 'Full refrigerator', 'Telephone',
          'Iron', 'Cable TV',
          'Coffee maker', 'AC',
          'Hairdryer', '2 bathrooms',
          'Closet space', 'Cribs available',
          'Kids channels', 'Wake-up service',
          'Connecting rooms available'
        ]
      }
    ];
  }, [hotel]);

  // Generate multiple images for gallery
  const hotelImages = useMemo(() => {
    if (!hotel?.image) return [
      'https://via.placeholder.com/800x600?text=Hotel+Image',
      'https://via.placeholder.com/800x600?text=Room+Image',
      'https://via.placeholder.com/800x600?text=Bathroom+Image',
      'https://via.placeholder.com/800x600?text=Lobby+Image',
    ];
    
    // Return the main image and some placeholder alternatives
    return [
      hotel.image,
      hotel.image, // In real app, these would be different images
      hotel.image,
      hotel.image,
    ];
  }, [hotel]);

  // Handle room selection
  const handleRoomSelect = (room, count) => {
    setSelectedRoom(room);
    setSelectedRoomCount(count);
  };

  // Handle booking
  const handleBooking = () => {
    if (!selectedRoom || selectedRoomCount === 0) return;

    // Map room name to room_type key for booking
    const roomNameMap = {
      'Single Room': 'single',
      'Double Room': 'double',
      'Triple Room': 'triple',
      'Quad Room': 'quad',
      'Quint Room': 'quint',
      'Family Room': 'family',
      'Suite': 'suite',
      'Deluxe Room': 'deluxe',
      'Dormitory': 'dormitory',
      'Entire Property': 'entire',
      'Standard Queen Room': 'double',
      'Deluxe King Room': 'deluxe',
      'Family Suite': 'family',
    };

    const roomTypeKey = roomNameMap[selectedRoom.name] || 'double';

    navigate('/hotel-booking', {
      state: {
        hotel: {
          ...hotel,
          selectedRoom: selectedRoom,
          roomsSelected: selectedRoomCount
        },
        roomType: roomTypeKey,
        checkIn: searchParams?.checkIn,
        checkOut: searchParams?.checkOut,
        adults: searchParams?.adults || 2,
        children: searchParams?.children || 0,
      }
    });
  };

  if (!hotel) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading hotel details...</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'info', label: 'Info & prices' },
    { id: 'facilities', label: 'Facilities' },
    { id: 'rules', label: 'House rules' },
    { id: 'reviews', label: `Guest reviews (${hotel.review_count || Math.floor(Math.random() * 2000) + 500})` },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Image Gallery Modal */}
      <AnimatePresence>
        {showGallery && (
          <ImageGallery 
            images={hotelImages} 
            hotelName={hotel.name} 
            onClose={() => setShowGallery(false)} 
          />
        )}
      </AnimatePresence>

      {/* Header Navigation */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between py-3">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
            >
              <FaArrowLeft /> Back to results
            </button>
            
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsFavorite(!isFavorite)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                {isFavorite ? (
                  <FaHeart className="text-red-500 text-xl" />
                ) : (
                  <FaRegHeart className="text-gray-600 dark:text-gray-400 text-xl" />
                )}
              </button>
              <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                <FaShareAlt className="text-gray-600 dark:text-gray-400 text-xl" />
              </button>
              <button
                onClick={() => document.getElementById('availability-section')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Reserve
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Hotel Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            {/* Stars */}
            <div className="flex items-center gap-2 mb-2">
              <div className="flex">
                {[...Array(hotel.stars || 4)].map((_, i) => (
                  <FaStar key={i} className="text-yellow-500" />
                ))}
              </div>
              {hotel.property_type && (
                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs rounded">
                  {hotel.property_type}
                </span>
              )}
            </div>
            
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {hotel.name}
            </h1>
            
            <p className="text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline cursor-pointer">
              <FaMapMarkerAlt />
              {hotel.address || hotel.location} – 
              <span className="text-green-600 dark:text-green-400 font-medium">Great location - show map</span>
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button className="px-4 py-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg font-medium transition-colors flex items-center gap-2">
              <FaTag /> We Price Match
            </button>
          </div>
        </div>

        {/* Image Gallery */}
        <div className="grid grid-cols-4 gap-2 mb-6 rounded-xl overflow-hidden">
          <div 
            className="col-span-2 row-span-2 relative cursor-pointer group"
            onClick={() => setShowGallery(true)}
          >
            <img
              src={hotelImages[0]}
              alt={hotel.name}
              className="w-full h-full object-cover min-h-[300px]"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <FaExpand className="text-white text-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
          {hotelImages.slice(1, 5).map((img, idx) => (
            <div 
              key={idx} 
              className="relative cursor-pointer group"
              onClick={() => setShowGallery(true)}
            >
              <img
                src={img}
                alt={`${hotel.name} - ${idx + 2}`}
                className="w-full h-36 object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
            </div>
          ))}
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Rating Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="font-semibold text-gray-900 dark:text-white">{getRatingLabel(hotel.rating || 7)}</p>
                  <p className="text-sm text-blue-600 dark:text-blue-400">{hotel.review_count || Math.floor(Math.random() * 2000) + 500} reviews</p>
                </div>
                <div className="w-12 h-12 bg-blue-600 text-white rounded-lg rounded-bl-none flex items-center justify-center text-xl font-bold">
                  {(hotel.rating || 7).toFixed(1)}
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="font-semibold text-gray-900 dark:text-white">Great location!</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-8 h-8 bg-blue-600 text-white rounded-lg rounded-bl-none flex items-center justify-center text-sm font-bold">
                    {reviewCategories.location.toFixed(1)}
                  </div>
                </div>
              </div>
            </div>

            {/* About Section */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">About this property</h2>
              
              <div className="space-y-4 text-gray-700 dark:text-gray-300">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Comfortable Accommodations:</h3>
                  <p>{hotel.name} in {hotel.city || 'Lahore'} offers family rooms with air-conditioning, private bathrooms, and modern amenities. Each room includes a work desk, mini-bar, and free WiFi, ensuring a pleasant stay.</p>
                </div>
                
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Exceptional Facilities:</h3>
                  <p>Guests can enjoy spa facilities, an indoor swimming pool, fitness center, and hot tub. Additional services include beauty treatments, wellness packages, and a 24-hour front desk.</p>
                </div>
                
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Dining Experience:</h3>
                  <p>The family-friendly restaurant serves Chinese, Indian, and international cuisines in a modern and romantic ambiance. Breakfast options include continental, buffet, vegetarian, halal, and gluten-free.</p>
                </div>
                
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Prime Location:</h3>
                  <p>Located {hotel.distance_from_center || '5.6 mi'} from Allama Iqbal International Airport, the hotel is a 13-minute walk from Gaddafi Stadium. Nearby attractions include Nairang Galleries (2.1 mi) and Lahore Polo Club (3.1 mi).</p>
                </div>
                
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Groups in particular like the location – they rated it <strong>8.2</strong> for stays with multiple people.
                </p>
              </div>
            </div>

            {/* Most Popular Facilities */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Most popular facilities</h2>
              
              <div className="flex flex-wrap gap-4">
                {[
                  { icon: FaSwimmingPool, label: 'Indoor swimming pool' },
                  { icon: FaWifi, label: 'Free Wifi' },
                  { icon: FaParking, label: 'Free parking' },
                  { icon: FaConciergeBell, label: 'Room service' },
                  { icon: FaBan, label: 'Non-smoking rooms' },
                  { icon: FaDumbbell, label: 'Fitness center' },
                  { icon: FaWheelchair, label: 'Facilities for disabled guests' },
                  { icon: FaUtensils, label: '3 restaurants' },
                  { icon: FaCoffee, label: 'Tea/Coffee Maker in All Rooms' },
                ].map((facility, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <facility.icon className="text-green-600" />
                    <span>{facility.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Availability Section */}
            <div id="availability-section" className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Availability</h2>
                <button className="text-blue-600 hover:underline flex items-center gap-2">
                  <FaTag /> We Price Match
                </button>
              </div>

              {/* Search Bar */}
              <div className="flex flex-wrap gap-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800 mb-6">
                <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600">
                  <FaCalendarAlt className="text-gray-500" />
                  <span className="text-gray-700 dark:text-gray-300">
                    {searchParams?.checkIn ? new Date(searchParams.checkIn).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Check-in'} — {searchParams?.checkOut ? new Date(searchParams.checkOut).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Check-out'}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600">
                  <FaUsers className="text-gray-500" />
                  <span className="text-gray-700 dark:text-gray-300">
                    {searchParams?.adults || 2} adults · {searchParams?.children || 0} children · 1 room
                  </span>
                </div>
                
                <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
                  Change search
                </button>
              </div>

              {/* All Available Rooms */}
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">All Available Rooms</h3>
              
              <div className="space-y-4">
                {roomTypes.map((room) => (
                  <RoomTypeCard
                    key={room.id}
                    room={room}
                    nights={nights}
                    searchParams={searchParams}
                    onSelect={handleRoomSelect}
                    isSelected={selectedRoom?.id === room.id}
                  />
                ))}
              </div>
            </div>

            {/* Guest Reviews */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Guest reviews</h2>
                <button
                  onClick={() => navigate(`/reviews?hotel=${hotel.id || ''}`)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  See all reviews
                </button>
              </div>

              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-lg rounded-bl-none flex items-center justify-center text-xl font-bold">
                  {reviewAnalytics ? reviewAnalytics.average_rating.toFixed(1) : (hotel.rating || 7).toFixed(1)}
                </div>
                <div>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {getRatingLabel(reviewAnalytics ? reviewAnalytics.average_rating : (hotel.rating || 7))}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400 ml-2">
                    · {reviewAnalytics ? reviewAnalytics.total_reviews : (hotel.review_count || 0)} reviews
                  </span>
                </div>
              </div>

              {/* Analytics category bars from real data or fallback */}
              {reviewAnalytics && reviewAnalytics.aspect_averages ? (
                <>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Rating Breakdown:</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                    {Object.entries(reviewAnalytics.aspect_averages).map(([key, val]) => (
                      <ReviewCategoryBar key={key} label={key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} score={val * 2} />
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Categories:</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                    <ReviewCategoryBar label="Staff" score={reviewCategories.staff} />
                    <ReviewCategoryBar label="Facilities" score={reviewCategories.facilities} />
                    <ReviewCategoryBar label="Cleanliness" score={reviewCategories.cleanliness} />
                    <ReviewCategoryBar label="Comfort" score={reviewCategories.comfort} />
                    <ReviewCategoryBar label="Value for money" score={reviewCategories.valueForMoney} />
                    <ReviewCategoryBar label="Location" score={reviewCategories.location} />
                    <ReviewCategoryBar label="Free Wifi" score={reviewCategories.freeWifi} />
                  </div>
                </>
              )}

              {/* Real guest reviews */}
              {hotelReviews.length > 0 && (
                <div className="mt-6 space-y-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Recent Guest Reviews:</h3>
                  {hotelReviews.slice(0, 3).map((review) => (
                    <div key={review.id} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                            {review.user_details?.first_name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-800 dark:text-white">
                              {review.user_details?.first_name || 'Guest'}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(review.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                              {review.trip_type && ` · ${review.trip_type} trip`}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <FaStar key={s} className={`text-xs ${s <= review.overall_rating ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600'}`} />
                          ))}
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-gray-800 dark:text-white mb-1">{review.title}</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3">{review.content}</p>
                      {review.replies?.length > 0 && (
                        <div className="mt-2 ml-4 p-2 bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500 rounded text-xs text-gray-600 dark:text-gray-300">
                          <span className="font-bold text-blue-700 dark:text-blue-400">🏨 Hotel Response: </span>
                          {review.replies[0].content}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {hotelReviews.length === 0 && (
                <p className="mt-6 text-gray-500 dark:text-gray-400 text-sm">No guest reviews yet. Be the first to share your experience!</p>
              )}

              <button
                onClick={() => navigate(`/reviews?hotel=${hotel.id || ''}`)}
                className="mt-4 px-4 py-2 border border-blue-600 text-blue-600 rounded-lg font-medium hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
              >
                {hotelReviews.length > 0 ? `Read all ${reviewAnalytics?.total_reviews || hotelReviews.length} reviews` : 'View Reviews'}
              </button>
            </div>

            {/* House Rules */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">House rules</h2>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">{hotel.name} takes special requests – add in the next step!</p>
                </div>
                <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
                  See availability
                </button>
              </div>

              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                <div className="py-4 flex items-start gap-4">
                  <span className="text-gray-500 w-6">→</span>
                  <div className="w-48 font-medium text-gray-900 dark:text-white">Check-in</div>
                  <div className="text-gray-700 dark:text-gray-300">From 2:00 PM to 6:00 PM</div>
                </div>
                
                <div className="py-4 flex items-start gap-4">
                  <span className="text-gray-500 w-6">←</span>
                  <div className="w-48 font-medium text-gray-900 dark:text-white">Check-out</div>
                  <div className="text-gray-700 dark:text-gray-300">From 7:00 AM to 12:00 PM</div>
                </div>
                
                <div className="py-4 flex items-start gap-4">
                  <FaInfoCircle className="text-gray-500 w-6 mt-1" />
                  <div className="w-48 font-medium text-gray-900 dark:text-white">Cancellation/ prepayment</div>
                  <div className="text-gray-700 dark:text-gray-300">
                    Cancellation and prepayment policies vary according to accommodation type.
                    <button className="text-blue-600 hover:underline ml-1">Check what conditions</button> apply to each option when making your selection.
                  </div>
                </div>
                
                <div className="py-4 flex items-start gap-4">
                  <FaChild className="text-gray-500 w-6 mt-1" />
                  <div className="w-48 font-medium text-gray-900 dark:text-white">Children & Beds</div>
                  <div className="text-gray-700 dark:text-gray-300">
                    <p className="font-medium mb-2">Child policies</p>
                    <p>Children of all ages are welcome.</p>
                    <p className="mt-2">Children 18 and above will be charged as adults at this property.</p>
                    
                    <p className="font-medium mt-4 mb-2">Crib and extra bed policies</p>
                    <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg mt-2">
                      <p className="text-sm">0+ years</p>
                      <p className="flex items-center gap-2 mt-1">
                        <FaBed className="text-gray-500" />
                        Extra bed upon request: PKR 2,500 per person, per night
                      </p>
                    </div>
                    <p className="text-blue-600 text-sm mt-2">Cribs and extra beds aren't available at this property.</p>
                  </div>
                </div>
                
                <div className="py-4 flex items-start gap-4">
                  <FaUsers className="text-gray-500 w-6 mt-1" />
                  <div className="w-48 font-medium text-gray-900 dark:text-white">Age restriction</div>
                  <div className="text-gray-700 dark:text-gray-300">The minimum age for check-in is <strong>18</strong></div>
                </div>
                
                <div className="py-4 flex items-start gap-4">
                  <FaDog className="text-gray-500 w-6 mt-1" />
                  <div className="w-48 font-medium text-gray-900 dark:text-white">Pets</div>
                  <div className="text-gray-700 dark:text-gray-300">Pets are not allowed.</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Property Highlights */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 sticky top-32">
              <h3 className="font-bold text-gray-900 dark:text-white mb-4">Property highlights</h3>
              
              <p className="font-semibold text-gray-900 dark:text-white mb-3">Perfect for a {nights}-night stay!</p>
              
              <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300 mb-4">
                <p className="flex items-start gap-2">
                  <FaMapMarkerAlt className="text-gray-500 mt-0.5" />
                  <span><strong>Top Location:</strong> Highly rated by recent guests ({reviewCategories.location.toFixed(1)})</span>
                </p>
                <p>Popular with groups of friends</p>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Breakfast Info</h4>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Continental, Vegetarian, Halal, Gluten-free, Asian, Buffet
                </p>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Rooms with:</h4>
                <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  <p className="flex items-center gap-2">
                    <span>🏛️</span> Landmark view
                  </p>
                  <p className="flex items-center gap-2">
                    <span>🏙️</span> City view
                  </p>
                  <p className="flex items-center gap-2">
                    <FaParking className="text-gray-500" />
                    Free private parking available at the hotel
                  </p>
                </div>
              </div>

              <button
                onClick={handleBooking}
                disabled={!selectedRoom || selectedRoomCount === 0}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors"
              >
                Reserve
              </button>
              
              {selectedRoom && selectedRoomCount > 0 && (
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Selected: {selectedRoomCount}x {selectedRoom.name}
                  </p>
                  <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    PKR {formatPrice(selectedRoom.pricePerNight * nights * selectedRoomCount)}
                  </p>
                  <p className="text-xs text-gray-500">for {nights} night{nights > 1 ? 's' : ''}</p>
                </div>
              )}
            </div>

            {/* Map Preview */}
            <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="h-48">
                <MapContainer
                  center={[hotel.latitude || 31.5204, hotel.longitude || 74.3587]}
                  zoom={15}
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom={false}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; OpenStreetMap'
                  />
                  <Marker position={[hotel.latitude || 31.5204, hotel.longitude || 74.3587]}>
                    <Popup>{hotel.name}</Popup>
                  </Marker>
                </MapContainer>
              </div>
              <button className="w-full py-3 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 font-medium transition-colors">
                Show on map
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Missing icon imports - add these as simple components
const FaBan = ({ className }) => <span className={className}>🚭</span>;
const FaWheelchair = ({ className }) => <span className={className}>♿</span>;

export default HotelDetailsPage;
