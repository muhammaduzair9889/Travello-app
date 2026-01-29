import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

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
  timeout: 10000, // 10 second timeout
});

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
    if (access) {
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
    
    if (error.response?.status === 401 && !originalRequest._retry) {
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
  signup: (userData) => api.post('/signup/', userData),
  login: (credentials) => api.post('/login/', credentials),
  adminLogin: (credentials) => api.post('/admin/login/', credentials),
  verifyCaptcha: (token) => api.post('/verify-captcha/', { token }),
};

export const chatAPI = {
  sendMessage: (message) => {
    return axios.post(`${API_BASE_URL}/chat/`, { message }, {
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
};

export const paymentAPI = {
  createSession: (bookingId) => api.post('/payments/create-session/', { booking_id: bookingId }),
  getBookingStatus: (bookingId) => api.get(`/payments/booking/${bookingId}/status/`),
};

export default api;




