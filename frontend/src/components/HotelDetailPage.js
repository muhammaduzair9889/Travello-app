import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaBed, FaCalendarAlt, FaMapMarkerAlt, FaMoneyBillWave, FaUsers } from 'react-icons/fa';
import { hotelAPI, bookingAPI, paymentAPI } from '../services/api';

const formatPKR = (value) => {
  if (Number.isNaN(value)) return '0';
  return Number(value).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const HotelDetailPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const preselectedRoomType = location.state?.roomType;
  const preselectedCheckIn = location.state?.checkIn || '';
  const preselectedCheckOut = location.state?.checkOut || '';
  const preselectedRooms = location.state?.roomsBooked || 1;

  const [hotel, setHotel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [error, setError] = useState(null);

  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState(null);
  const [roomsBooked, setRoomsBooked] = useState(preselectedRooms);
  const [checkIn, setCheckIn] = useState(preselectedCheckIn);
  const [checkOut, setCheckOut] = useState(preselectedCheckOut);
  const [paymentMethod, setPaymentMethod] = useState('ONLINE');
  const [availability, setAvailability] = useState(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const fetchHotel = async () => {
      setLoading(true);
      try {
        const response = await hotelAPI.getHotel(id);
        setHotel(response.data);
        if (preselectedRoomType && response.data.room_types?.length) {
          const match = response.data.room_types.find((rt) => rt.type === preselectedRoomType);
          if (match) {
            setSelectedRoomTypeId(match.id);
          }
        }
      } catch (err) {
        console.error('Error loading hotel', err);
        setError('Failed to load hotel. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchHotel();
  }, [id, preselectedRoomType]);

  useEffect(() => {
    if (preselectedCheckIn) {
      setCheckIn(preselectedCheckIn);
    }
    if (preselectedCheckOut) {
      setCheckOut(preselectedCheckOut);
    }
    if (preselectedRooms) {
      setRoomsBooked(preselectedRooms);
    }
  }, [preselectedCheckIn, preselectedCheckOut, preselectedRooms]);

  const selectedRoomType = useMemo(() => {
    if (!hotel?.room_types) return null;
    return hotel.room_types.find((rt) => rt.id === selectedRoomTypeId) || null;
  }, [hotel, selectedRoomTypeId]);

  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return 0;
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  }, [checkIn, checkOut]);

  const totalPrice = useMemo(() => {
    if (!selectedRoomType || nights === 0) return 0;
    return Number(selectedRoomType.price_per_night || 0) * roomsBooked * nights;
  }, [selectedRoomType, nights, roomsBooked]);

  const bookedRooms = useCallback(
    (roomType) => {
      const availableRooms = availability?.room_types?.find((rt) => rt.id === roomType.id)?.available_rooms;
      const available = availableRooms ?? roomType.available_rooms ?? 0;
      return Math.max((roomType.total_rooms || 0) - available, 0);
    },
    [availability]
  );

  const availabilityForSelected = useMemo(() => {
    if (!selectedRoomType) return null;
    return availability?.room_types?.find((rt) => rt.id === selectedRoomType.id) || null;
  }, [availability, selectedRoomType]);

  const availableRoomsForSelected = availabilityForSelected?.available_rooms ?? selectedRoomType?.available_rooms ?? 0;
  const overRequested = roomsBooked > (availableRoomsForSelected || 0);

  const handleCheckAvailability = async () => {
    if (!checkIn || !checkOut) {
      setError('Select check-in and check-out dates first.');
      return;
    }

    setError(null);
    setAvailabilityLoading(true);
    try {
      const payload = {
        hotel: Number(id),
        room_type: selectedRoomTypeId || undefined,
        check_in: checkIn,
        check_out: checkOut,
        rooms_needed: roomsBooked,
      };
      const response = await hotelAPI.checkAvailability(payload);
      setAvailability(response.data?.data || null);
    } catch (err) {
      console.error('Availability check failed', err);
      setError(err.response?.data?.error || 'Failed to check availability.');
    } finally {
      setAvailabilityLoading(false);
    }
  };
  useEffect(() => {
    if (checkIn && checkOut) {
      handleCheckAvailability();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkIn, checkOut, selectedRoomTypeId, roomsBooked]);

  const handleConfirmBooking = async () => {
    if (!selectedRoomTypeId) {
      setError('Please select a room type.');
      return;
    }
    if (!checkIn || !checkOut || nights <= 0) {
      setError('Please choose valid check-in and check-out dates.');
      return;
    }
    if (availabilityForSelected && availabilityForSelected.available_rooms < roomsBooked) {
      setError('Not enough rooms available for selected dates.');
      return;
    }

    setError(null);
    setConfirming(true);
    try {
      const payload = {
        hotel: Number(id),
        room_type: selectedRoomTypeId,
        rooms_booked: roomsBooked,
        check_in: checkIn,
        check_out: checkOut,
        payment_method: paymentMethod,
      };

      const response = await bookingAPI.createBooking(payload);
      const booking = response.data?.booking || response.data;
      const paymentRequired = response.data?.payment_required ?? paymentMethod === 'ONLINE';

      if (paymentMethod === 'ONLINE' && paymentRequired) {
        // Redirect to PaymentPage to handle Stripe session creation
        navigate(`/payment/${booking.id}`, { state: { booking } });
        return;
      }

      navigate('/my-bookings', { state: { message: 'Booking confirmed. Pay on arrival.' } });
    } catch (err) {
      console.error('Booking failed:', err);
      console.error('Response status:', err.response?.status);
      console.error('Response data:', err.response?.data);
      
      // Extract detailed error message
      let fallbackMessage = 'Failed to create booking. Please try again.';
      
      if (err.response?.data?.error) {
        fallbackMessage = err.response.data.error;
      } else if (err.response?.data?.detail) {
        fallbackMessage = err.response.data.detail;
      } else if (err.response?.data?.rooms_booked) {
        fallbackMessage = Array.isArray(err.response.data.rooms_booked) 
          ? err.response.data.rooms_booked[0] 
          : (typeof err.response.data.rooms_booked === 'string' 
              ? err.response.data.rooms_booked 
              : JSON.stringify(err.response.data.rooms_booked));
      } else if (typeof err.response?.data === 'object' && err.response?.data !== null) {
        // Handle other field errors - ensure all values are strings
        const errors = Object.entries(err.response.data)
          .map(([field, msg]) => {
            const msgStr = Array.isArray(msg) 
              ? msg[0] 
              : (typeof msg === 'string' ? msg : JSON.stringify(msg));
            return `${field}: ${msgStr}`;
          })
          .join(', ');
        if (errors) fallbackMessage = errors;
      } else if (err.message) {
        fallbackMessage = err.message;
      }
      
      setError(fallbackMessage);
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-sky-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading hotel...</p>
        </div>
      </div>
    );
  }

  if (error && !hotel) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={() => navigate('/hotels')}
            className="px-6 py-3 bg-sky-600 text-white rounded-lg"
          >
            Back to Hotels
          </button>
        </div>
      </div>
    );
  }

  const hotelName = hotel?.name || hotel?.hotel_name || 'Hotel';
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden"
        >
          {/* Hero */}
          <div className="h-64 bg-gradient-to-r from-sky-500 to-blue-600 relative">
            {hotel?.image && (
              <img src={hotel.image} alt={hotelName} className="w-full h-full object-cover" />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent" />
            <div className="absolute bottom-6 left-6 text-white">
              <h1 className="text-3xl font-bold mb-2">{hotelName}</h1>
              <div className="flex items-center gap-2 text-sm">
                <FaMapMarkerAlt />
                <span>{hotel?.address || hotel?.location}</span>
              </div>
            </div>
          </div>

          <div className="p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left: Room types */}
            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                <FaBed /> Room Types
              </h2>

              {hotel?.room_types?.length ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {hotel.room_types.map((room) => {
                    const isSelected = room.id === selectedRoomTypeId;
                    const booked = bookedRooms(room);
                    const available = availability?.room_types?.find((rt) => rt.id === room.id)?.available_rooms ?? room.available_rooms ?? 0;
                    const soldOut = available === 0;

                    return (
                      <button
                        key={room.id}
                        onClick={() => setSelectedRoomTypeId(room.id)}
                        className={`text-left p-4 rounded-lg border transition-all ${
                          isSelected
                            ? 'border-sky-500 ring-2 ring-sky-200 dark:ring-sky-900/40'
                            : 'border-gray-200 dark:border-gray-700 hover:border-sky-400'
                        } bg-gray-50 dark:bg-gray-800/50 ${soldOut ? 'opacity-70 cursor-not-allowed' : ''}`}
                        disabled={soldOut}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-lg font-bold text-gray-800 dark:text-white capitalize">
                            {room.type}
                          </div>
                          <div className="text-sky-600 dark:text-sky-400 font-semibold">
                            PKR {formatPKR(room.price_per_night || 0)}/night
                          </div>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                          <p>Total rooms: {room.total_rooms || 0}</p>
                          <p>Available: {available > 0 ? available : room.total_rooms || 0}{soldOut ? ' (sold out for selected dates)' : ''}</p>
                          <p>Booked: {booked}</p>
                          {availability && (
                            <p className="text-xs text-green-600 dark:text-green-400">
                              Availability for selected dates: {available > 0 ? available : room.total_rooms} left
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-600 dark:text-gray-400">No room types found for this hotel.</p>
              )}
            </div>

            {/* Right: Booking form */}
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                  <FaCalendarAlt /> Your Stay
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Check-in</label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                      value={checkIn}
                      onChange={(e) => setCheckIn(e.target.value)}
                      min={today}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Check-out</label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                      value={checkOut}
                      onChange={(e) => setCheckOut(e.target.value)}
                      min={checkIn || today}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1 flex items-center gap-2">
                      <FaUsers /> Rooms
                    </label>
                    <select
                      className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                      value={roomsBooked}
                      onChange={(e) => setRoomsBooked(Number(e.target.value))}
                    >
                      {[...Array(10).keys()].map((n) => (
                        <option key={n + 1} value={n + 1}>
                          {n + 1} {n === 0 ? 'room' : 'rooms'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCheckAvailability}
                  className="mt-4 w-full py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium disabled:opacity-50"
                  disabled={availabilityLoading}
                >
                  {availabilityLoading ? 'Checking availability...' : 'Check Availability'}
                </button>
                {selectedRoomType && (
                  <div className="mt-4 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                    <p className="font-semibold mb-1">Selection</p>
                    <p>Room: <span className="capitalize font-semibold">{selectedRoomType.type}</span></p>
                    <p>Requested: {roomsBooked} {roomsBooked === 1 ? 'room' : 'rooms'}</p>
                    <p>Available for dates: <span className={`font-semibold ${availableRoomsForSelected > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {availableRoomsForSelected}
                    </span></p>
                    {overRequested && (
                      <p className="mt-2 text-red-600 dark:text-red-400">Not enough rooms for these dates.</p>
                    )}
                  </div>
                )}
              </div>

              <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                  <FaMoneyBillWave /> Payment Method
                </h3>
                <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="ONLINE"
                      checked={paymentMethod === 'ONLINE'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    />
                    <span>Pay Online (Stripe)</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="ARRIVAL"
                      checked={paymentMethod === 'ARRIVAL'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    />
                    <span>Pay on Arrival</span>
                  </label>
                </div>
              </div>

              <div className="p-4 bg-sky-50 dark:bg-sky-900/30 rounded-lg border border-sky-100 dark:border-sky-800">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">Booking Summary</h3>
                <div className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
                  <p>Room: <span className="font-semibold capitalize">{selectedRoomType?.type || 'Select a room'}</span></p>
                  <p>Dates: {checkIn || '—'} to {checkOut || '—'} ({nights} nights)</p>
                  <p>Rooms: {roomsBooked}</p>
                  <p>Total: <span className="text-xl font-bold text-sky-700 dark:text-sky-300">PKR {formatPKR(totalPrice)}</span></p>
                </div>
                {error && (
                  <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
                )}
                <button
                  onClick={handleConfirmBooking}
                  disabled={confirming || !selectedRoomTypeId || nights === 0 || overRequested || availableRoomsForSelected === 0}
                  className="mt-4 w-full py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {confirming ? 'Processing...' : paymentMethod === 'ONLINE' ? 'Confirm & Pay' : 'Confirm Booking'}
                </button>
                <button
                  onClick={() => navigate('/hotels')}
                  className="mt-2 w-full py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg"
                >
                  Back to Hotels
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default HotelDetailPage;
