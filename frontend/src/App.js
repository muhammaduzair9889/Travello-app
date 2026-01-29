import React, { Suspense, lazy, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AnimatePresence } from 'framer-motion';
import ErrorBoundary from './components/ErrorBoundary';
import SplashScreen from './components/SplashScreen';

// Eager loading for critical components
import ThemeToggle from './components/ThemeToggle';
import Landing from './components/Landing';

// Lazy loading for route components
const Login = lazy(() => import('./components/Login'));
const Signup = lazy(() => import('./components/Signup'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const AdminLogin = lazy(() => import('./components/AdminLogin'));
const ChatWidget = lazy(() => import('./components/ChatWidget'));
const HotelsList = lazy(() => import('./components/HotelsList'));
const HotelSearchLahore = lazy(() => import('./components/HotelSearchLahore'));
const HotelResults = lazy(() => import('./components/HotelResults'));
const HotelBooking = lazy(() => import('./components/HotelBooking'));
const HotelDetailPage = lazy(() => import('./components/HotelDetailPage'));
const Payment = lazy(() => import('./components/Payment'));
const PaymentPage = lazy(() => import('./components/PaymentPage'));
const PaymentSuccess = lazy(() => import('./components/PaymentSuccess'));
const PaymentCancel = lazy(() => import('./components/PaymentCancel'));
const MyBookings = lazy(() => import('./components/MyBookings'));
const AdminHotels = lazy(() => import('./components/AdminHotels'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const AdminBookings = lazy(() => import('./components/AdminBookings'));

// Loading component
const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 to-blue-100 dark:from-gray-900 dark:to-gray-800">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-sky-500"></div>
      <p className="mt-4 text-gray-600 dark:text-gray-300 font-medium">Loading...</p>
    </div>
  </div>
);

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [hasShownSplash, setHasShownSplash] = useState(false);

  useEffect(() => {
    // Check if splash has been shown in this session
    const splashShown = sessionStorage.getItem('splashShown');
    if (splashShown) {
      setShowSplash(false);
      setHasShownSplash(true);
    }
  }, []);

  const handleSplashComplete = () => {
    setShowSplash(false);
    setHasShownSplash(true);
    sessionStorage.setItem('splashShown', 'true');
  };

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AnimatePresence mode="wait">
          {showSplash && !hasShownSplash && (
            <SplashScreen onComplete={handleSplashComplete} />
          )}
        </AnimatePresence>
        
        {(!showSplash || hasShownSplash) && (
          <Router>
            <div className="App">
              <ThemeToggle />
              <Suspense fallback={<LoadingSpinner />}>
                <ChatWidget />
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/admin-login" element={<AdminLogin />} />
                  <Route path="/hotels" element={<HotelsList />} />
                  <Route path="/hotels/:id" element={<HotelDetailPage />} />
                  <Route path="/hotels/search-lahore" element={<HotelSearchLahore />} />
                  <Route path="/hotels/results" element={<HotelResults />} />
                  <Route path="/hotel-booking" element={<HotelBooking />} />
                  <Route path="/payment" element={<Payment />} />
                  <Route path="/payment/:bookingId" element={<PaymentPage />} />
                  <Route path="/payment-success" element={<PaymentSuccess />} />
                  <Route path="/payment-cancel" element={<PaymentCancel />} />
                  <Route path="/my-bookings" element={<MyBookings />} />
                  <Route path="/admin/hotels" element={<AdminHotels />} />
                  <Route path="/admin/bookings" element={<AdminBookings />} />
                  <Route path="/admin-dashboard" element={<AdminDashboard />} />
                </Routes>
              </Suspense>
            </div>
          </Router>
        )}
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;