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

// Add token to requests if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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
      return Promise.reject({
        message: 'Network error. Please check your connection.',
        status: 'network_error'
      });
    }
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE_URL}/token/refresh/`, {
            refresh: refreshToken,
          });
          
          const { access } = response.data;
          localStorage.setItem('access_token', access);
          
          originalRequest.headers.Authorization = `Bearer ${access}`;
          return api(originalRequest);
        } catch (refreshError) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
      }
    }
    
    return Promise.reject(error);
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
  confirmPayment: (bookingId) => {
    cache.delete('bookings_my');
    return api.post(`/bookings/${bookingId}/confirm_payment/`);
  },
  getBooking: (id) => api.get(`/bookings/${id}/`),
};

export default api;




