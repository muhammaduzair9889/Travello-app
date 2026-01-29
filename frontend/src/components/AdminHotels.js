import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPlus, FaEdit, FaTrash, FaStar, FaWifi, FaParking } from 'react-icons/fa';
import { X } from 'lucide-react';
import { hotelAPI } from '../services/api';

const ROOM_TYPE_CONFIG = [
  { key: 'single', label: 'Single' },
  { key: 'double', label: 'Double' },
  { key: 'triple', label: 'Triple' },
  { key: 'quad', label: 'Quad' },
  { key: 'family', label: 'Family' },
];

const buildEmptyRoomTypes = () =>
  ROOM_TYPE_CONFIG.reduce((acc, { key }) => {
    acc[key] = { price: '', total: '' };
    return acc;
  }, {});

const AdminHotels = () => {
  const navigate = useNavigate();
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingHotel, setEditingHotel] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    city: '',
    address: '',
    description: '',
    image: '',
    rating: '0',
    wifi_available: false,
    parking_available: false,
    roomTypes: buildEmptyRoomTypes(),
  });

  const totalRoomsFromForm = useMemo(() => {
    return ROOM_TYPE_CONFIG.reduce((sum, { key }) => {
      const total = parseInt(formData.roomTypes[key].total, 10);
      return sum + (Number.isInteger(total) ? total : 0);
    }, 0);
  }, [formData.roomTypes]);

  useEffect(() => {
    fetchHotels();
  }, []);

  const fetchHotels = async () => {
    setLoading(true);
    try {
      const response = await hotelAPI.getAllHotels();
      setHotels(response.data || []);
    } catch (error) {
      console.error('Error fetching hotels:', error);
      alert('Failed to load hotels. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingHotel(null);
    setFormData({
      name: '',
      city: '',
      address: '',
      description: '',
      image: '',
      rating: '0',
      wifi_available: false,
      parking_available: false,
      roomTypes: buildEmptyRoomTypes(),
    });
  };

  const handleOpenModal = (hotel = null) => {
    if (hotel) {
      setEditingHotel(hotel);
      const roomTypes = buildEmptyRoomTypes();
      (hotel.room_types || []).forEach((rt) => {
        if (roomTypes[rt.type]) {
          roomTypes[rt.type] = {
            price: rt.price_per_night?.toString() || '',
            total: rt.total_rooms?.toString() || '',
          };
        }
      });
      setFormData({
        name: hotel.name || '',
        city: hotel.city || '',
        address: hotel.address || '',
        description: hotel.description || '',
        image: hotel.image || '',
        rating: hotel.rating?.toString() || '0',
        wifi_available: Boolean(hotel.wifi_available),
        parking_available: Boolean(hotel.parking_available),
        roomTypes,
      });
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
  };

  const handleRoomTypeChange = (key, field, value) => {
    setFormData((prev) => ({
      ...prev,
      roomTypes: {
        ...prev.roomTypes,
        [key]: {
          ...prev.roomTypes[key],
          [field]: value,
        },
      },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.city.trim() || !formData.address.trim()) {
      alert('Name, city, and address are required.');
      return;
    }

    const room_types_payload = ROOM_TYPE_CONFIG.map(({ key }) => {
      const price = parseFloat(formData.roomTypes[key].price);
      const total = parseInt(formData.roomTypes[key].total, 10);
      if (Number.isFinite(price) && price > 0 && Number.isInteger(total) && total > 0) {
        return {
          type: key,
          price_per_night: price,
          total_rooms: total,
          max_occupancy: 2,
        };
      }
      return null;
    }).filter(Boolean);

    const payload = {
      name: formData.name.trim(),
      city: formData.city.trim(),
      address: formData.address.trim(),
      description: formData.description.trim(),
      image: formData.image.trim(),
      rating: parseFloat(formData.rating) || 0,
      wifi_available: Boolean(formData.wifi_available),
      parking_available: Boolean(formData.parking_available),
    };

    if (room_types_payload.length) {
      payload.room_types_payload = room_types_payload;
    }

    setSaving(true);
    try {
      if (editingHotel) {
        await hotelAPI.updateHotel(editingHotel.id, payload);
        alert('Hotel updated successfully!');
      } else {
        await hotelAPI.createHotel(payload);
        alert('Hotel created successfully!');
      }
      handleCloseModal();
      fetchHotels();
    } catch (error) {
      console.error('Error saving hotel:', error);
      const message = error?.data?.error || error?.message || 'Failed to save hotel. Please try again.';
      alert(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (hotelId) => {
    if (!window.confirm('Are you sure you want to delete this hotel?')) return;
    try {
      await hotelAPI.deleteHotel(hotelId);
      alert('Hotel deleted successfully!');
      fetchHotels();
    } catch (error) {
      console.error('Error deleting hotel:', error);
      alert('Failed to delete hotel. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-sky-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading hotels...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">Manage Hotels</h1>
            <p className="text-gray-600 dark:text-gray-400">Add, edit, or remove hotels from the system</p>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <FaPlus />
            Add Hotel
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Hotel</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">City</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Address</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Availability</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Room Types</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Rating</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Amenities</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {hotels.map((hotel) => (
                  <tr key={hotel.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-800 dark:text-white">{hotel.name}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{hotel.city}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{hotel.address}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                      {hotel.available_rooms} / {hotel.total_rooms}
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                      <div className="flex flex-wrap gap-2">
                        {(hotel.room_types || []).map((rt) => (
                          <span
                            key={rt.id}
                            className={`px-2 py-1 rounded-full text-xs border flex items-center gap-1 ${
                              rt.available_rooms > 0
                                ? 'border-green-500 text-green-700 bg-green-50 dark:bg-green-900/30'
                                : 'border-gray-400 text-gray-600 dark:text-gray-300 dark:border-gray-600'
                            }`}
                          >
                            <span className="capitalize">{rt.type}</span>
                            <span>PKR {Number(rt.price_per_night).toLocaleString()}</span>
                            <span>
                              ({rt.available_rooms}/{rt.total_rooms})
                            </span>
                          </span>
                        ))}
                        {(hotel.room_types || []).length === 0 && (
                          <span className="text-xs text-gray-500">No room types</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <FaStar className="text-yellow-500" />
                        <span className="text-gray-800 dark:text-white font-medium">
                          {(hotel.rating ?? 0).toFixed(1)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {hotel.wifi_available && <FaWifi className="text-sky-600" title="WiFi Available" />}
                        {hotel.parking_available && <FaParking className="text-sky-600" title="Parking Available" />}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenModal(hotel)}
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <FaEdit />
                        </button>
                        <button
                          onClick={() => handleDelete(hotel.id)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={() => navigate('/admin-dashboard')}
            className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={handleCloseModal}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                  {editingHotel ? 'Edit Hotel' : 'Add New Hotel'}
                </h2>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Hotel Name *</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">City *</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      required
                      placeholder="e.g., Lahore"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Address *</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      required
                      placeholder="Street, area, city"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Rating</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="5"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      value={formData.rating}
                      onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Image URL</label>
                    <input
                      type="url"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      value={formData.image}
                      onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                      placeholder="https://example.com/image.jpg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Total Rooms (calculated)</label>
                    <input
                      type="number"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white"
                      value={totalRoomsFromForm}
                      readOnly
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description *</label>
                  <textarea
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    rows="4"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                  />
                </div>

                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-5 h-5 text-sky-600 border-gray-300 rounded focus:ring-sky-500"
                      checked={formData.wifi_available}
                      onChange={(e) => setFormData({ ...formData, wifi_available: e.target.checked })}
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">WiFi Available</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-5 h-5 text-sky-600 border-gray-300 rounded focus:ring-sky-500"
                      checked={formData.parking_available}
                      onChange={(e) => setFormData({ ...formData, parking_available: e.target.checked })}
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Parking Available</span>
                  </label>
                </div>

                <div className="mt-4">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">Room Types</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Enter price per night and total rooms for each room type you want to offer.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {ROOM_TYPE_CONFIG.map(({ key, label }) => (
                      <div key={key} className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
                        <h4 className="text-md font-semibold text-gray-800 dark:text-white mb-2">{label} Room</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price per night (PKR)</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              value={formData.roomTypes[key].price}
                              onChange={(e) => handleRoomTypeChange(key, 'price', e.target.value)}
                              placeholder="e.g., 8000"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Total Rooms</label>
                            <input
                              type="number"
                              min="0"
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              value={formData.roomTypes[key].total}
                              onChange={(e) => handleRoomTypeChange(key, 'total', e.target.value)}
                              placeholder="e.g., 5"
                            />
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Leave blank or zero to omit this room type.</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="flex-1 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-3 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white rounded-lg font-medium transition-colors"
                  >
                    {saving ? 'Saving...' : editingHotel ? 'Update Hotel' : 'Create Hotel'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminHotels;