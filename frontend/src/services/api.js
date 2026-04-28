import axios from 'axios';

const API_ROOT = (process.env.REACT_APP_API_URL || process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000')
  .replace(/\/api\/?$/, '');
const API_BASE_URL = `${API_ROOT}/api`;
export const WS_BASE_URL = API_ROOT.replace(/^http/i, 'ws');

// Simple cache implementation
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const getCachedData = (key) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  cache.delete(key);
  return null;
};

const setCachedData = (key, data) => {
  cache.set(key, { data, timestamp: Date.now() });
};

// Debounce helper
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
});

const AUTH_EXEMPT_PATHS = [
  '/auth/signup/',
  '/auth/login/',
  '/auth/admin/login/',
  '/auth/verify-captcha/',
  '/auth/signup-otp/',
  '/auth/verify-signup-otp/',
  '/auth/login-otp/',
  '/auth/verify-login-otp/',
  '/auth/resend-login-otp/',
  '/auth/request-otp/',
  '/auth/verify-password-reset-otp-only/',
  '/auth/verify-password-reset-otp/',
  '/auth/google/login/',
  '/auth/chat/',
];

const isAuthExemptRequest = (config) => {
  const url = config?.url || '';
  return AUTH_EXEMPT_PATHS.some((path) => url.includes(path));
};

// Helper to pick correct token set (user vs admin)
const resolveAuthTokens = () => {
  const isAdmin = localStorage.getItem('isAdmin') === 'true';
  // For user: try access_token first; for admin: try admin_access_token first
  const access = isAdmin 
    ? (localStorage.getItem('admin_access_token') || localStorage.getItem('access_token'))
    : (localStorage.getItem('access_token') || localStorage.getItem('admin_access_token'));
  const refresh = isAdmin 
    ? (localStorage.getItem('admin_refresh_token') || localStorage.getItem('refresh_token'))
    : (localStorage.getItem('refresh_token') || localStorage.getItem('admin_refresh_token'));
  return { access, refresh, isAdmin };
};

// Add token to requests if available
api.interceptors.request.use(
  (config) => {
    const { access } = resolveAuthTokens();
    if (access && !isAuthExemptRequest(config)) {
      config.headers.Authorization = `Bearer ${access}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Better error handling
    if (!error.response) {
      console.error('Network error:', error.message);
      // Provide detailed error information
      if (error.code === 'ECONNABORTED') {
        return Promise.reject({
          message: 'Request timeout. Please try again.',
          status: 'timeout',
          details: {
            apiUrl: API_BASE_URL,
            timestamp: new Date().toISOString(),
          },
        });
      }
      const errorObj = {
        message: error.message || 'Network error. Please check your connection.',
        status: 'network_error',
        details: {
          timeout: error.code === 'ECONNABORTED',
          apiUrl: API_BASE_URL,
          isOffline: !navigator.onLine,
          timestamp: new Date().toISOString()
        }
      };
      console.error('Detailed error:', errorObj);
      return Promise.reject(errorObj);
    }
    
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthExemptRequest(originalRequest)) {
      originalRequest._retry = true;

      const { refresh, isAdmin } = resolveAuthTokens();
      if (refresh) {
        try {
          const response = await axios.post(`${API_BASE_URL}/token/refresh/`, {
            refresh: refresh,
          });

          const { access } = response.data;
          if (isAdmin) {
            localStorage.setItem('admin_access_token', access);
          } else {
            localStorage.setItem('access_token', access);
          }

          originalRequest.headers.Authorization = `Bearer ${access}`;
          return api(originalRequest);
        } catch (refreshError) {
          if (isAdmin) {
            localStorage.removeItem('admin_access_token');
            localStorage.removeItem('admin_refresh_token');
            localStorage.removeItem('isAdmin');
            window.location.href = '/admin-login';
          } else {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            window.location.href = '/login';
          }
        }
      }
    }
    
    // Return more informative error
    return Promise.reject({
      message: error.response?.data?.error || error.response?.data?.detail || 'Request failed',
      status: error.response?.status,
      data: error.response?.data,
      originalError: error
    });
  }
);

export const authAPI = {
  signup: (userData) => api.post('/auth/signup/', userData),
  login: (credentials) => api.post('/auth/login/', credentials),
  adminLogin: (credentials) => api.post('/auth/admin/login/', credentials),
  verifyCaptcha: (token) => api.post('/auth/verify-captcha/', { token }),
  signupOtp: (userData) => api.post('/auth/signup-otp/', userData),
  verifySignupOtp: (payload) => api.post('/auth/verify-signup-otp/', payload),
  loginOtp: (credentials) => api.post('/auth/login-otp/', credentials),
  resendLoginOtp: (payload) => api.post('/auth/resend-login-otp/', payload),
  verifyLoginOtp: (payload) => api.post('/auth/verify-login-otp/', payload),
  requestPasswordResetOtp: (payload) => api.post('/auth/request-otp/', payload),
  verifyPasswordResetOtpOnly: (payload) => api.post('/auth/verify-password-reset-otp-only/', payload),
  resetPasswordWithOtp: (payload) => api.post('/auth/verify-password-reset-otp/', payload),
  changePassword: (payload) => api.post('/auth/change-password/', payload),
  googleLogin: (payload) => api.post('/auth/google/login/', payload),
};

export const chatAPI = {
  sendMessage: (message, sessionId = 'default') => {
    const headers = { 'Content-Type': 'application/json' };
    // Attach auth token if available so backend can create bookings
    const token = localStorage.getItem('access_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return axios.post(
      `${API_BASE_URL}/auth/chat/`,
      { message, session_id: sessionId },
      { headers, timeout: 75000 },
    ).catch(error => {
      console.error('Chat error:', error);
      throw new Error(
        error.response?.data?.error || 'Failed to get response. Please try again.'
      );
    });
  },
};

export const hotelAPI = {
  getAllHotels: async () => {
    const cacheKey = 'hotels_all';
    const cached = getCachedData(cacheKey);
    if (cached) return { data: cached };
    
    const response = await api.get('/hotels/');
    setCachedData(cacheKey, response.data);
    return response;
  },
  getHotelsFresh: async () => {
    // Bypass cache and fetch fresh hotel data (for refresh after bookings)
    cache.delete('hotels_all');
    const response = await api.get('/hotels/');
    setCachedData('hotels_all', response.data);
    return response;
  },
  getHotel: (id) => api.get(`/hotels/${id}/`),
  searchHotels: debounce((query) => api.get(`/hotels/search/?q=${query}`), 300),
  checkAvailability: (payload) => api.post('/hotels/check-availability/', payload),
  createHotel: (hotelData) => {
    cache.delete('hotels_all'); // Invalidate cache
    return api.post('/hotels/', hotelData);
  },
  updateHotel: (id, hotelData) => {
    cache.delete('hotels_all');
    return api.put(`/hotels/${id}/`, hotelData);
  },
  deleteHotel: (id) => {
    cache.delete('hotels_all');
    return api.delete(`/hotels/${id}/`);
  },
};

export const bookingAPI = {
  getAllBookings: () => api.get('/bookings/'),
  getAdminBookings: (params = {}) => api.get('/bookings/admin/', { params }),
  getMyBookings: async () => {
    const cacheKey = 'bookings_my';
    const cached = getCachedData(cacheKey);
    if (cached) return { data: cached };
    
    const response = await api.get('/bookings/my_bookings/');
    setCachedData(cacheKey, response.data);
    return response;
  },
  createBooking: (bookingData) => {
    cache.delete('bookings_my');
    return api.post('/bookings/', bookingData);
  },
  updateBookingStatus: (id, status) => api.patch(`/bookings/${id}/`, { status }),
  cancelBooking: (id, reason = '') => {
    cache.delete('bookings_my');
    return api.post(`/bookings/${id}/cancel/`, { reason });
  },
  markRefund: (id) => {
    return api.post(`/bookings/${id}/mark-refund/`);
  },
  confirmPayment: (bookingId) => {
    cache.delete('bookings_my');
    return api.post(`/bookings/${bookingId}/confirm_payment/`);
  },
  getBooking: (id) => api.get(`/bookings/${id}/`),
  getAnalytics: (params = {}) => api.get('/bookings/analytics/', { params }),
  createScrapedBooking: (bookingData) => {
    cache.delete('bookings_my');
    return api.post('/bookings/scraped/', bookingData);
  },
};

export const paymentAPI = {
  createSession: (bookingId) => api.post('/payments/create-session/', { booking_id: bookingId }),
  getBookingStatus: (bookingId) => api.get(`/payments/booking/${bookingId}/status/`),
  simulate: (payload) => api.post('/payments/simulate/', payload),
  invoice: (bookingId) => api.get(`/payments/booking/${bookingId}/invoice/`, { responseType: 'text' }),
  breakdown: (bookingId) => api.get(`/payments/booking/${bookingId}/breakdown/`),
  sendConfirmation: (bookingId) => api.post(`/payments/booking/${bookingId}/send-confirmation/`),
};

export const recommendationAPI = {
  getRecommendations: (preferences) => api.post('/recommendations/', preferences, { timeout: 120000 }),
  getDefaultRecommendations: () => api.get('/recommendations/', { timeout: 120000 }),
  // AI Recommendation flow
  startSession: () => api.post('/recommendations/start/', {}, { timeout: 15000 }),
  submitAnswer: (sessionId, answer) => api.post('/recommendations/answer/', { session_id: sessionId, answer }, { timeout: 30000 }),
  getStatus: (sessionId) => api.get(`/recommendations/status/${sessionId}/`, { timeout: 10000 }),
  getResults: (sessionId) => api.get(`/recommendations/results/${sessionId}/`, { timeout: 15000 }),
};

export const scraperAPI = {
  /** Enqueue a scrape job — returns immediately with job_id and optional cached hotels */
  scrapeHotels: (payload) => api.post('/scraper/scrape-hotels/', payload),
  /** Lightweight poll for job progress */
  jobStatus: (jobId) => api.get(`/scraper/job-status/${jobId}/`),
  /** Fetch full results when job is COMPLETED */
  jobResults: (jobId) => api.get(`/scraper/results/${jobId}/`),
  /** Supported destinations */
  destinations: () => api.get('/scraper/destinations/'),
  /** Health / diagnostic check */
  test: () => api.post('/scraper/test/'),
};

export const itineraryAPI = {
  list: () => api.get('/itineraries/'),
  generate: (data) => api.post('/itineraries/generate/', data, { timeout: 120000 }),
  update: (id, data) => api.patch(`/itineraries/${id}/`, data),
  email: (id, payload) => api.post(`/itineraries/${id}/email/`, payload),
  regenerateDay: (id, dayIndex) => api.post(`/itineraries/${id}/regenerate-day/`, { day_index: dayIndex }),
  regenerateFull: (id, data) => api.post(`/itineraries/${id}/regenerate-full/`, data),
  replacePlace: (id, dayIndex, itemIndex, replacement) => api.post(`/itineraries/${id}/replace-place/`, { day_index: dayIndex, item_index: itemIndex, replacement }),
  removePlace: (id, dayIndex, itemIndex) => api.post(`/itineraries/${id}/remove-place/`, { day_index: dayIndex, item_index: itemIndex }),
  lockPlace: (id, placeId, locked) => api.post(`/itineraries/${id}/lock-place/`, { place_id: placeId, locked }),
  reorder: (id, data) => api.post(`/itineraries/${id}/reorder/`, data),
};

export const notificationAPI = {
  list: (params) => api.get('/auth/notifications/', { params }),
  unreadCount: () => api.get('/auth/notifications/count/'),
  markRead: (id) => api.post(id ? `/auth/notifications/${id}/read/` : '/auth/notifications/read/'),
  markAllRead: () => api.post('/auth/notifications/read/'),
  deleteOne: (id) => api.delete(`/auth/notifications/${id}/delete/`),
  clearRead: () => api.post('/auth/notifications/clear/'),
};

export const reviewAPI = {
  // CRUD
  list: (params) => api.get('/reviews/', { params }),
  get: (id) => api.get(`/reviews/${id}/`),
  create: (data) => api.post('/reviews/', data),
  update: (id, data) => api.patch(`/reviews/${id}/`, data),
  delete: (id) => api.delete(`/reviews/${id}/`),
  // User's reviews
  myReviews: () => api.get('/reviews/my-reviews/'),
  // Helpful vote toggle
  helpful: (id) => api.post(`/reviews/${id}/helpful/`),
  // Staff reply
  reply: (id, content) => api.post(`/reviews/${id}/reply/`, { content }),
  // Analytics for a hotel
  analytics: (hotelId) => api.get(`/reviews/analytics/${hotelId}/`),
  // Autocorrect
  autocorrect: (text) => api.post('/reviews/autocorrect/', { text }),
  applyCorrections: (text, corrections) => api.post('/reviews/apply-corrections/', { text, corrections }),
  // Check if user can review a booking
  canReview: (bookingId) => api.get(`/reviews/can-review/${bookingId}/`),
  // Bookings eligible for review (auto-completes past bookings server-side)
  reviewableBookings: () => api.get('/reviews/reviewable-bookings/'),
  // Upload review photos to Cloudinary
  uploadPhotos: (files) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('images', file));
    return api.post('/reviews/upload-photos/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const safetyAPI = {
  startSession: (payload = {}) => api.post('/safety/sessions/start/', payload),
  getActiveSession: () => api.get('/safety/sessions/active/'),
  updatePreferences: (sessionKey, payload) => api.post(`/safety/sessions/${sessionKey}/preferences/`, payload),
  pushLocation: (sessionKey, payload) => api.post(`/safety/sessions/${sessionKey}/location/`, payload),
  triggerSOS: (sessionKey, payload = {}) => api.post(`/safety/sessions/${sessionKey}/sos/`, payload),
  acknowledgeSafe: (sessionKey) => api.post(`/safety/sessions/${sessionKey}/ack/`),
  stopSession: (sessionKey) => api.post(`/safety/sessions/${sessionKey}/stop/`),
  timeline: (sessionKey) => api.get(`/safety/sessions/${sessionKey}/timeline/`),
  adminLive: () => api.get('/safety/admin/live/'),
  adminIncidentAction: (incidentId, action) => api.post(`/safety/admin/incidents/${incidentId}/action/`, { action }),
};

export default api;




