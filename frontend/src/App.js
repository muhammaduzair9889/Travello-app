import React, { Suspense, lazy, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
const VerifySignupOtp = lazy(() => import('./components/VerifySignupOtp'));
const VerifyLoginOtp = lazy(() => import('./components/VerifyLoginOtp'));
const ForgotPassword = lazy(() => import('./components/ForgotPassword'));
const VerifyResetOtp = lazy(() => import('./components/VerifyResetOtp'));
const ResetPassword = lazy(() => import('./components/ResetPassword'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const AdminLogin = lazy(() => import('./components/AdminLogin'));
const ChatWidget = lazy(() => import('./components/ChatWidget'));
const HotelSearchLahore = lazy(() => import('./components/HotelSearchLahore'));
const HotelResults = lazy(() => import('./components/HotelResults'));
const HotelSearchResults = lazy(() => import('./components/HotelSearchResults'));
const HotelBooking = lazy(() => import('./components/HotelBooking'));
const HotelDetailsPage = lazy(() => import('./components/HotelDetailsPage'));
const Payment = lazy(() => import('./components/Payment'));
const PaymentPage = lazy(() => import('./components/PaymentPage'));
const PaymentSuccess = lazy(() => import('./components/PaymentSuccess'));
const PaymentCancel = lazy(() => import('./components/PaymentCancel'));
const MyBookings = lazy(() => import('./components/MyBookings'));
const BookingDetails = lazy(() => import('./components/BookingDetails'));
const AdminHotels = lazy(() => import('./components/AdminHotels'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const AdminBookings = lazy(() => import('./components/AdminBookings'));
const TravelJournal = lazy(() => import('./components/TravelJournal'));
const ItineraryPlanner = lazy(() => import('./components/ItineraryPlanner'));
const ReviewForm = lazy(() => import('./components/ReviewForm'));
const ReviewsPage = lazy(() => import('./components/ReviewsPage'));
const MyReviews = lazy(() => import('./components/MyReviews'));

// Loading component
const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 to-blue-100 dark:from-gray-900 dark:to-gray-800">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-sky-500"></div>
      <p className="mt-4 text-gray-600 dark:text-gray-300 font-medium">Loading...</p>
    </div>
  </div>
);

/* ── Route guards ─────────────────────────────────────────────────────────── */

/** Redirects to /login when no valid user token exists. */
function ProtectedRoute({ children }) {
  const location = useLocation();
  const token = localStorage.getItem('access_token');
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}

/** Redirects to /admin-login when no valid admin token exists. */
function AdminRoute({ children }) {
  const location = useLocation();
  const isAdmin = localStorage.getItem('isAdmin') === 'true';
  const token = localStorage.getItem('admin_access_token') || localStorage.getItem('access_token');
  if (!isAdmin || !token) {
    return <Navigate to="/admin-login" state={{ from: location }} replace />;
  }
  return children;
}

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [hasShownSplash, setHasShownSplash] = useState(false);

  useEffect(() => {
    // Handle chunk loading errors
    const handleChunkError = (event) => {
      if (/Loading chunk \d+ failed/g.test(event.message) || /ChunkLoadError/g.test(event.message)) {
        window.location.reload();
      }
    };

    window.addEventListener('error', handleChunkError);
    return () => window.removeEventListener('error', handleChunkError);
  }, []);

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
                  {/* ── Public routes ── */}
                  <Route path="/" element={<Landing />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/verify-signup-otp" element={<VerifySignupOtp />} />
                  <Route path="/verify-login-otp" element={<VerifyLoginOtp />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/verify-reset-otp" element={<VerifyResetOtp />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/admin-login" element={<AdminLogin />} />
                  <Route path="/hotels/search-lahore" element={<HotelSearchLahore />} />
                  <Route path="/hotels/results" element={<HotelResults />} />
                  <Route path="/hotels/search-results" element={<HotelSearchResults />} />
                  <Route path="/hotel-details" element={<HotelDetailsPage />} />
                  <Route path="/reviews" element={<ReviewsPage />} />
                  <Route path="/payment-success" element={<PaymentSuccess />} />
                  <Route path="/payment-cancel" element={<PaymentCancel />} />

                  {/* ── User protected routes ── */}
                  <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/hotel-booking" element={<ProtectedRoute><HotelBooking /></ProtectedRoute>} />
                  <Route path="/payment" element={<ProtectedRoute><Payment /></ProtectedRoute>} />
                  <Route path="/payment/:bookingId" element={<ProtectedRoute><PaymentPage /></ProtectedRoute>} />
                  <Route path="/my-bookings" element={<ProtectedRoute><MyBookings /></ProtectedRoute>} />
                  <Route path="/booking/:id" element={<ProtectedRoute><BookingDetails /></ProtectedRoute>} />
                  <Route path="/journal" element={<ProtectedRoute><TravelJournal /></ProtectedRoute>} />
                  <Route path="/itinerary" element={<ProtectedRoute><ItineraryPlanner /></ProtectedRoute>} />
                  <Route path="/my-reviews" element={<ProtectedRoute><MyReviews /></ProtectedRoute>} />
                  <Route path="/write-review" element={<ProtectedRoute><ReviewForm /></ProtectedRoute>} />

                  {/* ── Admin protected routes ── */}
                  <Route path="/admin/hotels" element={<AdminRoute><AdminHotels /></AdminRoute>} />
                  <Route path="/admin/bookings" element={<AdminRoute><AdminBookings /></AdminRoute>} />
                  <Route path="/admin-dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
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