import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FaStar, FaArrowLeft, FaSpellCheck, FaCheck, FaTimes, FaPaperPlane, FaMagic, FaCamera, FaTrash, FaCloudUploadAlt } from 'react-icons/fa';
import { reviewAPI, bookingAPI } from '../services/api';

const ASPECT_LABELS = {
  cleanliness_rating: { label: 'Cleanliness', icon: '🧹' },
  service_rating: { label: 'Service', icon: '🛎️' },
  location_rating: { label: 'Location', icon: '📍' },
  value_rating: { label: 'Value for Money', icon: '💰' },
  amenities_rating: { label: 'Amenities', icon: '🏊' },
};

const TRIP_TYPES = [
  { value: 'business', label: 'Business', icon: '💼' },
  { value: 'couple', label: 'Couple', icon: '❤️' },
  { value: 'family', label: 'Family', icon: '👨‍👩‍👧‍👦' },
  { value: 'friends', label: 'Friends', icon: '👫' },
  { value: 'solo', label: 'Solo', icon: '🧳' },
];

const StarRating = ({ value, onChange, size = 'text-2xl', disabled = false }) => {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          className={`${size} transition-all duration-150 ${disabled ? 'cursor-default' : 'cursor-pointer hover:scale-110'}`}
          onMouseEnter={() => !disabled && setHover(star)}
          onMouseLeave={() => !disabled && setHover(0)}
          onClick={() => !disabled && onChange(star)}
        >
          <FaStar
            className={
              (hover || value) >= star
                ? 'text-amber-400 drop-shadow-sm'
                : 'text-gray-300 dark:text-gray-600'
            }
          />
        </button>
      ))}
    </div>
  );
};

const ReviewForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get('booking');
  const editId = searchParams.get('edit');

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Form state
  const [overallRating, setOverallRating] = useState(0);
  const [aspects, setAspects] = useState({
    cleanliness_rating: 0,
    service_rating: 0,
    location_rating: 0,
    value_rating: 0,
    amenities_rating: 0,
  });
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tripType, setTripType] = useState('');

  // AI grammar & spelling state
  const [correctedText, setCorrectedText] = useState('');
  const [hasCorrections, setHasCorrections] = useState(false);
  const [checkingSpelling, setCheckingSpelling] = useState(false);
  const [spellingChecked, setSpellingChecked] = useState(false);

  // Photo upload state
  const [selectedFiles, setSelectedFiles] = useState([]);    // File objects
  const [previews, setPreviews] = useState([]);               // {file, url} for thumbnails
  const [existingPhotos, setExistingPhotos] = useState([]);   // Photos already saved (edit mode)
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const MAX_PHOTOS = 5;
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  // Generate preview URLs when files change
  useEffect(() => {
    const newPreviews = selectedFiles.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));
    setPreviews(newPreviews);
    return () => newPreviews.forEach((p) => URL.revokeObjectURL(p.url));
  }, [selectedFiles]);

  const addFiles = useCallback((files) => {
    setPhotoError('');
    const incoming = Array.from(files);
    const totalAfter = selectedFiles.length + existingPhotos.length + incoming.length;
    if (totalAfter > MAX_PHOTOS) {
      setPhotoError(`Maximum ${MAX_PHOTOS} photos allowed. You can add ${MAX_PHOTOS - selectedFiles.length - existingPhotos.length} more.`);
      return;
    }
    for (const f of incoming) {
      if (!ALLOWED_TYPES.includes(f.type)) {
        setPhotoError(`Invalid file type: ${f.name}. Only JPEG, PNG, and WebP are allowed.`);
        return;
      }
      if (f.size > MAX_FILE_SIZE) {
        setPhotoError(`File "${f.name}" exceeds 5 MB limit.`);
        return;
      }
    }
    setSelectedFiles((prev) => [...prev, ...incoming]);
  }, [selectedFiles.length, existingPhotos.length]);

  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPhotoError('');
  };

  const removeExistingPhoto = (index) => {
    setExistingPhotos((prev) => prev.filter((_, i) => i !== index));
    setPhotoError('');
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);

  // Load booking/review data
  useEffect(() => {
    const loadData = async () => {
      try {
        if (editId) {
          const res = await reviewAPI.get(editId);
          const r = res.data;
          setOverallRating(r.overall_rating);
          setAspects({
            cleanliness_rating: r.cleanliness_rating || 0,
            service_rating: r.service_rating || 0,
            location_rating: r.location_rating || 0,
            value_rating: r.value_rating || 0,
            amenities_rating: r.amenities_rating || 0,
          });
          setTitle(r.title);
          setContent(r.content);
          setTripType(r.trip_type || '');
          setBooking({ id: r.booking, hotel_details: { name: r.hotel_name, city: r.hotel_city, image: r.hotel_image } });
          if (r.photos?.length) setExistingPhotos(r.photos);
        } else if (bookingId) {
          const res = await bookingAPI.getBooking(bookingId);
          setBooking(res.data);
        }
      } catch (err) {
        setError('Failed to load booking details.');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [bookingId, editId]);

  // AI grammar & spelling check
  const checkSpelling = useCallback(async () => {
    if (!content || content.length < 10) {
      setCorrectedText('');
      setHasCorrections(false);
      return;
    }
    setCheckingSpelling(true);
    try {
      // Send title and content separately so we can split them back
      const titleRes = title.trim()
        ? await reviewAPI.autocorrect(title)
        : { data: { corrected_text: title, has_corrections: false } };
      const contentRes = await reviewAPI.autocorrect(content);

      const titleCorrected = titleRes.data.corrected_text || title;
      const contentCorrected = contentRes.data.corrected_text || content;
      const anyChanges = titleRes.data.has_corrections || contentRes.data.has_corrections;

      setCorrectedText(JSON.stringify({ title: titleCorrected, content: contentCorrected }));
      setHasCorrections(anyChanges);
      setSpellingChecked(true);
    } catch {
      // Silently ignore failures
    } finally {
      setCheckingSpelling(false);
    }
  }, [title, content]);

  const applyCorrections = () => {
    try {
      const parsed = JSON.parse(correctedText);
      if (parsed.title) setTitle(parsed.title);
      if (parsed.content) setContent(parsed.content);
      setHasCorrections(false);
      setSpellingChecked(false);
    } catch { /* ignore */ }
  };

  const dismissCorrections = () => {
    setHasCorrections(false);
    setCorrectedText('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!overallRating) {
      setError('Please provide an overall rating.');
      return;
    }
    if (!title.trim()) {
      setError('Please provide a review title.');
      return;
    }
    if (!content.trim() || content.trim().split(/\s+/).length < 5) {
      setError('Please write at least 5 words in your review.');
      return;
    }

    setSubmitting(true);

    // Upload new photos to Cloudinary first
    let uploadedPhotoUrls = [];
    if (selectedFiles.length > 0) {
      setUploadingPhotos(true);
      try {
        const res = await reviewAPI.uploadPhotos(selectedFiles);
        uploadedPhotoUrls = res.data.uploaded.map((u) => ({ image_url: u.image_url }));
      } catch (err) {
        const msg = err.response?.data?.error || 'Failed to upload photos. Please try again.';
        setError(msg);
        setSubmitting(false);
        setUploadingPhotos(false);
        return;
      }
      setUploadingPhotos(false);
    }

    // Combine existing photos (edit mode) with newly uploaded ones
    const allPhotos = [
      ...existingPhotos.map((p) => ({ image_url: p.image_url, caption: p.caption || '' })),
      ...uploadedPhotoUrls,
    ];

    const payload = {
      overall_rating: overallRating,
      title: title.trim(),
      content: content.trim(),
      trip_type: tripType || undefined,
    };

    // Add non-zero aspect ratings
    Object.entries(aspects).forEach(([key, val]) => {
      if (val > 0) payload[key] = val;
    });

    if (!editId) {
      payload.booking = parseInt(bookingId, 10);
    }

    // Include photos if any
    if (allPhotos.length > 0) {
      payload.photos = allPhotos;
    } else if (editId) {
      // If editing and all photos were removed, send empty array to clear them
      payload.photos = [];
    }

    try {
      if (editId) {
        await reviewAPI.update(editId, payload);
      } else {
        await reviewAPI.create(payload);
      }
      setSuccess(true);
      setTimeout(() => navigate('/my-reviews'), 1500);
    } catch (err) {
      const detail = err.response?.data;
      if (typeof detail === 'object') {
        const messages = Object.values(detail).flat().join(' ');
        setError(messages || 'Failed to submit review.');
      } else {
        setError('Failed to submit review. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-sky-600"></div>
      </div>
    );
  }

  if (!bookingId && !editId) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center bg-white dark:bg-gray-800 p-10 rounded-2xl shadow-xl">
          <div className="text-6xl mb-4">📝</div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Select a Booking</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">Please select a completed booking to write a review.</p>
          <button onClick={() => navigate('/my-reviews')} className="px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium transition-colors">
            Go to My Reviews
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center bg-white dark:bg-gray-800 p-10 rounded-2xl shadow-xl">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
            {editId ? 'Review Updated!' : 'Review Submitted!'}
          </h2>
          <p className="text-gray-600 dark:text-gray-400">Redirecting to your reviews...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-sky-600 mb-4 transition-colors">
            <FaArrowLeft /> Back
          </button>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
            {editId ? 'Edit Your Review' : 'Write a Review'}
          </h1>
          {booking && (
            <div className="mt-3 flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl shadow">
              {booking.hotel_details?.image && (
                <img src={booking.hotel_details.image} alt="" className="w-16 h-16 rounded-lg object-cover" />
              )}
              <div>
                <p className="font-bold text-gray-800 dark:text-white">{booking.hotel_details?.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{booking.hotel_details?.city}</p>
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg">
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Overall Rating */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-3">Overall Rating *</h2>
            <div className="flex items-center gap-4">
              <StarRating value={overallRating} onChange={setOverallRating} size="text-3xl" />
              {overallRating > 0 && (
                <span className="text-lg font-semibold text-amber-500">{overallRating}/5</span>
              )}
            </div>
          </div>

          {/* Aspect Ratings */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Rate Specific Aspects</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Object.entries(ASPECT_LABELS).map(([key, { label, icon }]) => (
                <div key={key} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {icon} {label}
                  </span>
                  <StarRating
                    value={aspects[key]}
                    onChange={(val) => setAspects((prev) => ({ ...prev, [key]: val }))}
                    size="text-lg"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Trip Type */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-3">Trip Type</h2>
            <div className="flex flex-wrap gap-3">
              {TRIP_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTripType(tripType === t.value ? '' : t.value)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    tripType === t.value
                      ? 'bg-sky-600 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title & Content */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Review Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => { setTitle(e.target.value); setSpellingChecked(false); }}
                placeholder="Summarize your experience..."
                maxLength={200}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-shadow"
              />
              <p className="text-xs text-gray-500 mt-1">{title.length}/200</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Your Review *</label>
              <textarea
                value={content}
                onChange={(e) => { setContent(e.target.value); setSpellingChecked(false); }}
                placeholder="Share details of your experience — what did you love? what could be improved?"
                rows={6}
                maxLength={5000}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-shadow resize-y"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>{content.split(/\s+/).filter(Boolean).length} words</span>
                <span>{content.length}/5000</span>
              </div>
            </div>

            {/* AI Grammar & Spelling Check */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={checkSpelling}
                disabled={checkingSpelling || content.length < 10}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FaMagic />
                {checkingSpelling ? 'AI Checking...' : spellingChecked ? 'Re-check Grammar' : 'Check Grammar & Spelling'}
              </button>
              {spellingChecked && !hasCorrections && (
                <span className="text-green-600 dark:text-green-400 text-sm flex items-center gap-1">
                  <FaCheck /> Perfect — no issues found!
                </span>
              )}
            </div>

            {/* AI Correction Preview */}
            <AnimatePresence>
              {hasCorrections && correctedText && (() => {
                try {
                  const parsed = JSON.parse(correctedText);
                  return (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-3">
                      <p className="text-sm font-medium text-purple-600 dark:text-purple-400 flex items-center gap-2">
                        <FaMagic /> AI found grammar & spelling improvements:
                      </p>
                      <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl space-y-3">
                        {parsed.title && parsed.title !== title && (
                          <div>
                            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">TITLE</p>
                            <p className="text-sm text-red-500 line-through mb-1">{title}</p>
                            <p className="text-sm text-green-600 dark:text-green-400 font-medium">{parsed.title}</p>
                          </div>
                        )}
                        {parsed.content && parsed.content !== content && (
                          <div>
                            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">REVIEW</p>
                            <p className="text-sm text-red-500 line-through mb-1">{content}</p>
                            <p className="text-sm text-green-600 dark:text-green-400 font-medium">{parsed.content}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-3">
                        <button type="button" onClick={applyCorrections} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors">
                          <FaCheck /> Apply Corrections
                        </button>
                        <button type="button" onClick={dismissCorrections} className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                          <FaTimes /> Keep Original
                        </button>
                      </div>
                    </motion.div>
                  );
                } catch { return null; }
              })()}
            </AnimatePresence>
          </div>

          {/* Photo Upload */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
              <FaCamera className="text-sky-600" /> Add Photos
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Upload up to {MAX_PHOTOS} photos (JPEG, PNG, or WebP, max 5 MB each)
            </p>

            {/* Existing photos (edit mode) */}
            {existingPhotos.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">CURRENT PHOTOS</p>
                <div className="flex flex-wrap gap-3">
                  {existingPhotos.map((photo, idx) => (
                    <div key={photo.id || idx} className="relative group">
                      <img
                        src={photo.image_url}
                        alt={photo.caption || 'Review photo'}
                        className="w-24 h-24 rounded-lg object-cover border-2 border-gray-200 dark:border-gray-600"
                      />
                      <button
                        type="button"
                        onClick={() => removeExistingPhoto(idx)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                      >
                        <FaTimes />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* New file previews */}
            {previews.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">NEW PHOTOS</p>
                <div className="flex flex-wrap gap-3">
                  {previews.map((p, idx) => (
                    <div key={idx} className="relative group">
                      <img
                        src={p.url}
                        alt={`Preview ${idx + 1}`}
                        className="w-24 h-24 rounded-lg object-cover border-2 border-sky-300 dark:border-sky-600"
                      />
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                      >
                        <FaTimes />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] text-center py-0.5 rounded-b-lg truncate px-1">
                        {(p.file.size / 1024 / 1024).toFixed(1)} MB
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Drop zone */}
            {(selectedFiles.length + existingPhotos.length) < MAX_PHOTOS && (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  dragOver
                    ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-sky-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <FaCloudUploadAlt className="mx-auto text-3xl text-gray-400 dark:text-gray-500 mb-2" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium text-sky-600 dark:text-sky-400">Click to upload</span> or drag & drop
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {MAX_PHOTOS - selectedFiles.length - existingPhotos.length} photo(s) remaining
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ''; }}
                />
              </div>
            )}

            {/* Photo error */}
            {photoError && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{photoError}</p>
            )}
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-4">
            <button type="button" onClick={() => navigate(-1)} className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
              Cancel
            </button>
            <motion.button
              type="submit"
              disabled={submitting || !overallRating || !title.trim() || !content.trim()}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-8 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-semibold flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              <FaPaperPlane />
              {uploadingPhotos ? 'Uploading Photos...' : submitting ? 'Submitting...' : editId ? 'Update Review' : 'Submit Review'}
            </motion.button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReviewForm;
