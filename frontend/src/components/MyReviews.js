import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaStar, FaEdit, FaTrash, FaArrowLeft, FaThumbsUp,
  FaPen, FaHotel, FaFilter, FaGlobe, FaTimes, FaChevronLeft, FaChevronRight,
} from 'react-icons/fa';
import { reviewAPI } from '../services/api';

/* ── Colour / icon maps ─────────────────────────────────── */
const SENTIMENT_COLORS = {
  positive: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  neutral: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  negative: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};
const SENTIMENT_ICONS = { positive: '😊', neutral: '😐', negative: '😞' };

const StarDisplay = ({ rating, size = 'text-sm' }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((s) => (
      <FaStar key={s} className={`${size} ${s <= rating ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600'}`} />
    ))}
  </div>
);

/* ── Main component ─────────────────────────────────────── */
const MyReviews = () => {
  const navigate = useNavigate();

  /* state */
  const [myReviews, setMyReviews] = useState([]);
  const [reviewableBookings, setReviewableBookings] = useState([]);
  const [hasAnyBooking, setHasAnyBooking] = useState(false);
  const [publicReviews, setPublicReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [activeTab, setActiveTab] = useState('my');

  /* browse-tab filters */
  const [ratingFilter, setRatingFilter] = useState('');
  const [sortBy, setSortBy] = useState('-created_at');
  const [showFilters, setShowFilters] = useState(false);

  /* lightbox */
  const [lightbox, setLightbox] = useState(null); // { photos, index }

  /* ── Load everything on mount ─────────────────────────── */
  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [reviewsRes, eligibleRes, publicRes] = await Promise.all([
        reviewAPI.myReviews(),
        reviewAPI.reviewableBookings(),
        reviewAPI.list({ ordering: '-created_at' }),
      ]);

      setMyReviews(reviewsRes.data || []);
      setReviewableBookings(eligibleRes.data.bookings || []);
      setHasAnyBooking(eligibleRes.data.has_any_booking || false);
      setPublicReviews(publicRes.data || []);

      /* Smart default tab */
      const eligible = eligibleRes.data.bookings || [];
      const mine = reviewsRes.data || [];
      if (mine.length === 0 && eligible.length > 0) {
        setActiveTab('write');
      } else if (mine.length === 0 && eligible.length === 0) {
        setActiveTab('browse');
      }
    } catch {
      setError('Failed to load data.');
    } finally {
      setLoading(false);
    }
  };

  /* reload public reviews when filters change */
  useEffect(() => {
    if (activeTab !== 'browse') return;
    const params = { ordering: sortBy };
    if (ratingFilter) params.rating = ratingFilter;
    reviewAPI.list(params).then((r) => setPublicReviews(r.data || [])).catch(() => {});
  }, [ratingFilter, sortBy, activeTab]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this review permanently?')) return;
    setDeleting(id);
    try {
      await reviewAPI.delete(id);
      setMyReviews((prev) => prev.filter((r) => r.id !== id));
    } catch {
      setError('Failed to delete review.');
    } finally {
      setDeleting(null);
    }
  };

  const handleHelpful = async (id) => {
    try {
      const res = await reviewAPI.helpful(id);
      setPublicReviews((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, helpful_count: res.data.helpful_count, user_found_helpful: res.data.helpful } : r
        )
      );
    } catch { /* silent */ }
  };

  /* ── Loading ──────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-sky-600" />
      </div>
    );
  }

  /* ── Determine which tabs to show ─────────────────────── */
  const showWriteTab = reviewableBookings.length > 0;
  const tabs = [
    { key: 'my', label: 'My Reviews', count: myReviews.length },
    ...(showWriteTab
      ? [{ key: 'write', label: 'Write a Review', count: reviewableBookings.length, highlight: true }]
      : []),
    { key: 'browse', label: 'Browse Reviews', count: null },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* ─── Header ──────────────────────────────────────── */}
        <div className="mb-6">
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-sky-600 mb-4 transition-colors">
            <FaArrowLeft /> Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Reviews & Ratings</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {myReviews.length} review{myReviews.length !== 1 ? 's' : ''} written
            {reviewableBookings.length > 0 && (
              <span className="ml-2 text-amber-600 dark:text-amber-400 font-medium">
                · {reviewableBookings.length} booking{reviewableBookings.length !== 1 ? 's' : ''} ready for review
              </span>
            )}
          </p>
        </div>

        {/* ─── Tabs ────────────────────────────────────────── */}
        <div className="flex gap-1 mb-6 bg-white dark:bg-gray-800 rounded-xl shadow p-1.5 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex-1 min-w-0 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === t.key
                  ? t.highlight ? 'bg-amber-500 text-white shadow-md' : 'bg-sky-600 text-white shadow-md'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {t.label}
              {t.count != null && (
                <span className={`ml-1.5 px-2 py-0.5 rounded-full text-xs ${
                  activeTab === t.key ? 'bg-white/20' : t.highlight ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg">{error}</div>
        )}

        {/* ═══════════ WRITE A REVIEW TAB ═══════════ */}
        {activeTab === 'write' && showWriteTab && (
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">
              These bookings are ready for your review — select one to share your experience:
            </p>
            {reviewableBookings.map((booking) => (
              <motion.div
                key={booking.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-r from-sky-400 to-blue-500 rounded-lg flex items-center justify-center text-white text-xl font-bold shadow-md flex-shrink-0">
                    {booking.hotel_details?.name?.charAt(0)?.toUpperCase() || <FaHotel />}
                  </div>
                  <div>
                    <p className="font-bold text-gray-800 dark:text-white">{booking.hotel_details?.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {booking.hotel_details?.city}
                      {' · '}
                      {new Date(booking.check_in).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {' – '}
                      {new Date(booking.check_out).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-0.5 font-medium">✓ Confirmed booking</p>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate(`/write-review?booking=${booking.id}`)}
                  className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 whitespace-nowrap shadow-md"
                >
                  <FaPen className="text-sm" /> Write Review
                </motion.button>
              </motion.div>
            ))}
          </div>
        )}

        {/* ═══════════ MY REVIEWS TAB ═══════════ */}
        {activeTab === 'my' && (
          <>
            {/* Banner: eligible bookings awaiting review */}
            {reviewableBookings.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3"
              >
                <p className="text-amber-800 dark:text-amber-300 text-sm font-medium">
                  ⭐ You have {reviewableBookings.length} booking{reviewableBookings.length !== 1 ? 's' : ''} waiting for your review!
                </p>
                <button
                  onClick={() => setActiveTab('write')}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold transition-colors whitespace-nowrap"
                >
                  Write a Review
                </button>
              </motion.div>
            )}

            {myReviews.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
                <div className="text-6xl mb-4">📝</div>
                <p className="text-gray-500 dark:text-gray-400 text-lg mb-2">You haven't written any reviews yet.</p>
                <p className="text-gray-400 dark:text-gray-500 text-sm mb-6">
                  {hasAnyBooking
                    ? reviewableBookings.length > 0
                      ? 'You have bookings ready for review — share your experience!'
                      : 'Once you have a confirmed booking, you\'ll be able to leave a review.'
                    : 'Book a hotel first, and after your stay you can share your experience here.'}
                </p>
                {reviewableBookings.length > 0 ? (
                  <button
                    onClick={() => setActiveTab('write')}
                    className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors"
                  >
                    Write Your First Review
                  </button>
                ) : (
                  <button
                    onClick={() => setActiveTab('browse')}
                    className="px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Browse Other Reviews
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {myReviews.map((review) => (
                  <motion.div
                    key={review.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700"
                  >
                    <div className="p-6">
                      {/* Header Row */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                        <div className="flex items-center gap-4">
                          {review.hotel_image && (
                            <img src={review.hotel_image} alt="" className="w-14 h-14 rounded-lg object-cover" />
                          )}
                          <div>
                            <p className="font-bold text-gray-800 dark:text-white">{review.hotel_name}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{review.hotel_city}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <StarDisplay rating={review.overall_rating} />
                          {review.sentiment && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SENTIMENT_COLORS[review.sentiment]}`}>
                              {SENTIMENT_ICONS[review.sentiment]} {review.sentiment}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Review Body */}
                      <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">{review.title}</h3>
                      <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line mb-4">{review.content}</p>

                      {/* Photos */}
                      {review.photos?.length > 0 && (
                        <div className="mb-4">
                          <div className="flex flex-wrap gap-2">
                            {review.photos.map((photo, idx) => (
                              <button
                                key={photo.id}
                                type="button"
                                onClick={() => setLightbox({ photos: review.photos, index: idx })}
                                className="relative group rounded-lg overflow-hidden focus:outline-none focus:ring-2 focus:ring-sky-500"
                              >
                                <img
                                  src={photo.image_url}
                                  alt={photo.caption || 'Review photo'}
                                  className="w-24 h-24 object-cover transition-transform group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Meta */}
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                        {new Date(review.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        {review.trip_type && ` · ${review.trip_type.charAt(0).toUpperCase() + review.trip_type.slice(1)} trip`}
                        {review.booking_reference && ` · Booking: ${review.booking_reference}`}
                      </div>

                      {/* Replies */}
                      {review.replies?.length > 0 && (
                        <div className="mb-4 space-y-2">
                          {review.replies.map((reply) => (
                            <div key={reply.id} className="ml-4 p-3 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 rounded">
                              <p className="text-xs font-bold text-blue-700 dark:text-blue-400 mb-1">
                                🏨 Hotel Response · {new Date(reply.created_at).toLocaleDateString()}
                              </p>
                              <p className="text-sm text-gray-700 dark:text-gray-300">{reply.content}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                        <span className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                          <FaThumbsUp className="text-xs" /> {review.helpful_count} found helpful
                        </span>
                        <div className="flex gap-2">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => navigate(`/write-review?edit=${review.id}`)}
                            className="px-4 py-2 bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 rounded-lg text-sm font-medium hover:bg-sky-200 dark:hover:bg-sky-900/50 transition-colors flex items-center gap-1.5"
                          >
                            <FaEdit className="text-xs" /> Edit
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleDelete(review.id)}
                            disabled={deleting === review.id}
                            className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <FaTrash className="text-xs" /> {deleting === review.id ? 'Deleting...' : 'Delete'}
                          </motion.button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ═══════════ BROWSE REVIEWS TAB ═══════════ */}
        {activeTab === 'browse' && (
          <>
            {/* Filter bar */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 mb-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-sky-600 transition-colors">
                  <FaFilter /> Filters {ratingFilter && <span className="w-2 h-2 bg-sky-500 rounded-full" />}
                </button>
                <div className="flex items-center gap-2">
                  <FaGlobe className="text-gray-400 text-sm" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                  >
                    <option value="-created_at">Newest First</option>
                    <option value="created_at">Oldest First</option>
                    <option value="-overall_rating">Highest Rated</option>
                    <option value="overall_rating">Lowest Rated</option>
                    <option value="-helpful_count">Most Helpful</option>
                  </select>
                </div>
              </div>
              <AnimatePresence>
                {showFilters && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="pt-4 flex flex-wrap gap-2 border-t border-gray-200 dark:border-gray-700 mt-3">
                      {['', '5', '4', '3', '2', '1'].map((r) => (
                        <button
                          key={r}
                          onClick={() => setRatingFilter(r)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            ratingFilter === r ? 'bg-sky-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                          }`}
                        >
                          {r ? `${r}★` : 'All'}
                        </button>
                      ))}
                      {ratingFilter && (
                        <button onClick={() => setRatingFilter('')} className="text-xs text-sky-600 hover:underline ml-2">
                          Clear
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Review list */}
            {publicReviews.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
                <div className="text-6xl mb-4">🌍</div>
                <p className="text-gray-500 dark:text-gray-400 text-lg">No reviews yet — be the first to share!</p>
              </div>
            ) : (
              <div className="space-y-5">
                {publicReviews.map((review) => (
                  <motion.div
                    key={review.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700"
                  >
                    <div className="p-6">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-sky-400 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {review.user_details?.first_name?.charAt(0)?.toUpperCase() || review.user_details?.username?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-800 dark:text-white">
                              {review.user_details?.first_name || review.user_details?.username || 'Guest'}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {review.hotel_name && <span className="font-medium">{review.hotel_name}</span>}
                              {review.hotel_city && <span> · {review.hotel_city}</span>}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <StarDisplay rating={review.overall_rating} />
                          {review.sentiment && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SENTIMENT_COLORS[review.sentiment]}`}>
                              {SENTIMENT_ICONS[review.sentiment]} {review.sentiment}
                            </span>
                          )}
                          {review.is_verified_stay && (
                            <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-medium">
                              ✓ Verified
                            </span>
                          )}
                        </div>
                      </div>

                      <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">{review.title}</h3>
                      <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line mb-3">{review.content}</p>

                      {/* Photos */}
                      {review.photos?.length > 0 && (
                        <div className="mb-3">
                          <div className="flex flex-wrap gap-2">
                            {review.photos.map((photo, idx) => (
                              <button
                                key={photo.id}
                                type="button"
                                onClick={() => setLightbox({ photos: review.photos, index: idx })}
                                className="relative group rounded-lg overflow-hidden focus:outline-none focus:ring-2 focus:ring-sky-500"
                              >
                                <img
                                  src={photo.image_url}
                                  alt={photo.caption || 'Review photo'}
                                  className="w-24 h-24 object-cover transition-transform group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                        {new Date(review.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        {review.trip_type && ` · ${review.trip_type.charAt(0).toUpperCase() + review.trip_type.slice(1)} trip`}
                      </div>

                      {review.replies?.length > 0 && (
                        <div className="mb-3 space-y-2">
                          {review.replies.map((reply) => (
                            <div key={reply.id} className="ml-4 p-3 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 rounded">
                              <p className="text-xs font-bold text-blue-700 dark:text-blue-400 mb-1">
                                🏨 Hotel Response · {new Date(reply.created_at).toLocaleDateString()}
                              </p>
                              <p className="text-sm text-gray-700 dark:text-gray-300">{reply.content}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                        <button
                          onClick={() => handleHelpful(review.id)}
                          className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
                            review.user_found_helpful
                              ? 'text-sky-600 dark:text-sky-400'
                              : 'text-gray-500 dark:text-gray-400 hover:text-sky-600'
                          }`}
                        >
                          <FaThumbsUp className="text-xs" />
                          {review.helpful_count > 0 ? `${review.helpful_count} found helpful` : 'Helpful?'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ─── Back ────────────────────────────────────────── */}
        <div className="mt-8 text-center">
          <button onClick={() => navigate('/dashboard')} className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors">
            ← Back to Dashboard
          </button>
        </div>
      </div>

      {/* ─── Lightbox Modal ────────────────────────────────── */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={() => setLightbox(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-4xl max-h-[90vh] mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setLightbox(null)}
                className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors z-10"
              >
                <FaTimes className="text-2xl" />
              </button>
              <img
                src={lightbox.photos[lightbox.index].image_url}
                alt={lightbox.photos[lightbox.index].caption || 'Review photo'}
                className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
              />
              {lightbox.photos[lightbox.index].caption && (
                <p className="text-center text-white text-sm mt-3">{lightbox.photos[lightbox.index].caption}</p>
              )}
              <p className="text-center text-gray-400 text-xs mt-1">
                {lightbox.index + 1} / {lightbox.photos.length}
              </p>
              {lightbox.photos.length > 1 && (
                <>
                  <button
                    onClick={() => setLightbox((prev) => ({ ...prev, index: (prev.index - 1 + prev.photos.length) % prev.photos.length }))}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
                  >
                    <FaChevronLeft />
                  </button>
                  <button
                    onClick={() => setLightbox((prev) => ({ ...prev, index: (prev.index + 1) % prev.photos.length }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
                  >
                    <FaChevronRight />
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MyReviews;
