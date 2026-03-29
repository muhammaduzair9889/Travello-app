import { useState, useEffect, useCallback, useMemo } from 'react';

// Custom hook for hotel search
export const useHotelSearch = () => {
  const [hotels, setHotels] = useState([]);
  const [filteredHotels, setFilteredHotels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchHotels = useCallback(async () => {
    setLoading(true);
    try {
      const { hotelAPI } = await import('../services/api');
      const response = await hotelAPI.getAllHotels();
      setHotels(response.data);
      setFilteredHotels(response.data);
    } catch (error) {
      console.error('Error fetching hotels:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const filterHotels = useCallback((query) => {
    if (!query) {
      setFilteredHotels(hotels);
      return;
    }
    
    const lowerQuery = query.toLowerCase();
    const filtered = hotels.filter(hotel => 
      hotel.city?.toLowerCase().includes(lowerQuery) ||
      hotel.location?.toLowerCase().includes(lowerQuery) ||
      hotel.hotel_name?.toLowerCase().includes(lowerQuery)
    );
    setFilteredHotels(filtered);
  }, [hotels]);

  useEffect(() => {
    filterHotels(searchQuery);
  }, [searchQuery, filterHotels]);

  return {
    hotels,
    filteredHotels,
    loading,
    searchQuery,
    setSearchQuery,
    fetchHotels,
  };
};

// Custom hook for bookings
export const useBookings = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const { bookingAPI } = await import('../services/api');
      const response = await bookingAPI.getMyBookings();
      setBookings(response.data);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    bookings,
    loading,
    fetchBookings,
  };
};

// Custom hook for form state
export const useBookingForm = (initialState = {}) => {
  const [formData, setFormData] = useState({
    destination: '',
    checkIn: '',
    checkOut: '',
    adults: 2,
    children: 0,
    infants: 0,
    roomType: 'double',
    ...initialState
  });

  const updateField = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const updateMultipleFields = useCallback((updates) => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  const resetForm = useCallback(() => {
    setFormData({
      destination: '',
      checkIn: '',
      checkOut: '',
      adults: 2,
      children: 0,
      infants: 0,
      roomType: 'double',
      ...initialState
    });
  }, [initialState]);

  return {
    formData,
    updateField,
    updateMultipleFields,
    resetForm,
  };
};
