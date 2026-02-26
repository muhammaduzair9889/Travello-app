import axios from 'axios';

const API_ROOT = (process.env.REACT_APP_API_URL || process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000')
  .replace(/\/api\/?$/, '');
const API_BASE_URL = `${API_ROOT}/api`;

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
  '/auth/api/signup-otp/',
  '/auth/api/verify-signup-otp/',
  '/auth/api/login-otp/',
  '/auth/api/verify-login-otp/',
  '/auth/api/resend-login-otp/',
  '/auth/api/request-otp/',
  '/auth/api/verify-password-reset-otp-only/',
  '/auth/api/verify-password-reset-otp/',
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
  signupOtp: (userData) => api.post('/auth/api/signup-otp/', userData),
  verifySignupOtp: (payload) => api.post('/auth/api/verify-signup-otp/', payload),
  loginOtp: (credentials) => api.post('/auth/api/login-otp/', credentials),
  resendLoginOtp: (payload) => api.post('/auth/api/resend-login-otp/', payload),
  verifyLoginOtp: (payload) => api.post('/auth/api/verify-login-otp/', payload),
  requestPasswordResetOtp: (payload) => api.post('/auth/api/request-otp/', payload),
  verifyPasswordResetOtpOnly: (payload) => api.post('/auth/api/verify-password-reset-otp-only/', payload),
  resetPasswordWithOtp: (payload) => api.post('/auth/api/verify-password-reset-otp/', payload),
  googleLogin: (payload) => api.post('/auth/google/login/', payload),
};

export const chatAPI = {
  sendMessage: (message) => {
    return axios.post(`${API_BASE_URL}/auth/chat/`, { message }, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 seconds for AI responses
    }).catch(error => {
      console.error('Chat error:', error);
      throw {
        message: error.response?.data?.error || 'Failed to get response. Please try again.',
        status: error.response?.status || 'error'
      };
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
  cancelBooking: (id) => {
    cache.delete('bookings_my');
    return api.post(`/bookings/${id}/cancel/`);
  },
  confirmPayment: (bookingId) => {
    cache.delete('bookings_my');
    return api.post(`/bookings/${bookingId}/confirm_payment/`);
  },
  getBooking: (id) => api.get(`/bookings/${id}/`),
  createScrapedBooking: (bookingData) => {
    cache.delete('bookings_my');
    return api.post('/bookings/scraped/', bookingData);
  },
};

export const paymentAPI = {
  createSession: (bookingId) => api.post('/payments/create-session/', { booking_id: bookingId }),
  getBookingStatus: (bookingId) => api.get(`/payments/booking/${bookingId}/status/`),
};

export const itineraryAPI = {
  getPlaces: (city = 'Lahore') => api.get('/itineraries/places/', { params: { city } }),
  generate: (payload) => api.post('/itineraries/generate/', payload),
  list: () => api.get('/itineraries/'),
  get: (itineraryId) => api.get(`/itineraries/${itineraryId}/`),
  update: (itineraryId, payload) => api.patch(`/itineraries/${itineraryId}/`, payload),
  regenerateDay: (itineraryId, dayIndex) =>
    api.post(`/itineraries/${itineraryId}/regenerate-day/`, { day_index: dayIndex }),
  replacePlace: (itineraryId, dayIndex, itemIndex, newPlaceId = null) =>
    api.post(`/itineraries/${itineraryId}/replace-place/`, {
      day_index: dayIndex,
      item_index: itemIndex,
      new_place_id: newPlaceId,
    }),
  removePlace: (itineraryId, dayIndex, itemIndex) =>
    api.post(`/itineraries/${itineraryId}/remove-place/`, { day_index: dayIndex, item_index: itemIndex }),
};

export default api;




