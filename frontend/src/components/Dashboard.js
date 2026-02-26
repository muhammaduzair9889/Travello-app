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
import ItineraryPlanner from './ItineraryPlanner';

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
    name: 'AI Itinerary',
    icon: Calendar,
    description: 'Generate and customize a multi-day itinerary.',
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

// Map attractions data - Lahore, Pakistan (Verified GeoHack/Wikipedia Coordinates)
const attractions = [
  // ==================== MUST SEE ATTRACTIONS ====================
  // Historical Landmarks & UNESCO Sites (GeoHack/Wikipedia Verified Coordinates)
  { id: 1, name: 'Badshahi Mosque', lat: 31.588056, lng: 74.309444, category: 'Must See', description: 'Iconic Mughal-era mosque, one of the largest in the world (1673)' },
  { id: 2, name: 'Lahore Fort (Shahi Qila)', lat: 31.588333, lng: 74.315278, category: 'Must See', description: 'UNESCO World Heritage Site with stunning Mughal architecture' },
  { id: 3, name: 'Minar-e-Pakistan', lat: 31.5925, lng: 74.309444, category: 'Must See', description: 'National monument commemorating Pakistan Resolution (1968)' },
  { id: 4, name: 'Lahore Museum', lat: 31.5693, lng: 74.3107, category: 'Must See', description: 'Largest museum in Pakistan with rich cultural artifacts' },
  { id: 5, name: 'Shalimar Gardens', lat: 31.585833, lng: 74.381944, category: 'Must See', description: 'UNESCO World Heritage Mughal garden complex (1641)' },
  { id: 6, name: 'Wazir Khan Mosque', lat: 31.581944, lng: 74.321667, category: 'Must See', description: 'Famous for intricate tile work and calligraphy (1635)' },
  { id: 7, name: 'Data Darbar', lat: 31.5700, lng: 74.3100, category: 'Must See', description: 'Largest Sufi shrine in South Asia - shrine of Data Ganj Bakhsh' },
  { id: 8, name: 'Jahangir\'s Tomb', lat: 31.620556, lng: 74.276944, category: 'Must See', description: 'Tomb of Mughal Emperor Jahangir in Shahdara Bagh (1637)' },
  { id: 9, name: 'Tomb of Allama Iqbal', lat: 31.5883, lng: 74.3100, category: 'Must See', description: 'Mausoleum of Pakistan\'s national poet (1951)' },
  { id: 10, name: 'Lahore Zoo', lat: 31.5573, lng: 74.3287, category: 'Must See', description: 'One of the largest zoos in South Asia (1872)' },
  { id: 11, name: 'Chauburji', lat: 31.5397, lng: 74.3333, category: 'Must See', description: 'Historic Mughal-era gateway monument (1646)' },
  { id: 12, name: 'Hazuri Bagh', lat: 31.5879, lng: 74.3107, category: 'Must See', description: 'Historic garden between Fort and Badshahi Mosque' },
  { id: 13, name: 'Tomb of Nur Jahan', lat: 31.6210, lng: 74.2785, category: 'Must See', description: 'Tomb of Mughal Empress Nur Jahan in Shahdara' },
  { id: 14, name: 'Sheesh Mahal (Mirror Palace)', lat: 31.5880, lng: 74.3155, category: 'Must See', description: 'Palace with stunning mirror work inside Lahore Fort' },
  { id: 15, name: 'Samadhi of Ranjit Singh', lat: 31.5883, lng: 74.3097, category: 'Must See', description: 'Memorial of Sikh ruler Maharaja Ranjit Singh' },
  { id: 16, name: 'Delhi Gate (Old Lahore)', lat: 31.5780, lng: 74.3210, category: 'Must See', description: 'Historic gate of the Walled City' },
  { id: 17, name: 'Roshnai Gate', lat: 31.5870, lng: 74.3113, category: 'Must See', description: 'Gateway connecting old city to Hazuri Bagh' },
  { id: 18, name: 'Lahore High Court', lat: 31.5580, lng: 74.3217, category: 'Must See', description: 'Beautiful colonial-era court building' },
  { id: 19, name: 'Kim\'s Gun (Zamzama)', lat: 31.5692, lng: 74.3105, category: 'Must See', description: 'Historic cannon featured in Kipling\'s novel' },
  { id: 20, name: 'Fakir Khana Museum', lat: 31.5768, lng: 74.3152, category: 'Must See', description: 'Private museum with rare art collection' },
  { id: 21, name: 'Sunehri Masjid (Golden Mosque)', lat: 31.5788, lng: 74.3175, category: 'Must See', description: 'Mosque famous for golden domes' },
  { id: 22, name: 'Masjid Mariyam Zamani', lat: 31.5877, lng: 74.3148, category: 'Must See', description: 'Mosque built by Emperor Jahangir\'s mother' },
  { id: 23, name: 'Moti Masjid (Pearl Mosque)', lat: 31.5880, lng: 74.3152, category: 'Must See', description: 'Small white marble mosque in Lahore Fort' },
  { id: 24, name: 'Anarkali Tomb', lat: 31.5567, lng: 74.3200, category: 'Must See', description: 'Historic tomb in Punjab Archives' },
  { id: 25, name: 'General Post Office', lat: 31.5603, lng: 74.3163, category: 'Must See', description: 'Historic British-era post office building (1887)' },
  
  // NEW MUST SEE ATTRACTIONS (Wikipedia/GeoHack Verified)
  { id: 96, name: 'Grand Jamia Mosque (Bahria Town)', lat: 31.3597, lng: 74.1822, category: 'Must See', description: 'Third largest mosque in the world, Mughal-modern architecture (2015)' },
  { id: 97, name: 'Gurdwara Dera Sahib', lat: 31.5880, lng: 74.3094, category: 'Must See', description: 'Sacred Sikh Gurdwara marking Guru Arjan Dev\'s martyrdom site' },
  { id: 98, name: 'Gurdwara Janam Asthan Guru Ram Das', lat: 31.5798, lng: 74.3183, category: 'Must See', description: 'Birthplace of fourth Sikh Guru Ram Das in Walled City' },
  { id: 99, name: 'Tomb of Asif Khan', lat: 31.6219, lng: 74.2772, category: 'Must See', description: 'Tomb of Mughal general in Shahdara Bagh' },
  { id: 100, name: 'Shahi Hammam (Royal Bath)', lat: 31.5819, lng: 74.3217, category: 'Must See', description: 'Historic Mughal-era royal bathhouse near Wazir Khan Mosque' },
  { id: 101, name: 'Alamgiri Gate (Lahore Fort)', lat: 31.5880, lng: 74.3133, category: 'Must See', description: 'Grand western entrance of Lahore Fort (1674)' },
  { id: 102, name: 'Naulakha Pavilion', lat: 31.5881, lng: 74.3150, category: 'Must See', description: 'Marble pavilion in Lahore Fort, cost nine lakh rupees to build' },
  { id: 103, name: 'Tomb of Dai Anga', lat: 31.5920, lng: 74.3278, category: 'Must See', description: 'Tomb of Shah Jahan\'s wet nurse near Railway Station' },
  { id: 104, name: 'Bibi Pak Daman Shrine', lat: 31.5480, lng: 74.3367, category: 'Must See', description: 'Historic shrine dedicated to female descendants of Prophet' },
  { id: 105, name: 'Shrine of Mian Mir', lat: 31.5422, lng: 74.3522, category: 'Must See', description: 'Tomb of famous Sufi saint who laid Golden Temple foundation' },
  { id: 106, name: 'Madho Lal Hussain Shrine', lat: 31.6050, lng: 74.3650, category: 'Must See', description: 'Shrine of Sufi poet, site of annual Mela Chiraghan festival' },
  { id: 107, name: 'Walled City of Lahore', lat: 31.5820, lng: 74.3175, category: 'Must See', description: 'Historic heart of Lahore with narrow streets and ancient bazaars' },
  { id: 108, name: 'Tomb of Qutb-ud-din Aibak', lat: 31.5625, lng: 74.3097, category: 'Must See', description: 'Tomb of founder of Delhi Sultanate near Anarkali' },
  { id: 109, name: 'Government College University', lat: 31.5622, lng: 74.3258, category: 'Must See', description: 'Historic university with iconic Gothic Revival tower (1864)' },
  { id: 110, name: 'Punjab University Old Campus', lat: 31.5573, lng: 74.3247, category: 'Must See', description: 'Beautiful colonial-era campus with historic architecture' },
  { id: 111, name: 'Aitchison College', lat: 31.5350, lng: 74.3478, category: 'Must See', description: 'Historic boarding school with Indo-Saracenic architecture (1886)' },
  { id: 112, name: 'WAPDA House', lat: 31.5597, lng: 74.3178, category: 'Must See', description: 'Iconic modernist building on The Mall Road' },
  { id: 113, name: 'Lohari Gate', lat: 31.5772, lng: 74.3142, category: 'Must See', description: 'One of the 13 historic gates of Walled City' },
  { id: 114, name: 'Mochi Gate', lat: 31.5848, lng: 74.3185, category: 'Must See', description: 'Historic gate named after cobblers\' market' },
  { id: 115, name: 'Bhatti Gate', lat: 31.5778, lng: 74.3228, category: 'Must See', description: 'Historic gate named after Bhatti Rajputs' },
  { id: 116, name: 'Akbari Gate', lat: 31.5843, lng: 74.3227, category: 'Must See', description: 'Gate leading to Akbari Mandi market area' },
  { id: 117, name: 'Taxali Gate', lat: 31.5850, lng: 74.3125, category: 'Must See', description: 'Ancient gate near the royal mint (Taxal)' },
  { id: 118, name: 'Lahore Railway Station', lat: 31.5917, lng: 74.3267, category: 'Must See', description: 'Historic British-era railway station, architectural landmark (1862)' },
  { id: 119, name: 'Islamic Summit Minar', lat: 31.5950, lng: 74.3092, category: 'Must See', description: 'Monument commemorating 1974 Islamic Summit in Greater Iqbal Park' },
  { id: 120, name: 'Alhamra Arts Council', lat: 31.5593, lng: 74.3308, category: 'Must See', description: 'Cultural complex designed by Nayyar Ali Dada, hosts festivals' },
  
  // ==================== FOOD DESTINATIONS ====================
  // OpenStreetMap Verified Coordinates for Famous Lahore Food Spots
  { id: 26, name: 'Food Street Gawalmandi', lat: 31.571997, lng: 74.318875, category: 'Food', description: 'Famous traditional food street with local delicacies' },
  { id: 27, name: 'MM Alam Road', lat: 31.521359, lng: 74.351589, category: 'Food', description: 'Upscale dining destination with diverse cuisine' },
  { id: 28, name: 'Lakshmi Chowk', lat: 31.567310, lng: 74.324761, category: 'Food', description: 'Iconic food hub for traditional Lahori dishes' },
  { id: 29, name: 'Anarkali Food Street', lat: 31.562481, lng: 74.309333, category: 'Food', description: 'Historic bazaar area with street food' },
  { id: 30, name: 'Fort Road Food Street', lat: 31.587249, lng: 74.311586, category: 'Food', description: 'Rooftop restaurants with fort view' },
  { id: 31, name: 'Butt Karahi (Lakshmi Chowk)', lat: 31.5672, lng: 74.3243, category: 'Food', description: 'Legendary karahi restaurant since 1940s' },
  { id: 32, name: 'Cafe Aylanto', lat: 31.5168757, lng: 74.3518081, category: 'Food', description: 'Premium Italian dining experience' },
  { id: 33, name: 'Cooco\'s Den', lat: 31.5870545, lng: 74.3115511, category: 'Food', description: 'Unique rooftop dining with traditional ambiance' },
  { id: 34, name: 'Bundu Khan (MM Alam)', lat: 31.5213, lng: 74.3512, category: 'Food', description: 'Famous for BBQ and traditional Pakistani food' },
  { id: 35, name: 'Haveli Restaurant', lat: 31.5870129, lng: 74.3114255, category: 'Food', description: 'Rooftop dining overlooking Badshahi Mosque' },
  { id: 36, name: 'Andaaz Restaurant', lat: 31.5871, lng: 74.3112, category: 'Food', description: 'Traditional cuisine with historic views' },
  { id: 37, name: 'Salt\'n Pepper Village', lat: 31.4683, lng: 74.2648, category: 'Food', description: 'Village-themed restaurant chain' },
  { id: 38, name: 'Monal Lahore', lat: 31.5097528, lng: 74.3410388, category: 'Food', description: 'Premium dining with panoramic city views' },
  { id: 39, name: 'Phajja Siri Paye', lat: 31.5852863, lng: 74.3125410, category: 'Food', description: 'Famous for traditional siri paye breakfast' },
  { id: 40, name: 'Bashir Dar-ul-Mahi', lat: 31.5118, lng: 74.3453, category: 'Food', description: 'Legendary fish restaurant since 1950' },
  { id: 41, name: 'Peeru\'s Cafe', lat: 31.4122864, lng: 74.2327037, category: 'Food', description: 'Heritage cafe in an art gallery setting' },
  { id: 42, name: 'Cosa Nostra', lat: 31.4609448, lng: 74.4136984, category: 'Food', description: 'Italian pizzeria with authentic flavors' },
  { id: 43, name: 'Nafees Bakers', lat: 31.5117, lng: 74.3445, category: 'Food', description: 'Traditional sweets and savory items since 1964' },
  { id: 44, name: 'Waris Nihari (Walled City)', lat: 31.5824, lng: 74.3205, category: 'Food', description: 'Famous for authentic Nihari dish' },
  { id: 45, name: 'Yummy 36 Paye', lat: 31.5783, lng: 74.3142, category: 'Food', description: 'Popular late-night paye destination' },
  // Additional Famous Food Points
  { id: 46, name: 'Heera Mandi Food Area', lat: 31.5865, lng: 74.3120, category: 'Food', description: 'Traditional food area near Badshahi Mosque' },
  { id: 47, name: 'Muhammadi Nihari (Anarkali)', lat: 31.5623, lng: 74.3095, category: 'Food', description: 'Famous nihari joint since 1965' },
  { id: 48, name: 'Fazal-e-Haq Paye', lat: 31.5672, lng: 74.3241, category: 'Food', description: 'Popular for breakfast siri paye' },
  { id: 49, name: 'Tayeb Kabab House', lat: 31.5671, lng: 74.3239, category: 'Food', description: 'Famous for seekh kababs and tikka' },
  { id: 50, name: 'Cuckoo\'s Cafe (Liberty)', lat: 31.5113, lng: 74.3447, category: 'Food', description: 'Trendy cafe with fusion food' },
  { id: 51, name: 'Nishat Hotel (Cinema Chowk)', lat: 31.5625, lng: 74.3128, category: 'Food', description: 'Historic halwa puri breakfast spot' },
  { id: 52, name: 'Khalifa Bakers (Mall Road)', lat: 31.5641, lng: 74.3133, category: 'Food', description: 'Famous bakery since 1919' },
  { id: 53, name: 'Haji Sahab Haleem Wala', lat: 31.5624, lng: 74.3097, category: 'Food', description: 'Best haleem in Lahore since decades' },
  { id: 54, name: 'Sadiq Halwa Puri (Iqbal Town)', lat: 31.5201583, lng: 74.2911526, category: 'Food', description: 'Famous breakfast destination' },
  { id: 55, name: 'Arcadian Cafe', lat: 31.5226637, lng: 74.3495417, category: 'Food', description: 'Modern cafe with continental food' },
  { id: 56, name: 'Mughalia Restaurant', lat: 31.5872, lng: 74.3110, category: 'Food', description: 'Traditional Mughlai cuisine near Fort' },
  { id: 57, name: 'Cafe Zouk', lat: 31.5203649, lng: 74.3516633, category: 'Food', description: 'Popular cafe chain with diverse menu' },
  { id: 58, name: 'X2 (MM Alam)', lat: 31.5205, lng: 74.3508, category: 'Food', description: 'Modern restaurant with live music' },
  { id: 59, name: 'Howdy Cafe (Gulberg)', lat: 31.5168, lng: 74.3478, category: 'Food', description: 'American-style burgers and shakes' },
  { id: 60, name: 'Gun Smoke (DHA)', lat: 31.4785, lng: 74.4082, category: 'Food', description: 'Western BBQ and steakhouse' },
  { id: 61, name: 'Zakir Tikka (Model Town)', lat: 31.4750243, lng: 74.3053249, category: 'Food', description: 'Famous tikka boti since 1972' },
  { id: 62, name: 'Fazal-e-Haq Shinwari (GT Road)', lat: 31.5932, lng: 74.3043, category: 'Food', description: 'Authentic Shinwari karahi' },
  { id: 63, name: 'Faisal Broast (Garden Town)', lat: 31.5082751, lng: 74.3232818, category: 'Food', description: 'Famous fried chicken since 1990' },
  { id: 64, name: 'Malik Nihari (Mozang)', lat: 31.5537450, lng: 74.3141492, category: 'Food', description: 'Historic nihari spot' },
  { id: 65, name: 'Sheikh Abdul Ghani Paratha', lat: 31.5672, lng: 74.3245, category: 'Food', description: 'Legendary paratha at Lakshmi Chowk' },
  
  // NEW FOOD DESTINATIONS
  { id: 146, name: 'Monal (Liberty)', lat: 31.5115, lng: 74.3445, category: 'Food', description: 'Upscale Pakistani cuisine with city views' },
  { id: 147, name: 'Ambala Sweets (Mozang)', lat: 31.5540, lng: 74.3142, category: 'Food', description: 'Famous for traditional sweets since 1957' },
  { id: 148, name: 'Gourmet Restaurant', lat: 31.5118, lng: 74.3447, category: 'Food', description: 'Popular bakery and restaurant chain' },
  { id: 149, name: 'Cheezious (Various)', lat: 31.5200, lng: 74.3500, category: 'Food', description: 'Trendy fast food chain famous for cheesy burgers' },
  { id: 150, name: 'Sapphire Cafe', lat: 31.5205, lng: 74.3515, category: 'Food', description: 'Upscale cafe in Gulberg area' },
  { id: 151, name: 'Sichuan Chinese Restaurant', lat: 31.5170, lng: 74.3480, category: 'Food', description: 'Authentic Chinese cuisine' },
  { id: 152, name: 'BBQ Tonight', lat: 31.5212, lng: 74.3508, category: 'Food', description: 'Famous BBQ and grill restaurant' },
  { id: 153, name: 'Yum! Chinese & Thai', lat: 31.4715, lng: 74.4015, category: 'Food', description: 'Pan-Asian cuisine in DHA' },
  { id: 154, name: 'Jammin Java', lat: 31.5118, lng: 74.3452, category: 'Food', description: 'Popular coffee shop and cafe' },
  { id: 155, name: 'English Tea House', lat: 31.5205, lng: 74.3512, category: 'Food', description: 'British-style high tea experience' },
  { id: 156, name: 'Nando\'s (Lahore)', lat: 31.5215, lng: 74.3518, category: 'Food', description: 'Portuguese-style peri peri chicken' },
  { id: 157, name: 'Dera Restaurant', lat: 31.4695, lng: 74.4020, category: 'Food', description: 'Village-themed traditional food in DHA' },
  { id: 158, name: 'Fujiyama (MM Alam)', lat: 31.5210, lng: 74.3514, category: 'Food', description: 'Japanese cuisine and sushi bar' },
  { id: 159, name: 'Lahore Broast', lat: 31.5095, lng: 74.3350, category: 'Food', description: 'Famous fried chicken chain' },
  { id: 160, name: 'Wok n Tok', lat: 31.5168, lng: 74.3475, category: 'Food', description: 'Chinese food with quick service' },
  { id: 161, name: 'Domino\'s Pizza (Lahore)', lat: 31.5118, lng: 74.3445, category: 'Food', description: 'International pizza chain' },
  { id: 162, name: 'Hardee\'s (Lahore)', lat: 31.5160, lng: 74.3460, category: 'Food', description: 'American fast food chain' },
  { id: 163, name: 'KFC (Various)', lat: 31.5158, lng: 74.3475, category: 'Food', description: 'Kentucky Fried Chicken outlets' },
  { id: 164, name: 'McDonald\'s (Various)', lat: 31.5155, lng: 74.3465, category: 'Food', description: 'International fast food chain' },
  { id: 165, name: 'Shaheen Shinwari', lat: 31.5420, lng: 74.3120, category: 'Food', description: 'Authentic Shinwari cuisine and BBQ' },
  
  // ==================== SHOPPING AREAS ====================
  // OpenStreetMap Verified Coordinates
  { id: 66, name: 'Liberty Market', lat: 31.511280, lng: 74.345008, category: 'Shopping', description: 'Popular market for clothes and accessories' },
  { id: 67, name: 'Anarkali Bazaar', lat: 31.562481, lng: 74.309333, category: 'Shopping', description: 'Historic bazaar with traditional items' },
  { id: 68, name: 'Packages Mall', lat: 31.4711831, lng: 74.3560264, category: 'Shopping', description: 'Modern shopping mall with entertainment' },
  { id: 69, name: 'Emporium Mall', lat: 31.4671890, lng: 74.2659803, category: 'Shopping', description: 'Largest mall in Pakistan with luxury brands' },
  { id: 70, name: 'Fortress Stadium', lat: 31.5317842, lng: 74.3660636, category: 'Shopping', description: 'Shopping and entertainment complex' },
  { id: 71, name: 'Pace Shopping Mall', lat: 31.5158879, lng: 74.3520254, category: 'Shopping', description: 'Modern mall in Gulberg area' },
  { id: 72, name: 'Gulberg Main Market', lat: 31.53055, lng: 74.36112, category: 'Shopping', description: 'Central market in Gulberg' },
  { id: 73, name: 'Mall Road', lat: 31.5555364, lng: 74.3321938, category: 'Shopping', description: 'Historic shopping street from colonial era' },
  { id: 74, name: 'Ichra Bazaar', lat: 31.5329591, lng: 74.3183969, category: 'Shopping', description: 'Busy wholesale market for clothes' },
  { id: 75, name: 'Shah Alam Market', lat: 31.5778376, lng: 74.3178981, category: 'Shopping', description: 'Large wholesale cloth market' },
  { id: 76, name: 'Azam Cloth Market', lat: 31.5840475, lng: 74.3208779, category: 'Shopping', description: 'Famous for fabric and textiles' },
  { id: 77, name: 'Urdu Bazaar', lat: 31.5749997, lng: 74.3096226, category: 'Shopping', description: 'Largest book market in Pakistan' },
  { id: 78, name: 'Hall Road Electronics', lat: 31.5640804, lng: 74.3187403, category: 'Shopping', description: 'Electronics and computer market' },
  { id: 79, name: 'Hafeez Centre', lat: 31.5160698, lng: 74.3429861, category: 'Shopping', description: 'IT and electronics shopping hub' },
  { id: 80, name: 'DHA Y Block Market', lat: 31.4673316, lng: 74.4333092, category: 'Shopping', description: 'Upscale market in DHA' },
  
  // NEW SHOPPING LOCATIONS
  { id: 121, name: 'Dolmen Mall (Lahore)', lat: 31.5052, lng: 74.3388, category: 'Shopping', description: 'Premium mall with international brands' },
  { id: 122, name: 'Township Market', lat: 31.5155, lng: 74.2678, category: 'Shopping', description: 'Popular local shopping area in Township' },
  { id: 123, name: 'Akbari Mandi', lat: 31.5843, lng: 74.3227, category: 'Shopping', description: 'Historic wholesale grains and spices market' },
  { id: 124, name: 'Brandreth Road Market', lat: 31.5715, lng: 74.3187, category: 'Shopping', description: 'Famous for hardware and machinery' },
  { id: 125, name: 'Model Town Link Road Market', lat: 31.4850, lng: 74.3210, category: 'Shopping', description: 'Popular shopping strip in Model Town' },
  { id: 126, name: 'DHA Phase 6 CCA', lat: 31.4612, lng: 74.4258, category: 'Shopping', description: 'Modern commercial area in DHA Phase 6' },
  { id: 127, name: 'Tollinton Market', lat: 31.5580, lng: 74.3250, category: 'Shopping', description: 'Historic Victorian-era market building (1864)' },
  { id: 128, name: 'Lahore Expo Centre', lat: 31.4653, lng: 74.3642, category: 'Shopping', description: 'Large exhibition and trade centre' },
  
  // ==================== ADVENTURE & PARKS ====================
  { id: 81, name: 'Jilani Park (Racecourse)', lat: 31.5095, lng: 74.3360, category: 'Adventure', description: 'Large recreational park with lake' },
  { id: 82, name: 'Jallo Park', lat: 31.5717696, lng: 74.4745342, category: 'Adventure', description: 'Wildlife park and recreational forest' },
  { id: 83, name: 'Greater Iqbal Park', lat: 31.5924791, lng: 74.3094765, category: 'Adventure', description: 'Renovated park with fountains and rides' },
  { id: 84, name: 'Lawrence Gardens (Bagh-e-Jinnah)', lat: 31.5523964, lng: 74.3288503, category: 'Adventure', description: 'Historic botanical gardens (1862)' },
  { id: 85, name: 'Sozo Water Park', lat: 31.5813007, lng: 74.4868904, category: 'Adventure', description: 'Water theme park with rides' },
  { id: 86, name: 'Joyland', lat: 31.5323582, lng: 74.3631271, category: 'Adventure', description: 'Popular amusement park' },
  { id: 87, name: 'Model Town Park', lat: 31.4846361, lng: 74.3262319, category: 'Adventure', description: 'Green recreational space' },
  { id: 88, name: 'Gaddafi Stadium', lat: 31.5133615, lng: 74.3334644, category: 'Adventure', description: 'International cricket stadium (27,000 capacity)' },
  { id: 89, name: 'National Hockey Stadium', lat: 31.5111075, lng: 74.3351685, category: 'Adventure', description: 'International hockey venue' },
  { id: 90, name: 'Lahore Gymkhana', lat: 31.5351392, lng: 74.3546905, category: 'Adventure', description: 'Historic sports and social club (1878)' },
  { id: 91, name: 'Safari Park (Wildlife Park)', lat: 31.5746415, lng: 74.4754935, category: 'Adventure', description: 'Safari experience with wildlife' },
  { id: 92, name: 'Lahore Golf Club', lat: 31.4689395, lng: 74.4715513, category: 'Adventure', description: 'Premier golf course' },
  { id: 93, name: 'Royal Palm Golf & Country Club', lat: 31.4665, lng: 74.4245, category: 'Adventure', description: 'Luxury golf resort' },
  { id: 94, name: 'Gulshan-e-Iqbal Park', lat: 31.5139069, lng: 74.2890468, category: 'Adventure', description: 'Neighborhood park with jogging track' },
  { id: 95, name: 'Askari Park', lat: 31.4653340, lng: 74.3801628, category: 'Adventure', description: 'Family-friendly park' },
  
  // NEW ADVENTURE & PARKS LOCATIONS
  { id: 129, name: 'Lahore Canal', lat: 31.5350, lng: 74.3150, category: 'Adventure', description: 'Historic waterway, popular for evening walks during Basant' },
  { id: 130, name: 'Changa Manga Forest', lat: 31.0800, lng: 73.9700, category: 'Adventure', description: 'Largest man-made forest, great for picnics and boating' },
  { id: 131, name: 'Wagah Border', lat: 31.6047, lng: 74.5728, category: 'Adventure', description: 'Famous flag-lowering ceremony, India-Pakistan border' },
  { id: 132, name: 'Punjab Stadium', lat: 31.5148, lng: 74.3353, category: 'Adventure', description: 'Multi-purpose stadium for football and athletics' },
  { id: 133, name: 'Oasis Golf & Aqua Resort', lat: 31.4050, lng: 74.2100, category: 'Adventure', description: 'Golf course with water park and horse riding' },
  { id: 134, name: 'Defence Raya Golf Resort', lat: 31.4480, lng: 74.4580, category: 'Adventure', description: 'Asia\'s premier golf course with luxury facilities' },
  { id: 135, name: 'Lake City Golf Course', lat: 31.4150, lng: 74.1870, category: 'Adventure', description: '9-hole golf course on Raiwind Road' },
  { id: 136, name: 'Allama Iqbal International Airport', lat: 31.5206, lng: 74.4036, category: 'Adventure', description: 'Pakistan\'s third busiest airport, spotting location' },
  { id: 137, name: 'Lahore Orange Line Metro', lat: 31.5200, lng: 74.3400, category: 'Adventure', description: 'Pakistan\'s first metro train system (2020)' },
  { id: 138, name: 'Nasir Bagh', lat: 31.5905, lng: 74.3100, category: 'Adventure', description: 'Historic park near Greater Iqbal Park' },
  { id: 139, name: 'Mochi Bagh', lat: 31.5845, lng: 74.3180, category: 'Adventure', description: 'Historic garden near Walled City' },
  { id: 140, name: 'Lake City Lahore', lat: 31.4150, lng: 74.1750, category: 'Adventure', description: 'Modern planned community with lakes and parks' },
  { id: 141, name: 'Bahria Town Lahore', lat: 31.3597, lng: 74.1800, category: 'Adventure', description: 'Pakistan\'s largest private housing society with parks' },
  { id: 142, name: 'Arfa Software Technology Park', lat: 31.4750, lng: 74.2683, category: 'Adventure', description: 'Iconic IT tower with observation deck' },
  { id: 143, name: 'Heera Mandi (Diamond Market)', lat: 31.5865, lng: 74.3120, category: 'Adventure', description: 'Historic neighborhood near Badshahi Mosque' },
  { id: 144, name: 'Shahdara Bagh', lat: 31.6200, lng: 74.2780, category: 'Adventure', description: 'Historic gardens complex with Mughal tombs' },
  { id: 145, name: 'Baghbanpura', lat: 31.6030, lng: 74.3670, category: 'Adventure', description: 'Historic garden suburb near Shalimar Gardens' },
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
  const progressPercent = (completedCount / checklist.length) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="card p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-accent-100 dark:bg-accent-900/30 rounded-xl flex items-center justify-center">
            <Luggage className="w-6 h-6 text-accent-600 dark:text-accent-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white font-display">Smart Packing Checklist</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{completedCount}/{checklist.length} items packed</p>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="h-2 bg-gray-100 dark:bg-surface-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-accent-500 to-primary-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="space-y-2 mb-6">
        {checklist.map((item) => (
          <motion.div
            key={item.id}
            whileHover={{ scale: 1.01 }}
            className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-surface-800 transition-all cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-surface-700"
            onClick={() => toggleItem(item.id)}
          >
            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
              item.checked 
                ? 'bg-accent-500 border-accent-500' 
                : 'border-gray-300 dark:border-surface-600'
            }`}>
              {item.checked && <FaCheckCircle className="text-white text-sm" />}
            </div>
            <span className={`flex-1 text-sm font-medium ${
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
        className="btn-accent w-full"
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
      className="card p-6"
    >
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex items-center justify-center">
          <Notebook className="w-6 h-6 text-primary-600 dark:text-primary-400" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white font-display">Travel Journal</h3>
      </div>

      <div className="space-y-3 mb-6">
        {journalEntries.map((entry) => (
          <motion.div
            key={entry.id}
            whileHover={{ scale: 1.01 }}
            className="p-4 rounded-xl border border-gray-200 dark:border-surface-700 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-soft transition-all cursor-pointer bg-gray-50/50 dark:bg-surface-800/50"
          >
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{entry.date}</span>
            </div>
            <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1">{entry.title}</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{entry.excerpt}</p>
          </motion.div>
        ))}
      </div>

      <button
        onClick={() => navigate('/journal')}
        className="btn-primary w-full"
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
        className="card p-6"
      >
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-danger-100 dark:bg-danger-900/30 rounded-xl flex items-center justify-center">
            <Shield className="w-6 h-6 text-danger-600 dark:text-danger-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white font-display">SOS Safety Toolkit</h3>
        </div>

        <div className="space-y-2 mb-6">
          {emergencyContacts.map((contact, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-surface-800 border border-gray-100 dark:border-surface-700"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-danger-100 dark:bg-danger-900/30 rounded-lg flex items-center justify-center">
                  <contact.icon className="text-danger-600 dark:text-danger-400" />
                </div>
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{contact.name}</span>
              </div>
              <a
                href={`tel:${contact.number}`}
                className="px-4 py-2 bg-danger-100 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400 rounded-lg font-bold hover:bg-danger-200 dark:hover:bg-danger-900/50 transition-colors"
              >
                {contact.number}
              </a>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setShowTranslateModal(true)}
            className="btn-secondary flex-1"
          >
            <FaLanguage />
            Quick Translate
          </button>
          <button
            onClick={() => alert('🚨 Emergency services will be contacted! Stay calm and provide your location.')}
            className="btn-danger flex-1"
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
              className="bg-white dark:bg-surface-900 rounded-2xl shadow-soft-xl p-6 max-w-md w-full border border-gray-200 dark:border-surface-700"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white font-display">Common Phrases (Spanish)</h3>
                <button
                  onClick={() => setShowTranslateModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-surface-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                {commonPhrases.map((phrase, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-gray-50 dark:bg-surface-800 border border-gray-100 dark:border-surface-700">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{phrase.english}</p>
                    <p className="text-sm text-primary-600 dark:text-primary-400">{phrase.translated}</p>
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
  const [userLocation, setUserLocation] = useState({ lat: 31.5497, lng: 74.3436 });
  const categories = ['All', 'Must See', 'Food', 'Shopping', 'Adventure'];

  // Get user's current location for better navigation
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        () => {
          // Default to Lahore center if geolocation fails
          console.log('Using default Lahore location');
        }
      );
    }
  }, []);

  const filteredAttractions = selectedCategory === 'All'
    ? attractions
    : attractions.filter(a => a.category === selectedCategory);

  // Open Google Maps navigation
  const openGoogleMapsNavigation = (attraction) => {
    const destination = `${attraction.lat},${attraction.lng}`;
    const origin = `${userLocation.lat},${userLocation.lng}`;
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
    window.open(googleMapsUrl, '_blank');
  };

  // Get category color
  const getCategoryColor = (category) => {
    switch (category) {
      case 'Must See':
        return 'text-danger-600 bg-danger-100 dark:bg-danger-900/30 dark:text-danger-400';
      case 'Food':
        return 'text-warning-600 bg-warning-100 dark:bg-warning-900/30 dark:text-warning-400';
      case 'Shopping':
        return 'text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400';
      case 'Adventure':
        return 'text-success-600 bg-success-100 dark:bg-success-900/30 dark:text-success-400';
      default:
        return 'text-primary-600 bg-primary-100 dark:bg-primary-900/30 dark:text-primary-400';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4 }}
      className="card p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-success-100 dark:bg-success-900/30 rounded-xl flex items-center justify-center">
            <MapPin className="w-6 h-6 text-success-600 dark:text-success-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white font-display">Explore Nearby</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{filteredAttractions.length} attractions</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`chip ${
              selectedCategory === category
                ? 'chip-selected'
                : 'chip-default'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="rounded-2xl overflow-hidden h-[500px] border border-gray-200 dark:border-surface-700">
        <MapContainer center={[31.5497, 74.3436]} zoom={12} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {/* User Location */}
          <Marker position={[userLocation.lat, userLocation.lng]}>
            <Popup>
              <div className="text-center p-1">
                <p className="font-semibold text-gray-800">📍 Your Location</p>
                <p className="text-xs text-gray-600">Lahore, Pakistan</p>
              </div>
            </Popup>
          </Marker>

          {/* Attractions */}
          {filteredAttractions.map((attraction) => (
            <Marker key={attraction.id} position={[attraction.lat, attraction.lng]}>
              <Popup>
                <div className="min-w-[200px] p-1">
                  {/* Location Name */}
                  <h4 className="font-bold text-gray-800 text-base mb-1">
                    {attraction.name}
                  </h4>
                  
                  {/* Category Badge */}
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mb-2 ${getCategoryColor(attraction.category)}`}>
                    {attraction.category}
                  </span>
                  
                  {/* Description */}
                  {attraction.description && (
                    <p className="text-xs text-gray-600 mb-3 leading-relaxed">
                      {attraction.description}
                    </p>
                  )}
                  
                  {/* View Navigation Button */}
                  <button
                    onClick={() => openGoogleMapsNavigation(attraction)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <FaMapMarkerAlt className="text-xs" />
                    View Navigation
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="mt-5 flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-danger-500"></span>
          <span className="text-sm text-gray-600 dark:text-gray-400">Must See</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-warning-500"></span>
          <span className="text-sm text-gray-600 dark:text-gray-400">Food</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-purple-500"></span>
          <span className="text-sm text-gray-600 dark:text-gray-400">Shopping</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-success-500"></span>
          <span className="text-sm text-gray-600 dark:text-gray-400">Adventure</span>
        </div>
      </div>
    </motion.div>
  );
};

// Professional Sidebar Component
const Sidebar = ({ activeFeature, setActiveFeature }) => {
  const navigate = useNavigate();
  return (
    <aside className="hidden md:flex flex-col bg-white dark:bg-secondary-950 h-full w-72 border-r border-gray-200 dark:border-secondary-900 transition-colors duration-300">
      {/* Logo Section */}
      <div className="px-6 py-5 border-b border-gray-200 dark:border-secondary-900">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-gradient-to-br from-primary-500 to-accent-500 rounded-xl flex items-center justify-center shadow-soft">
            <FaGlobeAsia className="text-white text-xl" />
          </div>
          <span className="text-xl font-bold text-gray-900 dark:text-white tracking-tight font-display">
            Travello
          </span>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-4 py-6 overflow-y-auto">
        <p className="px-4 mb-3 text-xs font-semibold text-gray-400 dark:text-secondary-400 uppercase tracking-wider">
          Main Menu
        </p>
        <div className="space-y-1">
          {features.map((feature) => {
            const Icon = feature.icon;
            const isActive = activeFeature === feature.name;
            
            return (
              <button
                key={feature.name}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-primary-50 dark:bg-primary-600/20 text-primary-700 dark:text-white border-l-4 border-primary-500 rounded-l-none'
                    : 'text-gray-600 dark:text-secondary-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5'
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
              >
                <Icon className={`text-lg ${isActive ? 'text-primary-500 dark:text-primary-400' : 'text-gray-400 dark:text-secondary-400'}`} />
                <span className="text-sm">{feature.name}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* User Profile Section */}
      <div className="px-4 py-4 border-t border-gray-200 dark:border-secondary-900 bg-gray-50 dark:bg-secondary-900/50">
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 cursor-pointer transition-all duration-200">
          <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-accent-400 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-secondary-700 shadow-soft">
            <FaUser className="text-white text-sm" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              Faizan Khan
            </p>
            <p className="text-xs text-gray-500 dark:text-secondary-400 truncate">
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
  const [showThankYou, setShowThankYou] = useState(false);
  
  const handleSignOut = () => {
    // Show thank you modal first
    setShowThankYou(true);
    
    // After animation, clear tokens and redirect
    setTimeout(() => {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      localStorage.removeItem('admin_access_token');
      localStorage.removeItem('admin_refresh_token');
      localStorage.removeItem('admin');
      navigate('/login');
    }, 3000);
  };

  return (
    <>
      {/* Thank You Modal with 3D Animation */}
      <AnimatePresence>
        {showThankYou && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ 
                scale: 0.3, 
                rotateX: 90, 
                rotateY: -90,
                opacity: 0 
              }}
              animate={{ 
                scale: 1, 
                rotateX: 0, 
                rotateY: 0,
                opacity: 1,
                transition: {
                  type: "spring",
                  damping: 15,
                  stiffness: 100,
                  duration: 0.8
                }
              }}
              exit={{ 
                scale: 0.3, 
                rotateX: -90,
                rotateY: 90,
                opacity: 0,
                transition: { duration: 0.5 }
              }}
              style={{ perspective: 1000 }}
              className="relative bg-gradient-to-br from-primary-500 via-accent-500 to-primary-600 p-1 rounded-3xl shadow-2xl"
            >
              <div className="bg-white dark:bg-gray-900 rounded-3xl px-12 py-10 text-center relative overflow-hidden">
                {/* Animated Background Particles */}
                <motion.div
                  animate={{ 
                    scale: [1, 1.2, 1],
                    rotate: [0, 180, 360]
                  }}
                  transition={{ 
                    duration: 3,
                    repeat: Infinity,
                    ease: "linear"
                  }}
                  className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br from-accent-400/20 to-primary-400/20 rounded-full blur-xl"
                />
                <motion.div
                  animate={{ 
                    scale: [1.2, 1, 1.2],
                    rotate: [360, 180, 0]
                  }}
                  transition={{ 
                    duration: 3,
                    repeat: Infinity,
                    ease: "linear"
                  }}
                  className="absolute -bottom-10 -left-10 w-32 h-32 bg-gradient-to-br from-primary-400/20 to-accent-400/20 rounded-full blur-xl"
                />
                
                {/* 3D Rotating Icon */}
                <motion.div
                  animate={{ 
                    rotateY: [0, 360],
                  }}
                  transition={{ 
                    duration: 2,
                    repeat: Infinity,
                    ease: "linear"
                  }}
                  className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-primary-500 to-accent-500 rounded-2xl flex items-center justify-center shadow-lg"
                  style={{ transformStyle: "preserve-3d" }}
                >
                  <FaGlobeAsia className="text-white text-3xl" />
                </motion.div>
                
                {/* Thank You Text with Animation */}
                <motion.h2
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent mb-3 font-display"
                >
                  Thank You!
                </motion.h2>
                
                <motion.p
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-gray-600 dark:text-gray-300 text-lg mb-4"
                >
                  For using the <span className="font-semibold text-primary-600 dark:text-primary-400">Travello</span> app
                </motion.p>
                
                <motion.p
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className="text-gray-500 dark:text-gray-400 text-sm"
                >
                  Safe travels! See you again soon 🌍
                </motion.p>
                
                {/* Loading Dots */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1 }}
                  className="flex justify-center gap-2 mt-6"
                >
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      animate={{ 
                        y: [0, -8, 0],
                        scale: [1, 1.2, 1]
                      }}
                      transition={{ 
                        duration: 0.6,
                        repeat: Infinity,
                        delay: i * 0.15
                      }}
                      className="w-3 h-3 bg-gradient-to-br from-primary-500 to-accent-500 rounded-full"
                    />
                  ))}
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="w-full bg-white/80 dark:bg-surface-900/80 backdrop-blur-xl shadow-sm border-b border-gray-200/50 dark:border-surface-800/50 flex items-center justify-between px-6 lg:px-8 py-3 transition-all duration-300 sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <button className="p-2.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-800 rounded-xl transition-all duration-200 md:hidden">
            <FaBars className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex w-10 h-10 bg-gradient-to-br from-primary-500 to-accent-500 rounded-xl items-center justify-center shadow-md">
              <FaHotel className="text-white text-lg" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white font-display">
                Dashboard
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
                Welcome back, manage your travel bookings
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Notification Button */}
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="relative p-2.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-800 rounded-xl transition-all duration-200"
          >
            <FaBell className="text-lg" />
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white dark:ring-surface-900 animate-pulse"></span>
          </motion.button>
          
          {/* Divider */}
          <div className="hidden sm:block h-8 w-px bg-gray-200 dark:bg-surface-700"></div>
          
          {/* Sign Out Button - Red Style */}
          <motion.button 
            onClick={handleSignOut}
            whileHover={{ scale: 1.02, boxShadow: "0 4px 20px rgba(239, 68, 68, 0.3)" }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-medium transition-all duration-200 shadow-md hover:shadow-lg"
          >
            <FaSignOutAlt className="text-sm" />
            <span className="hidden sm:inline">Sign Out</span>
          </motion.button>
        </div>
      </header>
    </>
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

  // Fetch bookings on mount for stats
  useEffect(() => {
    fetchBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeFeature === 'Hotels') {
      fetchHotels();
    } else if (activeFeature === 'My Bookings') {
      fetchBookings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      // For scraped hotels, always return true (they're available if they came from Booking.com)
      // For database hotels, check available_rooms
      const matchesDates = hasDateFilter
        ? (hotel.is_scraped || hotel.scraped_data) 
          ? true 
          : Number(hotel.available_rooms ?? hotel.total_rooms ?? 1) > 0
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
        bgColor: 'bg-warning-100 dark:bg-warning-900/30',
        textColor: 'text-warning-700 dark:text-warning-400',
        label: 'Pending'
      },
      PAID: {
        icon: FaCheckCircle,
        bgColor: 'bg-success-100 dark:bg-success-900/30',
        textColor: 'text-success-700 dark:text-success-400',
        label: 'Paid'
      },
      CONFIRMED: {
        icon: FaCheckCircle,
        bgColor: 'bg-primary-100 dark:bg-primary-900/30',
        textColor: 'text-primary-700 dark:text-primary-400',
        label: 'Confirmed'
      },
      COMPLETED: {
        icon: FaCheckCircle,
        bgColor: 'bg-success-100 dark:bg-success-900/30',
        textColor: 'text-success-700 dark:text-success-400',
        label: 'Completed'
      },
      CANCELLED: {
        icon: FaClock,
        bgColor: 'bg-danger-100 dark:bg-danger-900/30',
        textColor: 'text-danger-700 dark:text-danger-400',
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
    
    // Navigate to the new search results page with search parameters
    navigate('/hotels/search-results', {
      state: {
        destination: destination || 'Lahore',
        checkIn: checkIn,
        checkOut: checkOut,
        adults: parseInt(adults),
        children: parseInt(children),
        infants: parseInt(infants),
        roomType: roomType
      }
    });
    
    // Navigation to hotels page handles the search
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotels, filtersActive, destination, roomType, roomTypeTouched, checkIn, checkOut]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-surface-950 flex flex-col transition-colors duration-300">
      <TopNav />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar activeFeature={activeFeature} setActiveFeature={setActiveFeature} />
        
        <main className="flex-1 p-6 lg:p-8 pt-8 lg:pt-10 overflow-y-auto">
          {/* Page Header */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white font-display">
              {activeFeature}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {features.find(f => f.name === activeFeature)?.description || 'Manage your travel'}
            </p>
          </div>

          {activeFeature === 'Hotels' && (
            <>
              {/* Hotel Search Section */}
              <div className="max-w-5xl">
              {/* Hotel Search Card */}
              <div className="bg-white dark:bg-surface-900 rounded-2xl shadow-soft border border-gray-100 dark:border-surface-800 p-6 lg:p-8 transition-colors duration-300">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex items-center justify-center">
                    <FaSearch className="text-primary-600 dark:text-primary-400" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white font-display">
                    Search Hotels by City
                  </h3>
                </div>
                
                <form onSubmit={handleSearchHotels} className="space-y-6">
                  {/* Destination */}
                  <div className="relative">
                    <label className="form-label mb-2">
                      Destination
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <FaHotel className="text-gray-400 dark:text-surface-500" />
                      </div>
                      <input
                        type="text"
                        className="input-with-icon w-full"
                        placeholder="Enter city or hotel name"
                        value={destination}
                        onChange={(e) => {
                          setDestination(e.target.value);
                          setShowSuggestions(true);
                          setFiltersActive(true);
                        }}
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                      />
                    </div>
                    
                    {/* Suggestions Dropdown */}
                    {showSuggestions && destination && (
                      <div className="absolute z-10 w-full mt-2 bg-white dark:bg-surface-800 border border-gray-200 dark:border-surface-700 rounded-xl shadow-soft-lg overflow-hidden">
                        {suggestions
                          .filter((s) => s.toLowerCase().includes(destination.toLowerCase()))
                          .map((s) => (
                            <div
                              key={s}
                              className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-surface-700 cursor-pointer text-gray-700 dark:text-gray-300 transition-colors flex items-center gap-3"
                              onMouseDown={() => {
                                setDestination(s);
                                setShowSuggestions(false);
                              }}
                            >
                              <FaMapMarkerAlt className="text-gray-400" />
                              {s}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Date Pickers */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
                    <div className="form-group">
                      <label className="form-label">
                        Check-in Date
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <FaCalendarAlt className="text-gray-400 dark:text-surface-500" />
                        </div>
                        <input
                          type="date"
                          className="input-with-icon w-full"
                          value={checkIn}
                          onChange={(e) => {
                            setCheckIn(e.target.value);
                            setFiltersActive(true);
                          }}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        Check-out Date
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <FaCalendarAlt className="text-gray-400 dark:text-surface-500" />
                        </div>
                        <input
                          type="date"
                          className="input-with-icon w-full"
                          value={checkOut}
                          onChange={(e) => {
                            setCheckOut(e.target.value);
                            setFiltersActive(true);
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Passenger Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
                    <div className="form-group">
                      <label className="form-label">
                        Adults
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <FaUserFriends className="text-gray-400 dark:text-surface-500" />
                        </div>
                        <select
                          className="input-with-icon w-full appearance-none cursor-pointer"
                          value={adults}
                          onChange={(e) => setAdults(Number(e.target.value))}
                        >
                          {[...Array(10).keys()].slice(1).map((n) => (
                            <option key={n} value={n}>
                              {n} {n === 1 ? 'Adult' : 'Adults'}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        Children
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <FaUserFriends className="text-gray-400 dark:text-surface-500" />
                        </div>
                        <select
                          className="input-with-icon w-full appearance-none cursor-pointer"
                          value={children}
                          onChange={(e) => setChildren(Number(e.target.value))}
                        >
                          {[...Array(6).keys()].map((n) => (
                            <option key={n} value={n}>
                              {n} {n === 1 ? 'Child' : 'Children'}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        Infants
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <FaUserFriends className="text-gray-400 dark:text-surface-500" />
                        </div>
                        <select
                          className="input-with-icon w-full appearance-none cursor-pointer"
                          value={infants}
                          onChange={(e) => setInfants(Number(e.target.value))}
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
                    <label className="form-label mb-3">
                      Room Type
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {roomTypes.map((rt) => (
                        <button
                          key={rt.value}
                          type="button"
                          className={`chip ${
                            roomType === rt.value
                              ? 'chip-selected'
                              : 'chip-default'
                          }`}
                          onClick={() => {
                            setRoomType(rt.value);
                            setRoomTypeTouched(true);
                            setFiltersActive(true);
                          }}
                        >
                          {rt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Search Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      className="btn-accent w-full py-4 text-base"
                    >
                      <FaSearch />
                      Search Hotels
                    </button>
                  </div>
                </form>
              </div>

              {/* Hotels List */}
              {loadingHotels || availabilityChecking ? (
                <div className="text-center py-16 mt-8 bg-white dark:bg-surface-900 rounded-2xl border border-gray-100 dark:border-surface-800 shadow-soft">
                  <div className="animate-spin rounded-full h-14 w-14 border-4 border-primary-200 border-t-primary-600 mx-auto mb-6"></div>
                  <p className="text-gray-700 dark:text-gray-300 font-semibold text-lg mb-2">
                    {loadingHotels ? '🔍 Scraping Hotels from Booking.com...' : 'Checking date availability...'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-500">
                    {loadingHotels ? 'This may take 30-60 seconds. Getting real-time data for you!' : 'Please wait...'}
                  </p>
                </div>
              ) : filteredHotels.length > 0 ? (
                <div className="mt-8">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white font-display">
                      Available Hotels
                    </h3>
                    <span className="badge badge-primary">
                      {filteredHotels.length} found
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredHotels.map((hotel) => {
                      const roomTypes = hotel.room_types || [];
                      const colors = {
                        single: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400', btn: 'bg-blue-600 hover:bg-blue-700' },
                        double: { bg: 'bg-success-50 dark:bg-success-900/20', text: 'text-success-600 dark:text-success-400', btn: 'bg-success-600 hover:bg-success-700' },
                        triple: { bg: 'bg-warning-50 dark:bg-warning-900/20', text: 'text-warning-600 dark:text-warning-400', btn: 'bg-warning-600 hover:bg-warning-700' },
                        quad: { bg: 'bg-accent-50 dark:bg-accent-900/20', text: 'text-accent-600 dark:text-accent-400', btn: 'bg-accent-600 hover:bg-accent-700' },
                        family: { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-600 dark:text-purple-400', btn: 'bg-purple-600 hover:bg-purple-700' },
                      };

                      return (
                        <motion.div
                          key={hotel.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="card-interactive overflow-hidden group"
                        >
                          {/* Hotel Image */}
                          <div className="h-48 bg-gradient-to-br from-primary-400 to-accent-500 relative overflow-hidden">
                            {hotel.image ? (
                              <img
                                src={hotel.image}
                                alt={hotel.name || 'Hotel'}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
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
                              <div className="absolute top-4 left-4 bg-success-500 text-white px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-soft">
                                <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                                LIVE
                              </div>
                            )}
                            {/* Rating Badge */}
                            <div className="absolute top-4 right-4 bg-white/95 dark:bg-surface-800/95 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-soft">
                              <FaStar className="text-warning-500" />
                              <span className="font-bold text-gray-800 dark:text-white text-sm">
                                {Number(hotel.rating ?? 0).toFixed(1)}
                              </span>
                            </div>
                          </div>

                          {/* Hotel Details */}
                          <div className="p-5">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 line-clamp-1">
                              {hotel.name || 'Hotel'}
                            </h3>
                            
                            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-3">
                              <FaMapMarkerAlt className="text-primary-500 flex-shrink-0" />
                              <span className="text-sm truncate">{hotel.city || hotel.address || 'Location'}</span>
                            </div>
                            
                            {/* Review Count & Distance for scraped hotels */}
                            {hotel.scraped_data && (
                              <div className="flex flex-col gap-1.5 mb-4">
                                {hotel.review_count ? (
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    📝 {hotel.review_count}
                                  </div>
                                ) : hotel.rating > 0 ? (
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    ⭐ Rated {hotel.rating.toFixed(1)}/10
                                  </div>
                                ) : null}
                                {hotel.distance_from_center && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    📍 {hotel.distance_from_center}
                                  </div>
                                )}
                                {hotel.check_in_instructions && (
                                  <div className="text-xs text-primary-600 dark:text-primary-400 mt-1">
                                    ℹ️ {hotel.check_in_instructions}
                                  </div>
                                )}
                                {hotel.policies && (
                                  <div className="text-xs text-success-600 dark:text-success-400">
                                    ✓ {hotel.policies}
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {!hotel.scraped_data && (
                              <>
                                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-3">
                                  <FaMapMarkerAlt className="text-primary-500" />
                                  <span className="text-sm">{hotel.city}</span>
                                </div>

                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">
                                  {hotel.description}
                                </p>
                              </>
                            )}

                            {/* Amenities */}
                            <div className="flex flex-wrap gap-3 mb-4">
                              {hotel.wifi_available && (
                                <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                                  <FaWifi className="text-primary-500" />
                                  <span>WiFi</span>
                                </div>
                              )}
                              {hotel.parking_available && (
                                <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                                  <FaParking className="text-primary-500" />
                                  <span>Parking</span>
                                </div>
                              )}
                            </div>

                            {/* Availability - REAL TIME from Booking.com */}
                            <div className={`mb-4 p-3 rounded-xl ${hotel.is_limited ? 'bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800' : 'bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800'}`}>
                              <div className="flex items-center gap-2">
                                {hotel.is_limited ? (
                                  <>
                                    <span className="animate-pulse w-2 h-2 bg-danger-500 rounded-full"></span>
                                    <p className="text-sm font-medium text-danger-600 dark:text-danger-400">
                                      {hotel.rooms_left ? `Only ${hotel.rooms_left} rooms left!` : hotel.availability_status || 'Limited availability'}
                                    </p>
                                  </>
                                ) : (
                                  <>
                                    <span className="w-2 h-2 bg-success-500 rounded-full"></span>
                                    <p className="text-sm font-medium text-success-600 dark:text-success-400">
                                      {hotel.availability_status || 'Available'}
                                    </p>
                                  </>
                                )}
                              </div>
                              {hotel.has_deal && (
                                <p className="text-xs text-primary-600 dark:text-primary-400 mt-1.5">🏷️ {hotel.has_deal}</p>
                              )}
                            </div>

                            {/* Pricing - Room Types */}
                            {roomTypes.length > 0 ? (
                              <div className="grid grid-cols-2 gap-2 mb-4">
                                {roomTypes.slice(0, 4).map((rt) => {
                                  const color = colors[rt.type] || colors.single;
                                  return (
                                    <div key={rt.id} className={`text-center p-3 ${color.bg} rounded-xl`}>
                                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 capitalize font-medium">{rt.type}</p>
                                      <p className={`text-base font-bold ${color.text}`}>
                                        PKR {Number(rt.price_per_night).toLocaleString('en-PK')}
                                      </p>
                                      <p className="text-xs text-gray-400 dark:text-gray-500">per night</p>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="mb-4 p-3 bg-gray-50 dark:bg-surface-800 rounded-xl text-center">
                                <p className="text-xs text-gray-500 dark:text-gray-400">Room types not configured</p>
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
                                        className={`py-2.5 ${btnColor} text-white rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm capitalize hover:shadow-soft`}
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
                                  className="btn-primary w-full"
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
                <div className="text-center py-16 mt-8 bg-white dark:bg-surface-900 rounded-2xl border border-gray-100 dark:border-surface-800 shadow-soft">
                  <div className="w-20 h-20 bg-gray-100 dark:bg-surface-800 rounded-full flex items-center justify-center mx-auto mb-6">
                    <FaHotel className="text-gray-300 dark:text-surface-600 text-3xl" />
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 text-lg font-medium mb-2">
                    {destination ? '🔍 No hotels found' : 'Enter search details to find hotels'}
                  </p>
                  {destination && (
                    <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">
                      Try different dates or locations. We're scraping real-time data from Booking.com.
                    </p>
                  )}
                  {!destination && (
                    <div className="max-w-md mx-auto mt-6 text-left bg-primary-50 dark:bg-primary-900/20 rounded-xl p-5 border border-primary-100 dark:border-primary-800">
                      <p className="text-sm text-primary-800 dark:text-primary-300 font-semibold mb-3">💡 Quick Tip:</p>
                      <ul className="text-sm text-primary-700 dark:text-primary-400 space-y-2">
                        <li className="flex items-start gap-2">
                          <span className="text-primary-500">•</span>
                          Enter a destination (e.g., Lahore, Karachi)
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary-500">•</span>
                          Select check-in and check-out dates
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary-500">•</span>
                          Choose number of guests and room type
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary-500">•</span>
                          Click "Search Hotels" for real-time results
                        </li>
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Quick Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 mt-8">
                <div className="stat-card">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="stat-label mb-1">
                        Total Bookings
                      </p>
                      <p className="stat-value">
                        {bookings.length}
                      </p>
                    </div>
                    <div className="w-14 h-14 bg-primary-100 dark:bg-primary-900/30 rounded-2xl flex items-center justify-center">
                      <FaBook className="text-primary-600 dark:text-primary-400 text-xl" />
                    </div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="stat-label mb-1">
                        Upcoming Trips
                      </p>
                      <p className="stat-value">
                        {bookings.filter(b => b.status === 'CONFIRMED' || b.status === 'PAID').length}
                      </p>
                    </div>
                    <div className="w-14 h-14 bg-success-100 dark:bg-success-900/30 rounded-2xl flex items-center justify-center">
                      <FaPlane className="text-success-600 dark:text-success-400 text-xl" />
                    </div>
                  </div>
                </div>

                <div className="stat-card sm:col-span-2 lg:col-span-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="stat-label mb-1">
                        Hotels Available
                      </p>
                      <p className="stat-value">
                        {filteredHotels.length}
                      </p>
                    </div>
                    <div className="w-14 h-14 bg-accent-100 dark:bg-accent-900/30 rounded-2xl flex items-center justify-center">
                      <FaHotel className="text-accent-600 dark:text-accent-400 text-xl" />
                    </div>
                  </div>
                </div>
              </div>
              </div>
            </>
          )}

          {/* AI Itinerary Section */}
          {activeFeature === 'AI Itinerary' && (
            <div>
              <ItineraryPlanner />
            </div>
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
                <div className="text-center py-16">
                  <div className="animate-spin rounded-full h-14 w-14 border-4 border-primary-200 border-t-primary-600 mx-auto mb-6"></div>
                  <p className="text-gray-500 dark:text-gray-400">Loading bookings...</p>
                </div>
              ) : bookings.length === 0 ? (
                <div className="card p-8">
                  <div className="text-center py-12">
                    <div className="w-20 h-20 bg-gray-100 dark:bg-surface-800 rounded-full flex items-center justify-center mx-auto mb-6">
                      <FaBook className="text-gray-300 dark:text-surface-600 text-3xl" />
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 text-lg font-medium">
                      No bookings yet
                    </p>
                    <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
                      Your hotel bookings will appear here
                    </p>
                    <div className="mt-6">
                      <button
                        onClick={() => navigate('/hotels')}
                        className="btn-primary"
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
                        className="card overflow-hidden"
                      >
                        <div className="p-6 border-b border-gray-100 dark:border-surface-700 bg-gray-50/50 dark:bg-surface-800/50">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div className="flex items-center gap-4">
                              <div className="w-16 h-16 bg-gradient-to-br from-primary-400 to-accent-500 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-soft">
                                {(booking.hotel_details?.name || 'H').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white font-display">
                                  {booking.hotel_details?.name || 'Hotel'}
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  {booking.hotel_details?.city || 'N/A'}
                                </p>
                              </div>
                            </div>
                            <div className={`badge ${statusCfg.bgColor} ${statusCfg.textColor}`}>
                              <StatusIcon className="text-sm" />
                              <span>{statusCfg.label}</span>
                            </div>
                          </div>
                        </div>

                        <div className="p-6">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                            <div className="p-4 bg-gray-50 dark:bg-surface-800 rounded-xl">
                              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Room Type</p>
                              <p className="text-lg font-bold text-gray-900 dark:text-white capitalize">{booking.room_type_details?.type || 'N/A'}</p>
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{typeof booking.rooms_booked === 'object' && booking.rooms_booked !== null ? (typeof booking.rooms_booked.rooms_booked === 'number' ? booking.rooms_booked.rooms_booked : 1) : (typeof booking.rooms_booked === 'number' ? booking.rooms_booked : 1)} {(typeof booking.rooms_booked === 'object' && booking.rooms_booked !== null ? (typeof booking.rooms_booked.rooms_booked === 'number' ? booking.rooms_booked.rooms_booked : 1) : (typeof booking.rooms_booked === 'number' ? booking.rooms_booked : 1)) === 1 ? 'room' : 'rooms'}</p>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-surface-800 rounded-xl">
                              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Check-in</p>
                              <p className="text-lg font-bold text-gray-900 dark:text-white">{new Date(booking.check_in).toLocaleDateString()}</p>
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{new Date(booking.check_in).toLocaleDateString('en-US', { weekday: 'short' })}</p>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-surface-800 rounded-xl">
                              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Check-out</p>
                              <p className="text-lg font-bold text-gray-900 dark:text-white">{new Date(booking.check_out).toLocaleDateString()}</p>
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{new Date(booking.check_out).toLocaleDateString('en-US', { weekday: 'short' })}</p>
                            </div>
                            <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-primary-100 dark:border-primary-800">
                              <p className="text-xs font-semibold text-primary-700 dark:text-primary-400 uppercase tracking-wider mb-2">Duration</p>
                              <p className="text-lg font-bold text-primary-700 dark:text-primary-400">{nights} {nights === 1 ? 'night' : 'nights'}</p>
                              {nights > 0 && (
                                <p className="text-sm text-primary-600 dark:text-primary-300 mt-1">PKR {(booking.total_price / nights).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/night</p>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                            <div className="p-4 bg-gray-50 dark:bg-surface-800 rounded-xl">
                              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Payment Method</p>
                              <p className="text-lg font-bold text-gray-900 dark:text-white">{getPaymentMethodLabel(booking.payment_method)}</p>
                              <p className={`text-sm mt-1 ${booking.payment_method === 'ONLINE' ? 'text-primary-600 dark:text-primary-400' : 'text-accent-600 dark:text-accent-400'}`}>{booking.payment_method === 'ONLINE' ? '🔒 Secure' : '💳 At desk'}</p>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-surface-800 rounded-xl">
                              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Booking Status</p>
                              <p className="text-lg font-bold text-gray-900 dark:text-white">{booking.status}</p>
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Booked on {new Date(booking.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                            </div>
                            {booking.guest_name && (
                              <div className="p-4 bg-gray-50 dark:bg-surface-800 rounded-xl">
                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Guest Name</p>
                                <p className="text-lg font-bold text-gray-900 dark:text-white truncate">{booking.guest_name}</p>
                                {booking.guest_email && (<p className="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">{booking.guest_email}</p>)}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pt-5 border-t border-gray-100 dark:border-surface-700 gap-4">
                            <div>
                              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Amount</p>
                              <p className="text-2xl font-bold text-primary-600 dark:text-primary-400 font-display">PKR {parseFloat(booking.total_price).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            </div>
                            <div className="flex gap-3">
                              {booking.payment_method === 'ONLINE' && booking.status === 'PENDING' && (
                                <button onClick={() => navigate(`/payment/${booking.id}`, { state: { booking } })} className="btn-primary">Complete Payment</button>
                              )}
                              {booking.status === 'PENDING' && (
                                <button onClick={() => handleCancelBooking(booking.id)} disabled={cancelling === booking.id} className="btn-danger">{cancelling === booking.id ? 'Cancelling...' : 'Cancel'}</button>
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