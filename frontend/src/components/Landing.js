import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useMemo, memo, useState, useEffect } from 'react';
import { FaPlane, FaMapMarkerAlt, FaCamera, FaGlobe, FaHeart, FaHotel, FaMapMarkedAlt } from 'react-icons/fa';

// Background Image Slider with Pakistani Landmarks
const BackgroundSlider = memo(() => {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const landmarks = useMemo(() => [
    {
      url: 'https://images.unsplash.com/photo-1629234932140-49db511736c5?w=1920&auto=format&fit=crop&q=80',
      name: 'Lahore Fort'
    },
    {
      url: 'https://images.unsplash.com/photo-1622279488067-3a4ca25ce8ff?w=1920&auto=format&fit=crop&q=80',
      name: 'Minar-e-Pakistan'
    },
    {
      url: 'https://images.unsplash.com/photo-1621351089338-8ac55e890845?w=1920&auto=format&fit=crop&q=80',
      name: 'Badshahi Mosque'
    },
    {
      url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&auto=format&fit=crop&q=80',
      name: 'Mountain Peaks'
    },
    {
      url: 'https://images.unsplash.com/photo-1567604130498-6a0dc4fcea1c?w=1920&auto=format&fit=crop&q=80',
      name: 'Faisal Mosque'
    }
  ], []);
  

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % landmarks.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [landmarks.length]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 2, ease: 'easeInOut' }}
          className="absolute inset-0"
        >
          <img
            src={landmarks[currentIndex].url}
            alt={landmarks[currentIndex].name}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        </motion.div>
      </AnimatePresence>
      {/* Gradient overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/50 via-blue-900/40 to-black/60" />
      
      {/* Landmark name indicator - Enhanced visibility */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`name-${currentIndex}`}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.5 }}
          className="absolute bottom-20 sm:bottom-24 right-4 sm:right-8 bg-white/20 backdrop-blur-lg px-4 sm:px-6 py-2 sm:py-3 rounded-full border border-white/30 shadow-lg"
        >
          <div className="flex items-center gap-2 sm:gap-3">
            <FaMapMarkerAlt className="text-rose-400 text-lg sm:text-xl" style={{ filter: 'drop-shadow(0 0 6px rgba(251, 113, 133, 0.8))' }} />
            <p className="text-white text-sm sm:text-base md:text-lg font-semibold" style={{ fontFamily: 'Poppins, sans-serif', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
              {landmarks[currentIndex].name}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>
      
      {/* Slide indicators */}
      <div className="absolute bottom-6 sm:bottom-10 left-1/2 -translate-x-1/2 flex gap-2 sm:gap-3">
        {landmarks.map((landmark, i) => (
          <button
            key={i}
            onClick={() => setCurrentIndex(i)}
            title={landmark.name}
            className={`h-2 sm:h-3 rounded-full transition-all duration-500 ${
              i === currentIndex 
                ? 'bg-white w-8 sm:w-10 shadow-lg' 
                : 'bg-white/40 w-2 sm:w-3 hover:bg-white/70'
            }`}
            style={i === currentIndex ? { boxShadow: '0 0 15px rgba(255,255,255,0.6)' } : {}}
          />
        ))}
      </div>
    </div>
  );
});

BackgroundSlider.displayName = 'BackgroundSlider';

// 3D Globe Component - Memoized for performance
const Globe = memo(() => {
  return null; // Removed for performance
});

Globe.displayName = 'Globe';

// Particle Background Component with subtle neon glow
const ParticleBackground = memo(() => {
  const particles = useMemo(() => 
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      delay: Math.random() * 5,
      size: 2 + Math.random() * 3,
      color: i % 3 === 0 ? '#0ea5e9' : i % 3 === 1 ? '#3b82f6' : '#06b6d4',
    })), []
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full"
          style={{
            left: particle.left,
            top: particle.top,
            width: particle.size,
            height: particle.size,
            backgroundColor: particle.color,
            boxShadow: `0 0 ${particle.size * 3}px ${particle.color}, 0 0 ${particle.size * 6}px ${particle.color}40`,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.3, 0.8, 0.3],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 4 + Math.random() * 2,
            delay: particle.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
});

ParticleBackground.displayName = 'ParticleBackground';

// Floating Navbar Component - Professional design
const FloatingNavbar = memo(() => {
  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      className="fixed top-0 left-0 right-0 z-50 px-3 sm:px-4 md:px-6 py-3 sm:py-4"
    >
      <div className="max-w-7xl mx-auto bg-white/95 backdrop-blur-xl rounded-xl sm:rounded-2xl px-4 sm:px-6 py-2 sm:py-3 flex items-center justify-between shadow-xl border border-sky-100/50">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-sky-500 to-blue-600 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg" style={{ boxShadow: '0 0 15px rgba(14, 165, 233, 0.4)' }}>
            <FaGlobe className="text-base sm:text-xl text-white" />
          </div>
          <span className="text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-sky-600 to-blue-600 bg-clip-text text-transparent" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Travello
          </span>
        </div>
        <div className="hidden md:flex gap-4 lg:gap-6 text-gray-700 font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>
          <a href="#features" className="hover:text-sky-600 transition-colors relative group">
            Features
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-sky-500 transition-all group-hover:w-full" />
          </a>
          <a href="#about" className="hover:text-sky-600 transition-colors relative group">
            About
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-sky-500 transition-all group-hover:w-full" />
          </a>
          <a href="#contact" className="hover:text-sky-600 transition-colors relative group">
            Contact
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-sky-500 transition-all group-hover:w-full" />
          </a>
        </div>
      </div>
    </motion.nav>
  );
});

FloatingNavbar.displayName = 'FloatingNavbar';

// Feature Card Component with subtle neon glow
const FeatureCard = memo(({ icon: Icon, title, description, delay, color }) => {
  const colorMap = {
    sky: { bg: 'bg-sky-500', glow: 'rgba(14, 165, 233, 0.5)' },
    blue: { bg: 'bg-blue-500', glow: 'rgba(59, 130, 246, 0.5)' },
    indigo: { bg: 'bg-indigo-500', glow: 'rgba(99, 102, 241, 0.5)' }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay }}
      whileHover={{
        scale: 1.03,
        y: -8,
        boxShadow: `0 20px 40px ${colorMap[color].glow}`,
      }}
      className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 md:p-8 shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer group border border-sky-100"
    >
      <motion.div
        whileHover={{ scale: 1.1, rotate: 10 }}
        transition={{ duration: 0.3 }}
        className={`w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 ${colorMap[color].bg} rounded-xl sm:rounded-2xl flex items-center justify-center mb-4 sm:mb-5 md:mb-6 shadow-lg`}
        style={{ boxShadow: `0 8px 25px ${colorMap[color].glow}` }}
      >
        <Icon className="text-xl sm:text-2xl md:text-3xl text-white" />
      </motion.div>
      <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 mb-2 sm:mb-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
        {title}
      </h3>
      <p className="text-gray-600 text-sm sm:text-base md:text-lg" style={{ fontFamily: 'Inter, sans-serif' }}>
        {description}
      </p>
    </motion.div>
  );
});

FeatureCard.displayName = 'FeatureCard';

// Animated Travel Icons Component - Professional design
const AnimatedTravelIcons = memo(() => {
  return (
    <div className="relative w-full h-32 sm:h-40 md:h-48 flex items-center justify-center mb-4 sm:mb-6">
      <motion.div
        animate={{ y: [0, -15, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute left-[5%] sm:left-[10%] md:left-[15%] top-[20%]"
      >
        <FaPlane className="text-3xl sm:text-4xl md:text-5xl text-sky-400 drop-shadow-lg" style={{ filter: 'drop-shadow(0 0 10px rgba(56, 189, 248, 0.5))' }} />
      </motion.div>
      
      <motion.div
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="relative"
      >
        <div 
          className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 bg-gradient-to-br from-sky-400 to-blue-600 rounded-full flex items-center justify-center shadow-2xl"
          style={{ boxShadow: '0 0 30px rgba(14, 165, 233, 0.5), 0 0 60px rgba(14, 165, 233, 0.2)' }}
        >
          <FaGlobe className="text-3xl sm:text-4xl md:text-5xl text-white" />
        </div>
      </motion.div>

      <motion.div
        animate={{ y: [0, 15, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute right-[5%] sm:right-[10%] md:right-[15%] top-[20%]"
      >
        <FaCamera className="text-3xl sm:text-4xl md:text-5xl text-amber-400 drop-shadow-lg" style={{ filter: 'drop-shadow(0 0 10px rgba(251, 191, 36, 0.5))' }} />
      </motion.div>

      <motion.div
        animate={{ y: [0, -10, 0], x: [0, 5, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
        className="absolute bottom-0 left-[35%] sm:left-[40%]"
      >
        <FaMapMarkerAlt className="text-2xl sm:text-3xl md:text-4xl text-rose-400" style={{ filter: 'drop-shadow(0 0 8px rgba(251, 113, 133, 0.5))' }} />
      </motion.div>
    </div>
  );
});

AnimatedTravelIcons.displayName = 'AnimatedTravelIcons';

const Landing = () => {
  const navigate = useNavigate();

  const handleGetStarted = () => {
    navigate('/login');
  };

  const handleAdminLogin = () => {
    navigate('/admin-login');
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background Image Slider */}
      <div className="fixed inset-0 z-0">
        <BackgroundSlider />
      </div>
      
      {/* Neon Glow Particles */}
      <ParticleBackground />

      <FloatingNavbar />

      {/* Hero Section */}
      <div className="relative z-10 pt-20 sm:pt-24 md:pt-32 pb-12 sm:pb-16 md:pb-20 px-4 sm:px-6 lg:px-8 min-h-screen flex items-center">
        <div className="max-w-7xl mx-auto w-full">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1 }}
            className="text-center"
          >
            <AnimatedTravelIcons />

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-black mb-3 sm:mb-4 md:mb-6 text-white"
              style={{ 
                fontFamily: 'Poppins, sans-serif',
                textShadow: '0 0 30px rgba(14, 165, 233, 0.5), 0 0 60px rgba(14, 165, 233, 0.3), 0 4px 20px rgba(0, 0, 0, 0.5)'
              }}
            >
              Travello
            </motion.h1>

            <motion.h2
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold text-white mb-3 sm:mb-4 md:mb-6 px-2"
              style={{ fontFamily: 'Poppins, sans-serif', textShadow: '0 2px 20px rgba(0,0,0,0.5)' }}
            >
              Explore Pakistan's Hidden Gems
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.7 }}
              className="text-base sm:text-lg md:text-xl lg:text-2xl text-white/90 max-w-3xl mx-auto leading-relaxed mb-6 sm:mb-8 md:mb-12 px-4"
              style={{ fontFamily: 'Inter, sans-serif', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}
            >
              Discover breathtaking destinations, book luxury hotels, and create unforgettable memories across Pakistan.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.9 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 md:gap-6 px-4"
            >
              <motion.button
                onClick={handleGetStarted}
                whileHover={{ scale: 1.05, y: -3 }}
                whileTap={{ scale: 0.95 }}
                className="w-full sm:w-auto bg-gradient-to-r from-sky-500 to-blue-600 text-white font-bold py-3 sm:py-4 md:py-5 px-8 sm:px-10 md:px-12 rounded-xl sm:rounded-2xl text-base sm:text-lg md:text-xl shadow-2xl hover:from-sky-600 hover:to-blue-700 flex items-center justify-center gap-2 sm:gap-3 group"
                style={{ fontFamily: 'Poppins, sans-serif', boxShadow: '0 0 30px rgba(14, 165, 233, 0.4)' }}
              >
                <FaPlane className="text-lg sm:text-xl md:text-2xl group-hover:translate-x-1 transition-transform" />
                Get Started
              </motion.button>

              <motion.button
                onClick={handleAdminLogin}
                whileHover={{ scale: 1.05, y: -3 }}
                whileTap={{ scale: 0.95 }}
                className="w-full sm:w-auto bg-white/95 backdrop-blur-sm text-sky-600 font-bold py-3 sm:py-4 md:py-5 px-8 sm:px-10 md:px-12 rounded-xl sm:rounded-2xl text-base sm:text-lg md:text-xl shadow-xl border-2 border-white/50 hover:bg-white flex items-center justify-center gap-2 sm:gap-3"
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                <FaGlobe className="text-lg sm:text-xl md:text-2xl" />
                Admin Login
              </motion.button>
            </motion.div>
          </motion.div>
        </div>
      </div>

      <div id="features" className="relative z-10 py-12 sm:py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12 sm:mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-black mb-4 bg-gradient-to-r from-sky-600 to-blue-600 bg-clip-text text-transparent" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Everything You Need
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto" style={{ fontFamily: 'Inter, sans-serif' }}>
              Discover amazing features designed to make your travel planning effortless
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 mb-20">
            <FeatureCard
              icon={FaHotel}
              title="Best Hotels"
              description="Find and book the perfect accommodations for your journey"
              delay={0.2}
              color="sky"
            />
            <FeatureCard
              icon={FaMapMarkedAlt}
              title="Sightseeing Tours"
              description="Explore iconic landmarks and hidden gems with guided tours"
              delay={0.4}
              color="blue"
            />
            <FeatureCard
              icon={FaCamera}
              title="Travel Guides"
              description="Expert recommendations for every destination"
              delay={0.6}
              color="indigo"
            />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mt-32 bg-gradient-to-r from-sky-50 to-blue-50 rounded-3xl p-12 border border-sky-200"
          >
            <div className="grid md:grid-cols-3 gap-8 text-center">
              <div>
                <motion.h3
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="text-6xl font-black bg-gradient-to-r from-sky-600 to-blue-600 bg-clip-text text-transparent mb-3"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  10K+
                </motion.h3>
                <p className="text-xl text-gray-700 font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>
                  Destinations
                </p>
              </div>
              <div>
                <motion.h3
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                  className="text-6xl font-black bg-gradient-to-r from-sky-600 to-blue-600 bg-clip-text text-transparent mb-3"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  50K+
                </motion.h3>
                <p className="text-xl text-gray-700 font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>
                  Happy Travelers
                </p>
              </div>
              <div>
                <motion.h3
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.6 }}
                  className="text-6xl font-black bg-gradient-to-r from-sky-600 to-blue-600 bg-clip-text text-transparent mb-3"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  100K+
                </motion.h3>
                <p className="text-xl text-gray-700 font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>
                  Trips Planned
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <motion.footer
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="relative z-10 bg-gradient-to-b from-sky-50 to-white mt-20 py-12 border-t border-sky-200"
        id="contact"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <FaGlobe className="text-3xl text-sky-500" />
                <h3 className="text-2xl font-bold text-gray-800" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  Travello
                </h3>
              </div>
              <p className="text-gray-600" style={{ fontFamily: 'Inter, sans-serif' }}>
                Your ultimate travel companion for exploring the world
              </p>
            </div>
            <div>
              <h4 className="text-xl font-bold text-gray-800 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Quick Links
              </h4>
              <ul className="space-y-2 text-gray-600" style={{ fontFamily: 'Inter, sans-serif' }}>
                <li><a href="#about" className="hover:text-sky-600 transition-colors">About Us</a></li>
                <li><a href="#features" className="hover:text-sky-600 transition-colors">Features</a></li>
                <li><a href="#contact" className="hover:text-sky-600 transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xl font-bold text-gray-800 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Legal
              </h4>
              <ul className="space-y-2 text-gray-600" style={{ fontFamily: 'Inter, sans-serif' }}>
                <li><a href="#privacy" className="hover:text-sky-600 transition-colors">Privacy Policy</a></li>
                <li><a href="#terms" className="hover:text-sky-600 transition-colors">Terms of Service</a></li>
                <li><a href="#cookies" className="hover:text-sky-600 transition-colors">Cookie Policy</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xl font-bold text-gray-800 mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Connect
              </h4>
              <div className="flex gap-4">
                <motion.a
                  whileHover={{ scale: 1.2, rotate: 360 }}
                  href="#"
                  className="w-10 h-10 bg-sky-500 rounded-full flex items-center justify-center text-white hover:bg-sky-600 shadow-lg"
                >
                  <FaGlobe />
                </motion.a>
                <motion.a
                  whileHover={{ scale: 1.2, rotate: 360 }}
                  href="#"
                  className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white hover:bg-blue-600 shadow-lg"
                >
                  <FaHeart />
                </motion.a>
                <motion.a
                  whileHover={{ scale: 1.2, rotate: 360 }}
                  href="#"
                  className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center text-white hover:bg-indigo-600 shadow-lg"
                >
                  <FaCamera />
                </motion.a>
              </div>
            </div>
          </div>
          <div className="border-t border-sky-200 pt-8 text-center text-gray-600" style={{ fontFamily: 'Inter, sans-serif' }}>
            <p>&copy; 2025 Travello. All rights reserved. Made with ❤️ for travelers worldwide.</p>
          </div>
        </div>
      </motion.footer>
    </div>
  );
};

export default Landing;
