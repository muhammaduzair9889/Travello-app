import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FaStar, FaThumbsUp, FaFilter, FaArrowLeft, FaChartBar, FaTimes, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { reviewAPI } from '../services/api';

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

const RatingBar = ({ label, count, total, star }) => {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-8 text-right text-gray-600 dark:text-gray-400">{star}★</span>
      <div className="flex-1 h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className="h-full bg-amber-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-gray-500 dark:text-gray-400">{count}</span>
    </div>
  );
};

const ReviewsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const hotelId = searchParams.get('hotel');

  const [reviews, setReviews] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [ratingFilter, setRatingFilter] = useState('');
  const [sentimentFilter, setSentimentFilter] = useState('');
  const [sortBy, setSortBy] = useState('-created_at');
  const [showFilters, setShowFilters] = useState(false);

  // Lightbox
  const [lightbox, setLightbox] = useState(null); // { photos, index }

  useEffect(() => {
    loadData();
  }, [hotelId, ratingFilter, sentimentFilter, sortBy]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = { ordering: sortBy };
      if (hotelId) params.hotel = hotelId;
      if (ratingFilter) params.rating = ratingFilter;
      if (sentimentFilter) params.sentiment = sentimentFilter;

      const [reviewsRes, analyticsRes] = await Promise.all([
        reviewAPI.list(params),
        hotelId ? reviewAPI.analytics(hotelId) : Promise.resolve(null),
      ]);

      setReviews(reviewsRes.data);
      if (analyticsRes) setAnalytics(analyticsRes.data);
    } catch {
      setError('Failed to load reviews.');
    } finally {
      setLoading(false);
    }
  };

  const handleHelpful = async (reviewId) => {
    try {
      const res = await reviewAPI.helpful(reviewId);
      setReviews((prev) =>
        prev.map((r) =>
          r.id === reviewId ? { ...r, helpful_count: res.data.helpful_count, user_found_helpful: res.data.helpful } : r
        )
      );
    } catch {
      // silently fail
    }
  };

  const clearFilters = () => {
    setRatingFilter('');
    setSentimentFilter('');
    setSortBy('-created_at');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-sky-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-sky-600 mb-4 transition-colors">
            <FaArrowLeft /> Back
          </button>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
            {hotelId ? 'Hotel Reviews' : 'All Reviews'}
          </h1>
        </div>

        {/* Analytics Summary */}
        {analytics && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <FaChartBar className="text-sky-600" />
              <h2 className="text-lg font-bold text-gray-800 dark:text-white">Review Analytics</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Average Rating */}
              <div className="text-center">
                <div className="text-5xl font-bold text-amber-500 mb-1">{analytics.average_rating}</div>
                <StarDisplay rating={Math.round(analytics.average_rating)} size="text-lg" />
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{analytics.total_reviews} reviews</p>
              </div>

              {/* Rating Distribution */}
              <div className="space-y-1.5">
                {[5, 4, 3, 2, 1].map((star) => (
                  <RatingBar
                    key={star}
                    star={star}
                    count={analytics.rating_distribution?.[String(star)] || 0}
                    total={analytics.total_reviews}
                  />
                ))}
              </div>

              {/* Quick Stats */}
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Recommendation Rate</span>
                  <span className="font-bold text-green-600">{analytics.recommendation_rate}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Trend</span>
                  <span className={`font-bold ${analytics.recent_trend === 'improving' ? 'text-green-600' : analytics.recent_trend === 'declining' ? 'text-red-500' : 'text-gray-600'}`}>
                    {analytics.recent_trend === 'improving' ? '📈 Improving' : analytics.recent_trend === 'declining' ? '📉 Declining' : '➡️ Stable'}
                  </span>
                </div>
                {/* Sentiment */}
                <div className="flex gap-2 mt-2">
                  {['positive', 'neutral', 'negative'].map((s) => (
                    <span key={s} className={`px-2 py-1 rounded-full text-xs font-medium ${SENTIMENT_COLORS[s]}`}>
                      {SENTIMENT_ICONS[s]} {analytics.sentiment_distribution?.[s] || 0}
                    </span>
                  ))}
                </div>
                {/* Aspect averages */}
                {analytics.aspect_averages && Object.keys(analytics.aspect_averages).length > 0 && (
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-700 space-y-1">
                    {Object.entries(analytics.aspect_averages).map(([key, val]) => (
                      <div key={key} className="flex justify-between text-xs">
                        <span className="text-gray-500 dark:text-gray-400 capitalize">{key}</span>
                        <span className="font-semibold text-gray-800 dark:text-white">{val}/5</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Filter Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-sky-600 transition-colors">
              <FaFilter /> Filters {(ratingFilter || sentimentFilter) && <span className="w-2 h-2 bg-sky-500 rounded-full" />}
            </button>
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

          <AnimatePresence>
            {showFilters && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="pt-4 flex flex-wrap gap-3 border-t border-gray-200 dark:border-gray-700 mt-3">
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Rating</label>
                    <div className="flex gap-1">
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
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Sentiment</label>
                    <div className="flex gap-1">
                      {['', 'positive', 'neutral', 'negative'].map((s) => (
                        <button
                          key={s}
                          onClick={() => setSentimentFilter(s)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            sentimentFilter === s ? 'bg-sky-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                          }`}
                        >
                          {s ? `${SENTIMENT_ICONS[s]} ${s.charAt(0).toUpperCase() + s.slice(1)}` : 'All'}
                        </button>
                      ))}
                    </div>
                  </div>
                  {(ratingFilter || sentimentFilter) && (
                    <button onClick={clearFilters} className="self-end text-xs text-sky-600 hover:underline">
                      Clear all
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg">{error}</div>
        )}

        {/* Review List */}
        {reviews.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl shadow">
            <div className="text-6xl mb-4">📝</div>
            <p className="text-gray-500 dark:text-gray-400 text-lg">No reviews yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {reviews.map((review) => (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700"
              >
                <div className="p-6">
                  {/* Review Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-sky-400 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        {review.user_details?.username?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800 dark:text-white">{review.user_details?.username}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(review.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                          {review.trip_type && ` · ${review.trip_type.charAt(0).toUpperCase() + review.trip_type.slice(1)} trip`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StarDisplay rating={review.overall_rating} size="text-base" />
                      {review.sentiment && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SENTIMENT_COLORS[review.sentiment]}`}>
                          {SENTIMENT_ICONS[review.sentiment]} {review.sentiment}
                        </span>
                      )}
                      {review.is_verified_stay && (
                        <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-medium">
                          ✓ Verified Stay
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Hotel info (when not filtered by hotel) */}
                  {!hotelId && review.hotel_name && (
                    <div className="mb-3 text-sm text-gray-600 dark:text-gray-400">
                      🏨 {review.hotel_name} — {review.hotel_city}
                    </div>
                  )}

                  {/* Review Content */}
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">{review.title}</h3>
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">{review.content}</p>

                  {/* Aspect Ratings */}
                  {review.aspect_average && (
                    <div className="mt-4 flex flex-wrap gap-3">
                      {review.cleanliness_rating && (
                        <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">🧹 Cleanliness: {review.cleanliness_rating}/5</span>
                      )}
                      {review.service_rating && (
                        <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">🛎️ Service: {review.service_rating}/5</span>
                      )}
                      {review.location_rating && (
                        <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">📍 Location: {review.location_rating}/5</span>
                      )}
                      {review.value_rating && (
                        <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">💰 Value: {review.value_rating}/5</span>
                      )}
                      {review.amenities_rating && (
                        <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">🏊 Amenities: {review.amenities_rating}/5</span>
                      )}
                    </div>
                  )}

                  {/* Photos */}
                  {review.photos?.length > 0 && (
                    <div className="mt-4">
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
                              className="w-28 h-28 object-cover transition-transform group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                              <span className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">View</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Replies */}
                  {review.replies?.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {review.replies.map((reply) => (
                        <div key={reply.id} className="ml-6 p-3 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 rounded">
                          <p className="text-xs font-bold text-blue-700 dark:text-blue-400 mb-1">
                            🏨 Hotel Response · {new Date(reply.created_at).toLocaleDateString()}
                          </p>
                          <p className="text-sm text-gray-700 dark:text-gray-300">{reply.content}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Footer Actions */}
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center gap-4">
                    <button
                      onClick={() => handleHelpful(review.id)}
                      className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
                        review.user_found_helpful
                          ? 'text-sky-600 dark:text-sky-400'
                          : 'text-gray-500 dark:text-gray-400 hover:text-sky-600'
                      }`}
                    >
                      <FaThumbsUp className="text-xs" />
                      Helpful ({review.helpful_count})
                    </button>
                    {review.booking_reference && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        Booking: {review.booking_reference}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Back to Dashboard */}
        <div className="mt-8 text-center">
          <button onClick={() => navigate('/dashboard')} className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors">
            ← Back to Dashboard
          </button>
        </div>
      </div>

      {/* Lightbox Modal */}
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
              {/* Close */}
              <button
                onClick={() => setLightbox(null)}
                className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors z-10"
              >
                <FaTimes className="text-2xl" />
              </button>

              {/* Image */}
              <img
                src={lightbox.photos[lightbox.index].image_url}
                alt={lightbox.photos[lightbox.index].caption || 'Review photo'}
                className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
              />

              {/* Caption */}
              {lightbox.photos[lightbox.index].caption && (
                <p className="text-center text-white text-sm mt-3">{lightbox.photos[lightbox.index].caption}</p>
              )}

              {/* Counter */}
              <p className="text-center text-gray-400 text-xs mt-1">
                {lightbox.index + 1} / {lightbox.photos.length}
              </p>

              {/* Navigate */}
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

export default ReviewsPage;
