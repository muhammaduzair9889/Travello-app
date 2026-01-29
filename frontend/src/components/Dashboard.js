import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { hotelAPI, bookingAPI } from '../services/api';
import { 
  FaHotel, 
  FaPlane, 
  FaGlobeAsia, 
  FaBook, 
  FaBars, 
  FaUserFriends, 
  FaCalendarAlt, 
  FaSearch, 
  FaSignOutAlt, 
  FaUser, 
  FaBell,
  FaCheckCircle,
  FaPhoneAlt,
  FaLanguage,
  FaExclamationTriangle,
  FaStar,
  FaWifi,
  FaParking,
  FaMapMarkerAlt,
  FaClock
} from 'react-icons/fa';
import { 
  Luggage, 
  MapPin, 
  Shield, 
  Notebook,
  Calendar,
  X
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const features = [
  {
    name: 'Hotels',
    icon: FaHotel,
    description: 'Find and book hotels worldwide.',
  },
  {
    name: 'Sightseeing',
    icon: FaGlobeAsia,
    description: 'Discover tours and activities.',
  },
  {
    name: 'My Bookings',
    icon: FaBook,
    description: 'View and manage your bookings.',
  },
  {
    name: 'Browse Hotels',
    icon: FaSearch,
    description: 'Browse all available hotels.',
  },
  {
    name: 'Smart Packing Checklist',
    icon: Luggage,
    description: 'Never forget essential items for your trip.',
  },
  {
    name: 'Travel Journal',
    icon: Notebook,
    description: 'Document your travel memories and experiences.',
  },
  {
    name: 'SOS Safety Toolkit',
    icon: Shield,
    description: 'Emergency contacts and safety resources.',
  },
];

const roomTypes = [
  { label: 'Single', value: 'single' },
  { label: 'Double', value: 'double' },
  { label: 'Triple', value: 'triple' },
  { label: 'Quad', value: 'quad' },
  { label: 'Family', value: 'family' },
];

// Sample data for packing checklist
const packingItems = [
  { id: 1, item: 'Passport & Travel Documents', checked: false },
  { id: 2, item: 'Clothes & Accessories', checked: false },
  { id: 3, item: 'Phone Charger & Adapter', checked: false },
  { id: 4, item: 'Toiletries & Medications', checked: false },
  { id: 5, item: 'Camera & Electronics', checked: false },
  { id: 6, item: 'Travel Insurance Papers', checked: false },
];

// Sample journal entries - Pakistan Famous Places
const journalEntries = [
  {
    id: 1,
    date: '2025-10-15',
    title: 'Badshahi Mosque Visit',
    excerpt: 'The magnificent Badshahi Mosque left me in awe of Mughal architecture...',
  },
  {
    id: 2,
    date: '2025-10-12',
    title: 'Exploring Lahore Fort',
    excerpt: 'Walked through the historic Shahi Qila and saw the beautiful Sheesh Mahal...',
  },
  {
    id: 3,
    date: '2025-10-08',
    title: 'Minar-e-Pakistan',
    excerpt: 'Visited the iconic national monument in Iqbal Park, truly inspiring...',
  },
];

// Emergency contacts - Pakistan
const emergencyContacts = [
  { name: 'Police', number: '15', icon: FaPhoneAlt },
  { name: 'Rescue 1122', number: '1122', icon: FaPhoneAlt },
  { name: 'Edhi Ambulance', number: '115', icon: FaPhoneAlt },
];

// Map attractions data - Lahore, Pakistan
const attractions = [
  // Must See Attractions
  { id: 1, name: 'Badshahi Mosque', lat: 31.5884, lng: 74.3105, category: 'Must See' },
  { id: 2, name: 'Lahore Fort (Shahi Qila)', lat: 31.5880, lng: 74.3154, category: 'Must See' },
  { id: 3, name: 'Minar-e-Pakistan', lat: 31.5925, lng: 74.3095, category: 'Must See' },
  { id: 4, name: 'Lahore Museum', lat: 31.5656, lng: 74.3189, category: 'Must See' },
  { id: 5, name: 'Shalimar Gardens', lat: 31.5875, lng: 74.3755, category: 'Must See' },
  { id: 6, name: 'Wazir Khan Mosque', lat: 31.5825, lng: 74.3192, category: 'Must See' },
  { id: 21, name: 'Data Darbar', lat: 31.5782, lng: 74.3131, category: 'Must See' },
  { id: 22, name: 'Jahangir\'s Tomb', lat: 31.6206, lng: 74.2769, category: 'Must See' },
  { id: 23, name: 'Tomb of Allama Iqbal', lat: 31.5883, lng: 74.3108, category: 'Must See' },
  { id: 25, name: 'Lahore Zoo', lat: 31.5686, lng: 74.3205, category: 'Must See' },
  { id: 26, name: 'Chauburji', lat: 31.5489, lng: 74.3247, category: 'Must See' },
  { id: 27, name: 'Hazuri Bagh', lat: 31.5881, lng: 74.3121, category: 'Must See' },
  { id: 28, name: 'Tomb of Nur Jahan', lat: 31.6213, lng: 74.2800, category: 'Must See' },
  
  // Food Destinations
  { id: 7, name: 'Food Street Gawalmandi', lat: 31.5821, lng: 74.3220, category: 'Food' },
  { id: 8, name: 'MM Alam Road Restaurants', lat: 31.5204, lng: 74.3487, category: 'Food' },
  { id: 9, name: 'Lakshmi Chowk Food Street', lat: 31.5783, lng: 74.3142, category: 'Food' },
  { id: 10, name: 'Anarkali Food Street', lat: 31.5590, lng: 74.3180, category: 'Food' },
  { id: 11, name: 'Fort Road Food Street', lat: 31.5886, lng: 74.3167, category: 'Food' },
  { id: 12, name: 'Yum Chinese Restaurant', lat: 31.4697, lng: 74.2728, category: 'Food' },
  { id: 29, name: 'Butt Karahi Lakshmi', lat: 31.5791, lng: 74.3145, category: 'Food' },
  { id: 30, name: 'Cafe Aylanto Gulberg', lat: 31.5212, lng: 74.3489, category: 'Food' },
  { id: 31, name: 'Cooco\'s Den Restaurant', lat: 31.5820, lng: 74.3169, category: 'Food' },
  { id: 32, name: 'Bundu Khan MM Alam', lat: 31.5204, lng: 74.3487, category: 'Food' },
  { id: 33, name: 'Haveli Restaurant', lat: 31.5884, lng: 74.3147, category: 'Food' },
  
  // Shopping Areas
  { id: 13, name: 'Liberty Market', lat: 31.5088, lng: 74.3428, category: 'Shopping' },
  { id: 14, name: 'Anarkali Bazaar', lat: 31.5625, lng: 74.3195, category: 'Shopping' },
  { id: 15, name: 'Packages Mall', lat: 31.4717, lng: 74.3558, category: 'Shopping' },
  { id: 16, name: 'Emporium Mall', lat: 31.4680, lng: 74.2664, category: 'Shopping' },
  { id: 17, name: 'Fortress Stadium', lat: 31.5318, lng: 74.3687, category: 'Shopping' },
  { id: 18, name: 'Pace Shopping Mall Gulberg', lat: 31.5123, lng: 74.3530, category: 'Shopping' },
  { id: 34, name: 'Gulberg Main Market', lat: 31.5204, lng: 74.3487, category: 'Shopping' },
  { id: 35, name: 'Mall Road Shopping', lat: 31.5656, lng: 74.3189, category: 'Shopping' },
  { id: 36, name: 'Xinhua Mall Liberty', lat: 31.5088, lng: 74.3428, category: 'Shopping' },
  
  // Adventure/Parks
  { id: 19, name: 'Jilani Park (Racecourse)', lat: 31.5134, lng: 74.3393, category: 'Adventure' },
  { id: 20, name: 'Jallo Park', lat: 31.5737, lng: 74.4772, category: 'Adventure' },
  { id: 37, name: 'Lahore Canal Bank', lat: 31.5204, lng: 74.3489, category: 'Adventure' },
  { id: 38, name: 'Model Town Park', lat: 31.4843, lng: 74.3150, category: 'Adventure' },
  { id: 39, name: 'Greater Iqbal Park', lat: 31.5928, lng: 74.3093, category: 'Adventure' },
  { id: 40, name: 'Lawrence Gardens (Bagh-e-Jinnah)', lat: 31.5686, lng: 74.3205, category: 'Adventure' },
  { id: 41, name: 'Sozo Water Park', lat: 31.5815, lng: 74.4855, category: 'Adventure' },
  { id: 42, name: 'Joyland', lat: 31.5334, lng: 74.3638, category: 'Adventure' },
];

// Smart Packing Checklist Widget
const PackingChecklistWidget = () => {
  const [checklist, setChecklist] = useState(packingItems);
  const [isGenerating, setIsGenerating] = useState(false);

  const toggleItem = (id) => {
    setChecklist(checklist.map(item => 
      item.id === id ? { ...item, checked: !item.checked } : item
    ));
  };

  const generatePackingList = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setChecklist(packingItems.map(item => ({ ...item, checked: false })));
      setIsGenerating(false);
    }, 1000);
  };

  const completedCount = checklist.filter(item => item.checked).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-sky-100 dark:bg-sky-900/30 rounded-xl flex items-center justify-center">
            <Luggage className="w-6 h-6 text-sky-600 dark:text-sky-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">Smart Packing Checklist</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{completedCount}/{checklist.length} items packed</p>
          </div>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {checklist.map((item) => (
          <motion.div
            key={item.id}
            whileHover={{ scale: 1.02 }}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all cursor-pointer"
            onClick={() => toggleItem(item.id)}
          >
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
              item.checked 
                ? 'bg-sky-600 border-sky-600' 
                : 'border-gray-300 dark:border-gray-600'
            }`}>
              {item.checked && <FaCheckCircle className="text-white text-xs" />}
            </div>
            <span className={`flex-1 text-sm ${
              item.checked 
                ? 'text-gray-400 dark:text-gray-500 line-through' 
                : 'text-gray-700 dark:text-gray-300'
            }`}>
              {item.item}
            </span>
          </motion.div>
        ))}
      </div>

      <button
        onClick={generatePackingList}
        disabled={isGenerating}
        className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isGenerating ? 'Generating...' : 'Generate New List'}
      </button>
    </motion.div>
  );
};

// Travel Journal Snapshot Widget
const TravelJournalWidget = () => {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
          <Notebook className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
        <h3 className="text-lg font-bold text-gray-800 dark:text-white">Travel Journal</h3>
      </div>

      <div className="space-y-3 mb-4">
        {journalEntries.map((entry) => (
          <motion.div
            key={entry.id}
            whileHover={{ scale: 1.02 }}
            className="p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-500 dark:text-gray-400">{entry.date}</span>
            </div>
            <h4 className="text-sm font-semibold text-gray-800 dark:text-white mb-1">{entry.title}</h4>
            <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">{entry.excerpt}</p>
          </motion.div>
        ))}
      </div>

      <button
        onClick={() => navigate('/journal')}
        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
      >
        View All Entries
      </button>
    </motion.div>
  );
};

// SOS/Safety Toolkit Widget
const SOSToolkitWidget = () => {
  const [showTranslateModal, setShowTranslateModal] = useState(false);

  const commonPhrases = [
    { english: 'Help me, please!', translated: '¡Ayúdame, por favor!' },
    { english: 'Where is the hospital?', translated: '¿Dónde está el hospital?' },
    { english: 'I need a doctor', translated: 'Necesito un médico' },
    { english: 'Call the police', translated: 'Llama a la policía' },
  ];

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
            <Shield className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-800 dark:text-white">SOS Safety Toolkit</h3>
        </div>

        <div className="space-y-2 mb-4">
          {emergencyContacts.map((contact, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50"
            >
              <div className="flex items-center gap-2">
                <contact.icon className="text-red-600 dark:text-red-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{contact.name}</span>
              </div>
              <a
                href={`tel:${contact.number}`}
                className="text-sm font-semibold text-red-600 dark:text-red-400 hover:underline"
              >
                {contact.number}
              </a>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowTranslateModal(true)}
            className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <FaLanguage />
            Quick Translate
          </button>
          <button
            onClick={() => alert('🚨 Emergency services will be contacted! Stay calm and provide your location.')}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <FaExclamationTriangle />
            SOS
          </button>
        </div>
      </motion.div>

      {/* Translate Modal */}
      <AnimatePresence>
        {showTranslateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowTranslateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white">Common Phrases (Spanish)</h3>
                <button
                  onClick={() => setShowTranslateModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-3">
                {commonPhrases.map((phrase, idx) => (
                  <div key={idx} className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                    <p className="text-sm font-medium text-gray-800 dark:text-white mb-1">{phrase.english}</p>
                    <p className="text-sm text-blue-600 dark:text-blue-400">{phrase.translated}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// Interactive Map Component
const InteractiveMap = () => {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const categories = ['All', 'Must See', 'Food', 'Shopping', 'Adventure'];

  const filteredAttractions = selectedCategory === 'All'
    ? attractions
    : attractions.filter(a => a.category === selectedCategory);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
            <MapPin className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">Explore Nearby</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{filteredAttractions.length} attractions</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              selectedCategory === category
                ? 'bg-sky-600 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="rounded-xl overflow-hidden h-[500px] border border-gray-200 dark:border-gray-600">
        <MapContainer center={[31.5497, 74.3436]} zoom={12} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {/* User Location */}
          <Marker position={[31.5497, 74.3436]}>
            <Popup>
              <div className="text-center">
                <p className="font-semibold">Your Location</p>
                <p className="text-xs text-gray-600">Lahore, Pakistan</p>
              </div>
            </Popup>
          </Marker>

          {/* Attractions */}
          {filteredAttractions.map((attraction) => (
            <Marker key={attraction.id} position={[attraction.lat, attraction.lng]}>
              <Popup>
                <div className="text-center">
                  <p className="font-semibold">{attraction.name}</p>
                  <p className="text-xs text-blue-600">{attraction.category}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </motion.div>
  );
};

// Professional Sidebar Component
const Sidebar = ({ activeFeature, setActiveFeature }) => {
  const navigate = useNavigate();
  return (
    <aside className="hidden md:flex flex-col bg-white dark:bg-gray-800 shadow-lg h-full w-64 border-r border-gray-200 dark:border-gray-700 transition-colors duration-300">
      {/* Logo Section */}
      <div className="px-6 py-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-sky-600 dark:bg-sky-500 rounded-lg flex items-center justify-center">
            <FaGlobeAsia className="text-white text-xl" />
          </div>
          <span className="text-xl font-bold text-gray-800 dark:text-white" style={{ fontFamily: 'Inter, sans-serif' }}>
            Travello
          </span>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-4 py-6">
        <div className="space-y-2">
          {features.map((feature) => {
            const Icon = feature.icon;
            const isActive = activeFeature === feature.name;
            
            return (
              <button
                key={feature.name}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
                  isActive
                    ? 'bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-700'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                onClick={() => {
                  if (feature.name === 'Browse Hotels') {
                    navigate('/hotels');
                  } else if (feature.name === 'My Bookings') {
                    navigate('/my-bookings');
                  } else {
                    setActiveFeature(feature.name);
                  }
                }}
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                <Icon className={`text-lg ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`} />
                {feature.name}
              </button>
            );
          })}
        </div>
      </nav>

      {/* User Profile Section */}
      <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors">
          <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
            <FaUser className="text-gray-600 dark:text-gray-300 text-sm" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-800 dark:text-white" style={{ fontFamily: 'Inter, sans-serif' }}>
              Faizan Khan
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400" style={{ fontFamily: 'Inter, sans-serif' }}>
              faizan@example.com
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};

// Professional Top Navigation Bar
const TopNav = () => {
  const navigate = useNavigate();
  
  const handleSignOut = () => {
    // Clear all authentication tokens
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('admin_access_token');
    localStorage.removeItem('admin_refresh_token');
    localStorage.removeItem('admin');
    
    // Redirect to login page
    navigate('/login');
  };

  return (
    <header className="w-full bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6 py-4 transition-colors duration-300">
      <div className="flex items-center gap-4">
        <FaBars className="text-gray-600 dark:text-gray-300 w-5 h-5 md:hidden cursor-pointer" />
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white" style={{ fontFamily: 'Inter, sans-serif' }}>
            Dashboard
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400" style={{ fontFamily: 'Inter, sans-serif' }}>
            Welcome back, manage your travel bookings
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <button className="relative p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
          <FaBell className="text-xl" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>
        
        <button 
          onClick={handleSignOut}
          className="flex items-center gap-2 px-4 py-2 text-white bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 rounded-lg font-medium transition-colors shadow-sm" 
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          <FaSignOutAlt />
          Sign Out
        </button>
      </div>
    </header>
  );
};

// Main Dashboard Component
const Dashboard = () => {
  const navigate = useNavigate();
  const [activeFeature, setActiveFeature] = useState('Hotels');
  const [destination, setDestination] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [roomType, setRoomType] = useState('double');
  const [roomTypeTouched, setRoomTypeTouched] = useState(false);
  const [filtersActive, setFiltersActive] = useState(false);
  const [availabilityCache, setAvailabilityCache] = useState({});
  const [availabilityChecking, setAvailabilityChecking] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [hotels, setHotels] = useState([]);
  const [filteredHotels, setFilteredHotels] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loadingHotels, setLoadingHotels] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [cancelling, setCancelling] = useState(null);
  
  const suggestions = ['Dubai', 'London', 'Bangkok', 'Paris', 'New York', 'Singapore'];

  useEffect(() => {
    if (activeFeature === 'Hotels') {
      fetchHotels();
    } else if (activeFeature === 'My Bookings') {
      fetchBookings();
    }
  }, [activeFeature]);

  const applyHotelFilters = (list) => {
    if (!filtersActive) return list || [];

    const query = destination.trim().toLowerCase();
    const hasDateFilter = Boolean(checkIn || checkOut);

    return (list || []).filter((hotel) => {
      const matchesDestination = query
        ? [hotel.name, hotel.city, hotel.address]
            .filter(Boolean)
            .some((val) => val.toLowerCase().includes(query))
        : true;

      const matchesRoomType = roomTypeTouched && roomType
        ? (hotel.room_types || []).some((rt) => rt.type === roomType)
        : true;

      const matchesDates = hasDateFilter
        ? Number(hotel.available_rooms ?? hotel.total_rooms ?? 0) > 0
        : true;

      return matchesDestination && matchesRoomType && matchesDates;
    });
  };

  const getAvailabilityKey = (hotelId, roomTypeId) => `${hotelId}-${roomTypeId}-${checkIn || 'none'}-${checkOut || 'none'}`;

  const fetchRoomAvailability = async (hotel, selectedRoomType) => {
    if (!checkIn || !checkOut || !selectedRoomType?.id) {
      return selectedRoomType?.available_rooms ?? hotel.available_rooms ?? 0;
    }

    // Skip availability check for scraped hotels - they're always "available"
    if (hotel.is_scraped || hotel.scraped_data || String(hotel.id).startsWith('scraped-')) {
      return selectedRoomType?.available_rooms ?? 10;
    }

    const cacheKey = getAvailabilityKey(hotel.id, selectedRoomType.id);
    if (availabilityCache[cacheKey] !== undefined) {
      return availabilityCache[cacheKey];
    }

    try {
      const response = await hotelAPI.checkAvailability({
        hotel: hotel.id,
        room_type: selectedRoomType.id,
        check_in: checkIn,
        check_out: checkOut,
        rooms_needed: 1,
      });

      const availableFromApi = response.data?.data?.room_types?.find((rt) => rt.id === selectedRoomType.id)?.available_rooms;
      const resolved = availableFromApi ?? response.data?.available_rooms ?? selectedRoomType.available_rooms ?? 0;

      setAvailabilityCache((prev) => ({ ...prev, [cacheKey]: resolved }));
      return resolved;
    } catch (err) {
      console.error('Availability check failed for hotel', hotel.id, err);
      return selectedRoomType.available_rooms ?? hotel.available_rooms ?? 0;
    }
  };

  const filterByAvailability = async (list) => {
    if (!checkIn || !checkOut || !roomType) return list || [];

    setAvailabilityChecking(true);
    try {
      const checked = await Promise.all(
        (list || []).map(async (hotel) => {
          const rt = (hotel.room_types || []).find((r) => r.type === roomType);
          if (!rt) return null;
          const available = await fetchRoomAvailability(hotel, rt);
          return available > 0 ? hotel : null;
        })
      );
      return checked.filter(Boolean);
    } finally {
      setAvailabilityChecking(false);
    }
  };

  const fetchHotels = async () => {
    setLoadingHotels(true);
    try {
      const response = await hotelAPI.getAllHotels();
      const data = response.data || [];
      setHotels(data);
      const base = applyHotelFilters(data);
      const finalList = checkIn && checkOut && roomType ? await filterByAvailability(base) : base;
      setFilteredHotels(finalList);
    } catch (error) {
      console.error('Error fetching hotels:', error);
    } finally {
      setLoadingHotels(false);
    }
  };

  const fetchBookings = async () => {
    setLoadingBookings(true);
    try {
      const response = await bookingAPI.getMyBookings();
      setBookings(response.data);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoadingBookings(false);
    }
  };

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) {
      return;
    }

    setCancelling(bookingId);
    try {
      await bookingAPI.cancelBooking(bookingId);
      // Refresh bookings list
      await fetchBookings();
    } catch (error) {
      console.error('Error cancelling booking:', error);
      alert(error.response?.data?.error || 'Failed to cancel booking. Please try again.');
    } finally {
      setCancelling(null);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      PENDING: {
        icon: FaClock,
        bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
        textColor: 'text-yellow-700 dark:text-yellow-400',
        label: 'Pending'
      },
      PAID: {
        icon: FaCheckCircle,
        bgColor: 'bg-green-100 dark:bg-green-900/30',
        textColor: 'text-green-700 dark:text-green-400',
        label: 'Paid'
      },
      CONFIRMED: {
        icon: FaCheckCircle,
        bgColor: 'bg-blue-100 dark:bg-blue-900/30',
        textColor: 'text-blue-700 dark:text-blue-400',
        label: 'Confirmed'
      },
      COMPLETED: {
        icon: FaCheckCircle,
        bgColor: 'bg-green-100 dark:bg-green-900/30',
        textColor: 'text-green-700 dark:text-green-400',
        label: 'Completed'
      },
      CANCELLED: {
        icon: FaClock,
        bgColor: 'bg-red-100 dark:bg-red-900/30',
        textColor: 'text-red-700 dark:text-red-400',
        label: 'Cancelled'
      }
    };
    const config = statusConfig[status] || statusConfig.PENDING;
    return { ...config, Icon: config.icon };
  };

  const getPaymentMethodLabel = (method) => {
    const methods = { ONLINE: 'Online Payment', ARRIVAL: 'Pay on Arrival' };
    return methods[method] || method;
  };

  const handleSearchHotels = async (e) => {
    e.preventDefault();
    setFiltersActive(true);
    setRoomTypeTouched(true);
    setLoadingHotels(true);
    
    try {
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      
      console.log('🔍 Scraping hotels with params:', {
        destination,
        checkIn,
        checkOut,
        adults: parseInt(adults),
        children: parseInt(children),
        roomType
      });
      
      // Call web scraping API
      const response = await fetch(`http://localhost:8000/api/scraper/scrape-hotels/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          city: destination || 'Lahore',
          checkin: checkIn,
          checkout: checkOut,
          adults: parseInt(adults),
          rooms: 1,
          children: parseInt(children),
          use_cache: true
        })
      });
      
      const data = await response.json();
      
      if (data.success && data.hotels && data.hotels.length > 0) {
        console.log('✅ Scraped hotels:', data.count, 'hotels');
        
        // Transform scraped data to match your hotel format - WITH DYNAMIC AVAILABILITY
        const transformedHotels = data.hotels.map((hotel, index) => {
          // Extract price from hotel data
          const pricePerNight = hotel.price ? parseFloat(hotel.price.replace(/[^0-9.]/g, '')) || 5000 : 5000;
          
          // Generate realistic availability based on hotel rating and price
          const generateAvailability = (rating, basePrice) => {
            // Higher rated/priced hotels tend to have fewer available rooms
            const ratingFactor = parseFloat(rating) || 7.5;
            const priceFactor = basePrice > 15000 ? 0.6 : basePrice > 10000 ? 0.75 : 0.9;
            
            // Total rooms based on hotel tier
            const totalRooms = basePrice > 15000 ? 50 : basePrice > 10000 ? 40 : basePrice > 7000 ? 35 : 30;
            
            // Available rooms: popular hotels (high rating) have less availability
            const availabilityRate = ratingFactor > 8.5 ? 0.5 : ratingFactor > 8.0 ? 0.65 : 0.8;
            const availableRooms = Math.round(totalRooms * availabilityRate * priceFactor);
            
            return { totalRooms, availableRooms };
          };
          
          const { totalRooms, availableRooms } = generateAvailability(hotel.rating, pricePerNight);
          
          // Create multiple room types with varied pricing and availability
          const createRoomTypes = () => {
            const basePrice = pricePerNight;
            const roomAvailability = Math.max(3, Math.floor(availableRooms / 4)); // Distribute availability
            
            return [
              {
                id: `${index}-single`,
                type: 'single',
                price_per_night: Math.round(basePrice * 0.8), // 20% less
                capacity: 1,
                available_rooms: Math.max(2, Math.floor(roomAvailability * 1.2)),
                total_rooms: Math.floor(totalRooms * 0.3),
                description: hotel.amenities?.slice(0, 2).join(', ') || 'Standard amenities',
                amenities: hotel.amenities || []
              },
              {
                id: `${index}-double`,
                type: 'double',
                price_per_night: basePrice,
                capacity: 2,
                available_rooms: roomAvailability,
                total_rooms: Math.floor(totalRooms * 0.4),
                description: hotel.amenities?.slice(0, 3).join(', ') || 'Standard amenities',
                amenities: hotel.amenities || []
              },
              {
                id: `${index}-triple`,
                type: 'triple',
                price_per_night: Math.round(basePrice * 1.3), // 30% more
                capacity: 3,
                available_rooms: Math.max(1, Math.floor(roomAvailability * 0.8)),
                total_rooms: Math.floor(totalRooms * 0.2),
                description: hotel.amenities?.slice(0, 4).join(', ') || 'Standard amenities',
                amenities: hotel.amenities || []
              },
              {
                id: `${index}-quad`,
                type: 'quad',
                price_per_night: Math.round(basePrice * 1.5), // 50% more
                capacity: 4,
                available_rooms: Math.max(1, Math.floor(roomAvailability * 0.6)),
                total_rooms: Math.floor(totalRooms * 0.1),
                description: hotel.amenities?.join(', ') || 'Standard amenities',
                amenities: hotel.amenities || []
              }
            ];
          };
          
          return {
            id: `scraped-${index}`,
            name: hotel.name || 'Hotel',
            hotel_name: hotel.name || 'Hotel', // For booking page compatibility
            city: destination || data.search_params?.city || 'Lahore',
            address: hotel.location || hotel.distance || '',
            location: hotel.location || hotel.distance || '', // For booking page compatibility
            description: `${hotel.amenities?.join(', ') || 'No amenities listed'}`,
            rating: parseFloat(hotel.rating) || 0,
            total_rooms: totalRooms,
            available_rooms: availableRooms,
            room_types: createRoomTypes(),
            image: hotel.image_url || 'https://via.placeholder.com/400x300?text=Hotel',
            scraped_data: hotel,
            review_count: hotel.review_count || '0 reviews',
            distance_from_center: hotel.distance || '',
            check_in_instructions: hotel.check_in_instructions || 'Standard check-in: 2 PM',
            policies: hotel.policies || 'Free cancellation 24 hours before check-in',
            wifi_available: hotel.amenities?.some(a => a.toLowerCase().includes('wifi')) || false,
            parking_available: hotel.amenities?.some(a => a.toLowerCase().includes('parking')) || false,
            // Add pricing fields for booking compatibility
            single_bed_price_per_day: Math.round(pricePerNight * 0.8),
            double_bed_price_per_day: pricePerNight,
            triple_bed_price_per_day: Math.round(pricePerNight * 1.3),
            quad_bed_price_per_day: Math.round(pricePerNight * 1.5),
            is_scraped: true
          };
        });
        
        setHotels(transformedHotels);
        setFilteredHotels(transformedHotels);
        console.log('✅ Hotels displayed successfully');
      } else {
        console.warn('⚠️ No hotels found:', data.message);
        
        // Fallback to database hotels if scraping fails or returns no results
        console.log('📦 Falling back to database hotels...');
        const dbResponse = await hotelAPI.getAllHotels();
        const dbHotels = dbResponse.data || [];
        setHotels(dbHotels);
        const base = applyHotelFilters(dbHotels);
        const finalList = checkIn && checkOut && roomType ? await filterByAvailability(base) : base;
        setFilteredHotels(finalList);
        
        if (data.message) {
          alert(`Scraping info: ${data.message}\n\nShowing available hotels from database.`);
        }
      }
      
    } catch (error) {
      console.error('❌ Error during hotel search:', error);
      
      // Fallback to database on error
      try {
        console.log('📦 Falling back to database hotels due to error...');
        const dbResponse = await hotelAPI.getAllHotels();
        const dbHotels = dbResponse.data || [];
        setHotels(dbHotels);
        const base = applyHotelFilters(dbHotels);
        const finalList = checkIn && checkOut && roomType ? await filterByAvailability(base) : base;
        setFilteredHotels(finalList);
        
        alert('Scraping unavailable. Showing hotels from database.\n\nTip: Make sure Django server is running on port 8000.');
      } catch (dbError) {
        console.error('❌ Database fallback also failed:', dbError);
        setFilteredHotels([]);
        alert('Unable to fetch hotels. Please ensure the backend server is running.');
      }
    } finally {
      setLoadingHotels(false);
    }
  };

  const handleBookRoom = (hotel, roomType) => {
    // If no dates selected, use tomorrow and day after as defaults
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);
    
    const defaultCheckIn = checkIn || tomorrow.toISOString().split('T')[0];
    const defaultCheckOut = checkOut || dayAfter.toISOString().split('T')[0];
    
    // For scraped hotels, pass data directly. For database hotels, use ID route
    if (hotel.is_scraped) {
      navigate('/hotel-booking', {
        state: {
          hotel: hotel,
          roomType: roomType,
          checkIn: defaultCheckIn,
          checkOut: defaultCheckOut,
          adults: adults,
          children: children,
          infants: infants,
        },
      });
    } else {
      navigate(`/hotels/${hotel.id}`, {
        state: {
          roomType,
          checkIn: defaultCheckIn,
          checkOut: defaultCheckOut,
          adults,
          children,
          infants,
        },
      });
    }
  };

  useEffect(() => {
    let isMounted = true;
    const reapply = async () => {
      const base = applyHotelFilters(hotels);
      const finalList = checkIn && checkOut && roomTypeTouched ? await filterByAvailability(base) : base;
      if (isMounted) setFilteredHotels(finalList);
    };
    reapply();
    return () => { isMounted = false; };
  }, [hotels, filtersActive, destination, roomType, roomTypeTouched, checkIn, checkOut]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col transition-colors duration-300">
      <TopNav />
      
      <div className="flex flex-1">
        <Sidebar activeFeature={activeFeature} setActiveFeature={setActiveFeature} />
        
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          {/* Page Header */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
              {activeFeature}
            </h2>
            <p className="text-gray-600 dark:text-gray-400" style={{ fontFamily: 'Inter, sans-serif' }}>
              {features.find(f => f.name === activeFeature)?.description || 'Manage your travel'}
            </p>
          </div>

          {activeFeature === 'Hotels' && (
            <>
              {/* Hotel Search Section */}
              <div className="max-w-5xl">
              {/* Hotel Search Card */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 transition-colors duration-300">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-6" style={{ fontFamily: 'Inter, sans-serif' }}>
                  Search Hotels by City
                </h3>
                
                <form onSubmit={handleSearchHotels} className="space-y-6">
                  {/* Destination */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                      Destination
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FaHotel className="text-gray-400 dark:text-gray-500" />
                      </div>
                      <input
                        type="text"
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                        placeholder="Enter city or hotel name"
                        value={destination}
                        onChange={(e) => {
                          setDestination(e.target.value);
                          setShowSuggestions(true);
                          setFiltersActive(true);
                        }}
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                        style={{ fontFamily: 'Inter, sans-serif' }}
                      />
                    </div>
                    
                    {/* Suggestions Dropdown */}
                    {showSuggestions && destination && (
                      <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                        {suggestions
                          .filter((s) => s.toLowerCase().includes(destination.toLowerCase()))
                          .map((s) => (
                            <div
                              key={s}
                              className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-gray-700 dark:text-gray-300 transition-colors"
                              onMouseDown={() => {
                                setDestination(s);
                                setShowSuggestions(false);
                              }}
                              style={{ fontFamily: 'Inter, sans-serif' }}
                            >
                              {s}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Date Pickers */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                        Check-in Date
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FaCalendarAlt className="text-gray-400 dark:text-gray-500" />
                        </div>
                        <input
                          type="date"
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                          value={checkIn}
                          onChange={(e) => {
                            setCheckIn(e.target.value);
                            setFiltersActive(true);
                          }}
                          style={{ fontFamily: 'Inter, sans-serif' }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                        Check-out Date
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FaCalendarAlt className="text-gray-400 dark:text-gray-500" />
                        </div>
                        <input
                          type="date"
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                          value={checkOut}
                          onChange={(e) => {
                            setCheckOut(e.target.value);
                            setFiltersActive(true);
                          }}
                          style={{ fontFamily: 'Inter, sans-serif' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Passenger Details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                        Adults
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FaUserFriends className="text-gray-400 dark:text-gray-500" />
                        </div>
                        <select
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none appearance-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                          value={adults}
                          onChange={(e) => setAdults(Number(e.target.value))}
                          style={{ fontFamily: 'Inter, sans-serif' }}
                        >
                          {[...Array(10).keys()].slice(1).map((n) => (
                            <option key={n} value={n}>
                              {n} {n === 1 ? 'Adult' : 'Adults'}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                        Children
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FaUserFriends className="text-gray-400 dark:text-gray-500" />
                        </div>
                        <select
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none appearance-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                          value={children}
                          onChange={(e) => setChildren(Number(e.target.value))}
                          style={{ fontFamily: 'Inter, sans-serif' }}
                        >
                          {[...Array(6).keys()].map((n) => (
                            <option key={n} value={n}>
                              {n} {n === 1 ? 'Child' : 'Children'}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                        Infants
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FaUserFriends className="text-gray-400 dark:text-gray-500" />
                        </div>
                        <select
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none appearance-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                          value={infants}
                          onChange={(e) => setInfants(Number(e.target.value))}
                          style={{ fontFamily: 'Inter, sans-serif' }}
                        >
                          {[...Array(4).keys()].map((n) => (
                            <option key={n} value={n}>
                              {n} {n === 1 ? 'Infant' : 'Infants'}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Room Type Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>
                      Room Type
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {roomTypes.map((rt) => (
                        <button
                          key={rt.value}
                          type="button"
                          className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
                            roomType === rt.value
                              ? 'bg-sky-600 dark:bg-sky-500 text-white border-2 border-sky-600 dark:border-sky-500'
                              : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-2 border-gray-300 dark:border-gray-600 hover:border-sky-300 dark:hover:border-sky-500'
                          }`}
                          onClick={() => {
                            setRoomType(rt.value);
                            setRoomTypeTouched(true);
                            setFiltersActive(true);
                          }}
                          style={{ fontFamily: 'Inter, sans-serif' }}
                        >
                          {rt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Search Button */}
                  <div className="pt-4">
                    <button
                      type="submit"
                      className="w-full bg-sky-600 dark:bg-sky-500 text-white py-4 rounded-lg font-semibold hover:bg-sky-700 dark:hover:bg-sky-600 transition-colors flex items-center justify-center gap-2 shadow-sm"
                      style={{ fontFamily: 'Inter, sans-serif' }}
                    >
                      <FaSearch />
                      Search Hotels
                    </button>
                  </div>
                </form>
              </div>

              {/* Hotels List */}
              {loadingHotels || availabilityChecking ? (
                <div className="text-center py-12 mt-8 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-sky-600 mx-auto mb-4"></div>
                  <p className="text-gray-600 dark:text-gray-400 font-semibold mb-2">
                    {loadingHotels ? '🔍 Scraping Hotels from Booking.com...' : 'Checking date availability...'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-500">
                    {loadingHotels ? 'This may take 30-60 seconds. Getting real-time data for you!' : 'Please wait...'}
                  </p>
                </div>
              ) : filteredHotels.length > 0 ? (
                <div className="mt-8">
                  <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
                    Available Hotels ({filteredHotels.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredHotels.map((hotel) => {
                      const roomTypes = hotel.room_types || [];
                      const colors = {
                        single: { bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', btn: 'bg-blue-600 hover:bg-blue-700' },
                        double: { bg: 'bg-green-50 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400', btn: 'bg-green-600 hover:bg-green-700' },
                        triple: { bg: 'bg-orange-50 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400', btn: 'bg-orange-600 hover:bg-orange-700' },
                        quad: { bg: 'bg-yellow-50 dark:bg-yellow-900/30', text: 'text-yellow-600 dark:text-yellow-400', btn: 'bg-yellow-600 hover:bg-yellow-700' },
                        family: { bg: 'bg-purple-50 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400', btn: 'bg-purple-600 hover:bg-purple-700' },
                      };

                      return (
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
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.src = 'https://via.placeholder.com/400x300?text=Hotel+Image';
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-white text-4xl font-bold">
                                {(hotel.name || 'H').charAt(0)}
                              </div>
                            )}
                            {/* Live Data Badge */}
                            {hotel.scraped_data && (
                              <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                                <span>🔴 LIVE</span>
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
                            
                            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-2">
                              <FaMapMarkerAlt className="text-sky-600" />
                              <span className="text-sm">{hotel.city || hotel.address || 'Location'}</span>
                            </div>
                            
                            {/* Review Count & Distance for scraped hotels */}
                            {hotel.scraped_data && (
                              <div className="flex flex-col gap-1 mb-3">
                                {hotel.review_count && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    📝 {hotel.review_count}
                                  </div>
                                )}
                                {hotel.distance_from_center && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    📍 {hotel.distance_from_center}
                                  </div>
                                )}
                                {hotel.check_in_instructions && (
                                  <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                    ℹ️ {hotel.check_in_instructions}
                                  </div>
                                )}
                                {hotel.policies && (
                                  <div className="text-xs text-green-600 dark:text-green-400">
                                    ✓ {hotel.policies}
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {!hotel.scraped_data && (
                              <>
                                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-3">
                                  <FaMapMarkerAlt className="text-sky-600" />
                                  <span className="text-sm">{hotel.city}</span>
                                </div>

                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                                  {hotel.description}
                                </p>
                              </>
                            )}

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
                            </div>

                            {/* Availability */}
                            <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                Available Rooms: <span className="font-semibold text-gray-800 dark:text-white">{hotel.available_rooms}</span> / {hotel.total_rooms}
                              </p>
                            </div>

                            {/* Pricing - Room Types */}
                            {roomTypes.length > 0 ? (
                              <div className="grid grid-cols-2 gap-2 mb-4">
                                {roomTypes.slice(0, 4).map((rt) => {
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
                            {roomTypes.length > 0 ? (
                              <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                  {roomTypes.map((rt) => {
                                    const btnColor = (colors[rt.type] || colors.single).btn;
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
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <button
                                  onClick={() => handleBookRoom(hotel, 'single')}
                                  disabled={hotel.available_rooms === 0}
                                  className="w-full py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                                  title={hotel.available_rooms === 0 ? 'No rooms available' : 'Book now'}
                                >
                                  Book Now
                                </button>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 mt-8 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                  <FaHotel className="text-gray-300 dark:text-gray-600 text-6xl mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400 text-lg mb-2">
                    {destination ? '🔍 No hotels found' : 'Enter search details to find hotels'}
                  </p>
                  {destination && (
                    <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">
                      Try different dates or locations. We're scraping real-time data from Booking.com.
                    </p>
                  )}
                  {!destination && (
                    <div className="max-w-md mx-auto mt-6 text-left bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                      <p className="text-sm text-blue-800 dark:text-blue-300 font-semibold mb-2">💡 Quick Tip:</p>
                      <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
                        <li>• Enter a destination (e.g., Lahore, Karachi)</li>
                        <li>• Select check-in and check-out dates</li>
                        <li>• Choose number of guests and room type</li>
                        <li>• Click "Search Hotels" for real-time results</li>
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>
                        Total Bookings
                      </p>
                      <p className="text-2xl font-bold text-gray-800 dark:text-white" style={{ fontFamily: 'Inter, sans-serif' }}>
                        24
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-sky-50 dark:bg-sky-900/30 rounded-lg flex items-center justify-center">
                      <FaBook className="text-sky-600 dark:text-sky-400 text-xl" />
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>
                        Upcoming Trips
                      </p>
                      <p className="text-2xl font-bold text-gray-800 dark:text-white" style={{ fontFamily: 'Inter, sans-serif' }}>
                        3
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-green-50 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                      <FaPlane className="text-green-600 dark:text-green-400 text-xl" />
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>
                        Destinations
                      </p>
                      <p className="text-2xl font-bold text-gray-800 dark:text-white" style={{ fontFamily: 'Inter, sans-serif' }}>
                        12
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                      <FaGlobeAsia className="text-purple-600 dark:text-purple-400 text-xl" />
                    </div>
                  </div>
                </div>
              </div>
              </div>
            </>
          )}

          {/* Sightseeing Section */}
          {activeFeature === 'Sightseeing' && (
            <div>
              <InteractiveMap />
            </div>
          )}

          {/* Bookings Section */}
          {activeFeature === 'My Bookings' && (
            <div className="max-w-6xl">
              {loadingBookings ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-sky-600 mx-auto mb-4"></div>
                  <p className="text-gray-600 dark:text-gray-400">Loading bookings...</p>
                </div>
              ) : bookings.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 transition-colors duration-300">
                  <div className="text-center py-12">
                    <FaBook className="text-gray-300 dark:text-gray-600 text-6xl mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400 text-lg" style={{ fontFamily: 'Inter, sans-serif' }}>
                      No bookings yet
                    </p>
                    <p className="text-gray-400 dark:text-gray-500 text-sm mt-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                      Your hotel bookings will appear here
                    </p>
                    <div className="mt-6">
                      <button
                        onClick={() => navigate('/hotels')}
                        className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium transition-colors"
                      >
                        Browse Hotels
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {bookings.map((booking) => {
                    if (!booking || !booking.id) return null;
                    const statusCfg = getStatusBadge(booking.status);
                    const StatusIcon = statusCfg.Icon;
                    const nights = booking.number_of_nights || Math.ceil((new Date(booking.check_out) - new Date(booking.check_in)) / (1000*60*60*24));
                    return (
                      <motion.div
                        key={booking.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700"
                      >
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div className="flex items-center gap-4">
                              <div className="w-16 h-16 bg-gradient-to-r from-sky-400 to-blue-500 rounded-lg flex items-center justify-center text-white text-2xl font-bold">
                                {(booking.hotel_details?.name || 'H').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                                  {booking.hotel_details?.name || 'Hotel'}
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  {booking.hotel_details?.city || 'N/A'}
                                </p>
                              </div>
                            </div>
                            <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${statusCfg.bgColor} ${statusCfg.textColor} font-medium`}>
                              <StatusIcon className="text-lg" />
                              <span>{statusCfg.label}</span>
                            </div>
                          </div>
                        </div>

                        <div className="p-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">Room Type</p>
                              <p className="text-lg font-bold text-gray-800 dark:text-white capitalize">{booking.room_type_details?.type || 'N/A'}</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{typeof booking.rooms_booked === 'object' && booking.rooms_booked !== null ? (typeof booking.rooms_booked.rooms_booked === 'number' ? booking.rooms_booked.rooms_booked : 1) : (typeof booking.rooms_booked === 'number' ? booking.rooms_booked : 1)} {(typeof booking.rooms_booked === 'object' && booking.rooms_booked !== null ? (typeof booking.rooms_booked.rooms_booked === 'number' ? booking.rooms_booked.rooms_booked : 1) : (typeof booking.rooms_booked === 'number' ? booking.rooms_booked : 1)) === 1 ? 'room' : 'rooms'}</p>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">Check-in</p>
                              <p className="text-lg font-bold text-gray-800 dark:text-white">{new Date(booking.check_in).toLocaleDateString()}</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{new Date(booking.check_in).toLocaleDateString('en-US', { weekday: 'short' })}</p>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">Check-out</p>
                              <p className="text-lg font-bold text-gray-800 dark:text-white">{new Date(booking.check_out).toLocaleDateString()}</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{new Date(booking.check_out).toLocaleDateString('en-US', { weekday: 'short' })}</p>
                            </div>
                            <div className="p-4 bg-sky-50 dark:bg-sky-900/20 rounded-lg border border-sky-200 dark:border-sky-800">
                              <p className="text-xs font-semibold text-sky-700 dark:text-sky-400 uppercase tracking-wider mb-2">Duration</p>
                              <p className="text-lg font-bold text-sky-700 dark:text-sky-400">{nights} {nights === 1 ? 'night' : 'nights'}</p>
                              {nights > 0 && (
                                <p className="text-sm text-sky-600 dark:text-sky-300 mt-1">PKR {(booking.total_price / nights).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/night</p>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">Payment Method</p>
                              <p className="text-lg font-bold text-gray-800 dark:text-white">{getPaymentMethodLabel(booking.payment_method)}</p>
                              <p className={`text-sm mt-1 ${booking.payment_method === 'ONLINE' ? 'text-blue-600 dark:text-blue-400' : 'text-purple-600 dark:text-purple-400'}`}>{booking.payment_method === 'ONLINE' ? '🔒 Secure' : '💳 At desk'}</p>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">Booking Status</p>
                              <p className="text-lg font-bold text-gray-800 dark:text-white">{booking.status}</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Booked on {new Date(booking.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                            </div>
                            {booking.guest_name && (
                              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">Guest Name</p>
                                <p className="text-lg font-bold text-gray-800 dark:text-white truncate">{booking.guest_name}</p>
                                {booking.guest_email && (<p className="text-sm text-gray-600 dark:text-gray-400 mt-1 truncate">{booking.guest_email}</p>)}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                            <div>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Amount</p>
                              <p className="text-2xl font-bold text-sky-600 dark:text-sky-400">PKR {parseFloat(booking.total_price).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            </div>
                            <div className="flex gap-3">
                              {booking.payment_method === 'ONLINE' && booking.status === 'PENDING' && (
                                <button onClick={() => navigate(`/payment/${booking.id}`, { state: { booking } })} className="px-6 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium transition-colors">Complete Payment</button>
                              )}
                              {booking.status === 'PENDING' && (
                                <button onClick={() => handleCancelBooking(booking.id)} disabled={cancelling === booking.id} className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50">{cancelling === booking.id ? 'Cancelling...' : 'Cancel'}</button>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Smart Packing Checklist Section */}
          {activeFeature === 'Smart Packing Checklist' && (
            <div className="max-w-3xl">
              <PackingChecklistWidget />
            </div>
          )}

          {/* Travel Journal Section */}
          {activeFeature === 'Travel Journal' && (
            <div className="max-w-4xl">
              <TravelJournalWidget />
            </div>
          )}

          {/* SOS Safety Toolkit Section */}
          {activeFeature === 'SOS Safety Toolkit' && (
            <div className="max-w-3xl">
              <SOSToolkitWidget />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;