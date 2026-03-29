import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaCalendarAlt, FaUsers, FaBed } from 'react-icons/fa';
import { bookingAPI } from '../services/api';

const HotelBooking = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { hotel, roomType, checkIn, checkOut, adults: initialAdults = 2, children: initialChildren = 0 } = location.state || {};

  // Get initial rooms from hotel.roomsSelected if available
  const initialRooms = hotel?.roomsSelected || 1;

  const [formData, setFormData] = useState({
    rooms: initialRooms,
    checkInDate: checkIn || '',
    checkOutDate: checkOut || '',
  });

  const [guestInfo, setGuestInfo] = useState({
    leadName: '',
    leadDob: '',
    phone: '',
    email: '',
  });
  const [paxDetails, setPaxDetails] = useState([]);
  const [formError, setFormError] = useState('');

  const [loading, setLoading] = useState(false);

  const adultsCount = Math.max(1, Number(initialAdults) || 1);
  const childrenCount = Math.max(0, Number(initialChildren) || 0);
  const totalGuests = adultsCount + childrenCount;

  useEffect(() => {
    const nextPax = [];

    for (let i = 0; i < adultsCount; i++) {
      nextPax.push({
        id: `adult-${i + 1}`,
        type: 'adult',
        label: i === 0 ? 'Adult 1 (Lead Passenger)' : `Adult ${i + 1}`,
        fullName: '',
      });
    }

    for (let i = 0; i < childrenCount; i++) {
      nextPax.push({
        id: `child-${i + 1}`,
        type: 'child',
        label: `Child ${i + 1}`,
        fullName: '',
      });
    }

    setPaxDetails((prev) =>
      nextPax.map((item) => {
        const existing = prev.find((p) => p.id === item.id);
        return existing ? { ...item, fullName: existing.fullName } : item;
      })
    );
  }, [adultsCount, childrenCount]);

  const numberOfDays = useMemo(() => {
    if (!formData.checkInDate || !formData.checkOutDate) return 0;
    return Math.ceil((new Date(formData.checkOutDate) - new Date(formData.checkInDate)) / (1000 * 60 * 60 * 24));
  }, [formData.checkInDate, formData.checkOutDate]);

  if (!hotel || !roomType) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">No hotel selected</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-3 bg-sky-600 text-white rounded-lg"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const getPricePerDay = () => {
    // If we have a selectedRoom with pricePerNight, use that
    if (hotel.selectedRoom?.pricePerNight) {
      return hotel.selectedRoom.pricePerNight;
    }
    
    switch(roomType) {
      case 'single':
        return parseFloat(hotel.single_bed_price_per_day);
      case 'double':
        return parseFloat(hotel.double_bed_price_per_day || hotel.single_bed_price_per_day * 1.4);
      case 'triple':
        return parseFloat(hotel.triple_bed_price_per_day || hotel.single_bed_price_per_day * 1.6);
      case 'quad':
        return parseFloat(hotel.quad_bed_price_per_day || hotel.single_bed_price_per_day * 1.7);
      case 'family':
        return parseFloat(hotel.family_room_price_per_day);
      default:
        return parseFloat(hotel.single_bed_price_per_day || hotel.double_bed_price_per_day || 5000);
    }
  };

  const pricePerDay = getPricePerDay();

  const calculateTotalPrice = () => {
    if (!formData.checkInDate || !formData.checkOutDate) return 0;
    
    const checkIn = new Date(formData.checkInDate);
    const checkOut = new Date(formData.checkOutDate);
    const days = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
    
    if (days <= 0) return 0;
    
    return days * pricePerDay * formData.rooms;
  };

  const totalPrice = calculateTotalPrice();

  const validateGuestForm = () => {
    if (!guestInfo.leadName.trim()) {
      return 'Please enter lead passenger full name.';
    }

    if (!guestInfo.leadDob) {
      return 'Please enter lead passenger date of birth.';
    }

    if (!guestInfo.phone.trim() && !guestInfo.email.trim()) {
      return 'Please provide at least phone number or email.';
    }

    if (guestInfo.email.trim() && !/^\S+@\S+\.\S+$/.test(guestInfo.email.trim())) {
      return 'Please enter a valid email address.';
    }

    const missingNames = paxDetails.some((p) => !p.fullName.trim());
    if (missingNames) {
      return 'Please enter all passenger names.';
    }

    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    
    if (!formData.checkInDate || !formData.checkOutDate) {
      alert('Please select check-in and check-out dates');
      return;
    }

    if (new Date(formData.checkOutDate) <= new Date(formData.checkInDate)) {
      alert('Check-out date must be after check-in date');
      return;
    }

    if (!hotel.is_scraped && formData.rooms > (hotel.available_rooms || 10)) {
      alert(`Only ${hotel.available_rooms || 10} rooms available`);
      return;
    }

    const guestValidationError = validateGuestForm();
    if (guestValidationError) {
      setFormError(guestValidationError);
      return;
    }

    setLoading(true);

    try {
      let bookingId;

      const leadPassengerName = guestInfo.leadName.trim();
      const leadPassengerEmail = guestInfo.email.trim();
      const leadPassengerPhone = guestInfo.phone.trim();
      const serializedGuestDetails = JSON.stringify({
        lead_pax: {
          name: leadPassengerName,
          dob: guestInfo.leadDob,
          phone: leadPassengerPhone || null,
          email: leadPassengerEmail || null,
        },
        passengers: paxDetails.map((p) => ({
          type: p.type,
          name: p.fullName.trim(),
        })),
        adults: adultsCount,
        children: childrenCount,
      });

      if (hotel.is_scraped) {
        // For scraped hotels, create hotel + booking via dedicated endpoint
        const scrapedData = {
          hotel_name: hotel.name || hotel.hotel_name,
          city: hotel.city || 'Lahore',
          location: hotel.location || hotel.address || '',
          description: hotel.description || '',
          image: hotel.image || '',
          rating: hotel.rating || 0,
          room_type: roomType,
          room_name: hotel.selectedRoom?.name || roomType,
          price_per_night: pricePerDay,
          check_in: formData.checkInDate,
          check_out: formData.checkOutDate,
          rooms_booked: formData.rooms,
          adults: adultsCount,
          children: childrenCount,
          guest_name: leadPassengerName,
          guest_email: leadPassengerEmail,
          guest_phone: leadPassengerPhone,
          special_requests: serializedGuestDetails,
        };

        const response = await bookingAPI.createScrapedBooking(scrapedData);
        bookingId = response.data.booking_id || response.data.booking?.id;
      } else {
        // For database hotels, proceed with normal API call
        const bookingData = {
          hotel: hotel.id,
          room_type: roomType,
          rooms_booked: formData.rooms,
          adults: adultsCount,
          children: childrenCount,
          check_in: formData.checkInDate,
          check_out: formData.checkOutDate,
          check_in_date: formData.checkInDate,
          check_out_date: formData.checkOutDate,
          total_price: totalPrice,
          payment_method: 'ONLINE',
          guest_name: leadPassengerName,
          guest_email: leadPassengerEmail,
          guest_phone: leadPassengerPhone,
          special_requests: serializedGuestDetails,
        };

        const response = await bookingAPI.createBooking(bookingData);
        bookingId = response.data.booking_id || response.data.booking?.id;
      }

      // Navigate to Stripe payment page
      navigate(`/payment/${bookingId}`);
    } catch (error) {
      console.error('Error creating booking:', error);
      alert(error.response?.data?.error || 'Failed to create booking. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8"
        >
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-6">
            Confirm Your Booking
          </h1>

          {/* Hotel Summary */}
          <div className="mb-8 p-6 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
              {hotel.name || hotel.hotel_name}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              Location: {hotel.location || hotel.address || hotel.city}
            </p>
            <div className="flex items-center gap-2 mb-2">
              <FaBed className="text-sky-600" />
              <span className="text-gray-700 dark:text-gray-300">
                Room Type : <span className="font-semibold capitalize">{hotel.selectedRoom?.name || roomType}</span>
              </span>
            </div>
            <div className="flex items-center gap-2 mb-2 text-gray-700 dark:text-gray-300">
              <FaUsers className="text-sky-600" />
              <span>{adultsCount} adult{adultsCount > 1 ? 's' : ''}{childrenCount > 0 ? `, ${childrenCount} child${childrenCount > 1 ? 'ren' : ''}` : ''}</span>
            </div>
            <p className="text-lg font-bold text-sky-600 dark:text-sky-400">
              PKR {pricePerDay.toLocaleString('en-PK')} per night
            </p>
          </div>

          {/* Booking Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Number of Rooms */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Number of Rooms
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaUsers className="text-gray-400" />
                </div>
                <select
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={formData.rooms}
                  onChange={(e) => setFormData({ ...formData, rooms: parseInt(e.target.value) })}
                  required
                >
                  {[...Array(Math.min(hotel.available_rooms || 10, 10)).keys()].map((n) => (
                    <option key={n + 1} value={n + 1}>
                      {n + 1} {n + 1 === 1 ? 'Room' : 'Rooms'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Check-in Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Check-in Date
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaCalendarAlt className="text-gray-400" />
                </div>
                <input
                  type="date"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={formData.checkInDate}
                  onChange={(e) => setFormData({ ...formData, checkInDate: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
            </div>

            {/* Check-out Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Check-out Date
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaCalendarAlt className="text-gray-400" />
                </div>
                <input
                  type="date"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={formData.checkOutDate}
                  onChange={(e) => setFormData({ ...formData, checkOutDate: e.target.value })}
                  min={formData.checkInDate || new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
            </div>

            {/* Guest Details */}
            <div className="p-6 bg-gray-50 dark:bg-gray-700/60 rounded-lg space-y-4 border border-gray-200 dark:border-gray-600">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Guest Details</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Add names for all {totalGuests} passenger{totalGuests > 1 ? 's' : ''}. Date of birth is required for lead passenger only.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Lead Passenger Name
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    value={guestInfo.leadName}
                    onChange={(e) => {
                      const value = e.target.value;
                      setGuestInfo((prev) => ({ ...prev, leadName: value }));
                      setPaxDetails((prev) => prev.map((p, idx) => (idx === 0 ? { ...p, fullName: value } : p)));
                    }}
                    placeholder="e.g., Ali Khan"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Lead Passenger Date of Birth
                  </label>
                  <input
                    type="date"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    value={guestInfo.leadDob}
                    onChange={(e) => setGuestInfo((prev) => ({ ...prev, leadDob: e.target.value }))}
                    max={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    value={guestInfo.phone}
                    onChange={(e) => setGuestInfo((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="e.g., +92 300 1234567"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    value={guestInfo.email}
                    onChange={(e) => setGuestInfo((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="e.g., traveler@email.com"
                  />
                </div>
              </div>

              <div className="space-y-3">
                {paxDetails.map((pax) => (
                  <div key={pax.id}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {pax.label} Name
                    </label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      value={pax.fullName}
                      onChange={(e) => {
                        const value = e.target.value;
                        setPaxDetails((prev) => prev.map((x) => (x.id === pax.id ? { ...x, fullName: value } : x)));
                        if (pax.id === 'adult-1') {
                          setGuestInfo((prev) => ({ ...prev, leadName: value }));
                        }
                      }}
                      placeholder={`Enter ${pax.label.toLowerCase()} full name`}
                      required
                    />
                  </div>
                ))}
              </div>
            </div>

            {formError && (
              <div className="p-4 rounded-lg border border-red-300 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
                {formError}
              </div>
            )}

            {/* Price Summary */}
            {totalPrice > 0 && (
              <div className="p-6 bg-sky-50 dark:bg-sky-900/30 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                  Price Summary
                </h3>
                <div className="space-y-2 text-gray-700 dark:text-gray-300">
                  <div className="flex justify-between">
                    <span>Price per day:</span>
                    <span>PKR {pricePerDay.toLocaleString('en-PK')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Number of rooms:</span>
                    <span>{formData.rooms}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Number of days:</span>
                    <span>{numberOfDays}</span>
                  </div>
                  <div className="border-t border-gray-300 dark:border-gray-600 pt-2 mt-2">
                    <div className="flex justify-between text-xl font-bold text-sky-600 dark:text-sky-400">
                      <span>Total Price:</span>
                      <span>PKR {totalPrice.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="flex-1 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || totalPrice === 0}
                className="flex-1 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Processing...' : 'Proceed to Payment'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default HotelBooking;