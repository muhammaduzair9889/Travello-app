import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaHotel, FaRedo, FaRobot,
  FaSearch, FaCheck, FaArrowRight
} from 'react-icons/fa';
import axios from 'axios';

const API_BASE = (process.env.REACT_APP_API_URL || process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000')
  .replace(/\/api\/?$/, '') + '/api';

/* ── AI Processing Loading Screen (clean, professional) ── */
const AILoadingScreen = ({ city, profile }) => {
  const [shimmer, setShimmer] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setShimmer(prev => (prev + 1) % 3);
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      {/* AI thinking animation */}
      <motion.div
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        className="w-28 h-28 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-2xl mb-8 relative"
      >
        <FaRobot className="text-white text-4xl" />
        {/* Orbiting dots */}
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            className="absolute w-3 h-3 bg-blue-300 rounded-full"
            animate={{
              x: [0, Math.cos((i * 120) * Math.PI / 180) * 55, 0],
              y: [0, Math.sin((i * 120) * Math.PI / 180) * 55, 0],
              opacity: [0.4, 1, 0.4],
            }}
            transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.4, ease: 'easeInOut' }}
          />
        ))}
      </motion.div>

      {/* Main message */}
      <AnimatePresence mode="wait">
        <motion.div
          key={shimmer}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {shimmer === 0 ? '✨ Our AI is preparing personalized hotel recommendations for your trip.' : shimmer === 1 ? '🔍 AI is finding the best hotels for you...' : '🏨 Analyzing your travel preferences and searching available options.'}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            This will only take a moment.
          </p>
        </motion.div>
      </AnimatePresence>

      {/* Shimmer progress bar */}
      <div className="w-full max-w-md h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-6">
        <motion.div
          className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-full"
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          style={{ width: '50%' }}
        />
      </div>

      {/* Profile summary */}
      {profile && Object.keys(profile).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 max-w-md w-full"
        >
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            Finding hotels for
          </p>
          <div className="flex flex-wrap gap-2">
            {profile.destination && (
              <span className="px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-full">
                📍 {profile.destination}
              </span>
            )}
            {profile.interests && (
              <span className="px-2.5 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-medium rounded-full">
                🎯 {profile.interests}
              </span>
            )}
            {profile.travel_style && (
              <span className="px-2.5 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-medium rounded-full">
                ✨ {profile.travel_style}
              </span>
            )}
            {profile.budget && (
              <span className="px-2.5 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-medium rounded-full">
                💰 {profile.budget}
              </span>
            )}
            {profile.guests && (
              <span className="px-2.5 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-medium rounded-full">
                👥 {profile.guests}
              </span>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};

/* ── AI Recommendation Card (no external links) ── */
const RecommendationCard = ({ hotel, index }) => {
  const price = hotel.price_per_night || hotel.double_bed_price_per_day || hotel.price || 0;
  const rating = typeof hotel.review_rating === 'number' ? hotel.review_rating
    : typeof hotel.rating === 'number' ? hotel.rating
    : parseFloat(hotel.review_rating || hotel.rating) || 0;
  const reviewCount = hotel.review_count || hotel.review_count_num || 0;
  const matchScore = hotel.match_score || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-start gap-4 bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700"
    >
      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-gray-900 dark:text-white text-sm truncate">{hotel.name}</h4>
        {hotel.ai_reason && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-start gap-1">
            <FaRobot className="shrink-0 text-blue-400 mt-0.5" />
            <span>{hotel.ai_reason}</span>
          </p>
        )}
        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
          {rating > 0 && <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded font-medium">{rating.toFixed(1)}</span>}
          {reviewCount > 0 && <span>{Number(reviewCount).toLocaleString()} reviews</span>}
          {matchScore > 0 && <span className="text-green-600 dark:text-green-400 font-medium">{Math.round(matchScore * 100)}% match</span>}
        </div>
      </div>
      {price > 0 && (
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-gray-900 dark:text-white">PKR {Number(price).toLocaleString()}</p>
          <p className="text-[10px] text-gray-400">per night</p>
        </div>
      )}
    </motion.div>
  );
};

/* ── Preference Interview Step ── */
const InterviewStep = ({ question, options, inputType, questionKey, onAnswer, stepNum, totalSteps }) => {
  const [selected, setSelected] = useState(inputType === 'multi' ? [] : '');
  const [dateInput, setDateInput] = useState('');

  const handleSubmit = () => {
    if (inputType === 'multi') {
      onAnswer(selected.join(', '));
    } else if (inputType === 'date') {
      onAnswer(dateInput || 'flexible');
    } else {
      onAnswer(selected);
    }
  };

  const toggleMulti = (opt) => {
    setSelected(prev =>
      prev.includes(opt) ? prev.filter(o => o !== opt) : [...prev, opt]
    );
  };

  const isReady = inputType === 'multi' ? selected.length > 0
    : inputType === 'date' ? true
    : !!selected;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-xl mx-auto"
    >
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
          <span>Step {stepNum + 1} of {totalSteps}</span>
          <span>{Math.round(((stepNum + 1) / totalSteps) * 100)}%</span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"
            initial={{ width: `${(stepNum / totalSteps) * 100}%` }}
            animate={{ width: `${((stepNum + 1) / totalSteps) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Question */}
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 text-center">
        {question}
      </h3>

      {/* Options */}
      {inputType === 'date' ? (
        <div className="space-y-3">
          <input
            type="date"
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-white text-center text-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
          <button
            onClick={() => onAnswer('flexible')}
            className="w-full px-4 py-2.5 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 text-sm hover:border-blue-400 hover:text-blue-500 transition-colors"
          >
            I'm flexible with dates
          </button>
        </div>
      ) : (
        <div className={`grid gap-3 ${options.length > 4 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {options.map(opt => {
            const isSelected = inputType === 'multi'
              ? selected.includes(opt)
              : selected === opt;

            return (
              <motion.button
                key={opt}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  if (inputType === 'multi') {
                    toggleMulti(opt);
                  } else {
                    setSelected(opt);
                  }
                }}
                className={`px-4 py-3 rounded-xl text-sm font-medium transition-all border-2 text-left flex items-center gap-3 ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shadow-md'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-blue-300 hover:bg-gray-50 dark:hover:bg-gray-750'
                }`}
              >
                <div className={`w-5 h-5 rounded-${inputType === 'multi' ? 'md' : 'full'} border-2 flex items-center justify-center shrink-0 ${
                  isSelected
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-gray-300 dark:border-gray-600'
                }`}>
                  {isSelected && <FaCheck className="text-white text-[10px]" />}
                </div>
                {opt}
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Continue button */}
      <motion.button
        onClick={handleSubmit}
        disabled={!isReady}
        whileHover={isReady ? { scale: 1.02 } : {}}
        whileTap={isReady ? { scale: 0.98 } : {}}
        className={`mt-6 w-full flex items-center justify-center gap-2 py-3 rounded-xl text-base font-semibold transition-all ${
          isReady
            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
            : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
        }`}
      >
        {stepNum < totalSteps - 1 ? (
          <>Continue <FaArrowRight /></>
        ) : (
          <>Find My Perfect Hotels <FaSearch /></>
        )}
      </motion.button>
    </motion.div>
  );
};

/* ── Main RecommendationWidget ── */
const RecommendationWidget = () => {
  const navigate = useNavigate();
  const [phase, setPhase] = useState('interview'); // interview | scraping | results
  const [sessionId, setSessionId] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [profile, setProfile] = useState({});
  const [hotels, setHotels] = useState([]);
  const [aiSummary, setAiSummary] = useState('');
  const [totalFound, setTotalFound] = useState(0);
  const [searchFilters, setSearchFilters] = useState(null);
  const [matchedAttractions, setMatchedAttractions] = useState([]);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  // Navigate to internal search results page with AI data
  const viewRecommendedHotels = useCallback(() => {
    navigate('/hotels/search-results', {
      state: {
        destination: searchFilters?.destination || profile.destination || 'Lahore',
        checkIn: searchFilters?.checkIn || '',
        checkOut: searchFilters?.checkOut || '',
        adults: searchFilters?.adults || 2,
        children: searchFilters?.children || 0,
        // AI recommendation data
        aiRecommendation: true,
        aiHotels: hotels,
        aiSummary: aiSummary,
        aiProfile: profile,
        aiTotalFound: totalFound,
        aiMatchedAttractions: matchedAttractions,
      },
    });
  }, [navigate, searchFilters, profile, hotels, aiSummary, totalFound, matchedAttractions]);

  // Start a new recommendation session
  const startSession = useCallback(async () => {
    setPhase('interview');
    setError(null);
    setHotels([]);
    setProfile({});
    setAiSummary('');
    setSessionId(null);
    setSearchFilters(null);
    setMatchedAttractions([]);

    try {
      const res = await axios.post(`${API_BASE}/recommendations/start/`, {}, { timeout: 15000 });
      const data = res.data;
      setSessionId(data.session_id);
      setCurrentQuestion({
        question: data.question,
        options: data.options,
        inputType: data.input_type,
        key: data.key,
        step: data.step,
        totalSteps: data.total_steps,
      });
    } catch (err) {
      setError('Failed to start recommendation session. Please try again.');
    }
  }, []);

  // Poll for scraping/ranking completion  
  const pollForResults = useCallback((sid) => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const res = await axios.get(`${API_BASE}/recommendations/status/${sid}/`, { timeout: 10000 });
        const data = res.data;

        if (data.status === 'done') {
          clearInterval(pollRef.current);
          pollRef.current = null;
          
          // Fetch final results
          const results = await axios.get(`${API_BASE}/recommendations/results/${sid}/`, { timeout: 15000 });
          const rData = results.data;
          
          setHotels(rData.hotels || []);
          setAiSummary(rData.ai_summary || '');
          setTotalFound(rData.total_found || 0);
          setProfile(rData.profile || {});
          setSearchFilters(rData.search_filters || null);
          setMatchedAttractions(rData.matched_attractions || []);
          setPhase('results');
        } else if (data.status === 'error') {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setError(data.error || 'Something went wrong. Please try again.');
          setPhase('results');
        }
        // scraping/ranking → keep polling
      } catch {
        // Network error — keep polling
      }
    }, 3000);
  }, []);

  // Submit an answer
  const submitAnswer = useCallback(async (answer) => {
    if (!sessionId) return;

    try {
      const res = await axios.post(`${API_BASE}/recommendations/answer/`, {
        session_id: sessionId,
        answer,
      }, { timeout: 30000 });

      const data = res.data;
      setProfile(data.profile || {});

      if (data.status === 'interviewing') {
        setCurrentQuestion({
          question: data.question,
          options: data.options,
          inputType: data.input_type,
          key: data.key,
          step: data.step,
          totalSteps: data.total_steps,
        });
      } else if (data.status === 'scraping' || data.status === 'ranking') {
        setPhase('scraping');
        pollForResults(sessionId);
      }
    } catch (err) {
      setError('Failed to process your answer. Please try again.');
    }
  }, [sessionId, pollForResults]);

  // Initialize on mount
  useEffect(() => {
    startSession();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [startSession]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FaRobot className="text-blue-500" /> AI Hotel Recommendations
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {phase === 'interview' && 'Tell us your preferences and we\'ll find the perfect hotels'}
            {phase === 'scraping' && 'AI is analyzing your preferences...'}
            {phase === 'results' && 'Your personalized recommendations are ready!'}
          </p>
        </div>
        {phase === 'results' && (
          <button
            onClick={startSession}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <FaRedo /> New Search
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl p-4 text-center"
        >
          <p className="text-red-600 dark:text-red-400 text-sm mb-3">{error}</p>
          <button
            onClick={startSession}
            className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
          >
            Start Over
          </button>
        </motion.div>
      )}

      {/* ── Phase: Interview ── */}
      <AnimatePresence mode="wait">
        {phase === 'interview' && currentQuestion && !error && (
          <motion.div
            key={`q-${currentQuestion.step}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 md:p-8 shadow-sm">
              <InterviewStep
                question={currentQuestion.question}
                options={currentQuestion.options}
                inputType={currentQuestion.inputType}
                questionKey={currentQuestion.key}
                stepNum={currentQuestion.step}
                totalSteps={currentQuestion.totalSteps}
                onAnswer={submitAnswer}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Phase: AI Processing (clean loading) ── */}
      {phase === 'scraping' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <AILoadingScreen city={profile.destination} profile={profile} />
        </div>
      )}

      {/* ── Phase: Results (AI summary + redirect to internal results page) ── */}
      {phase === 'results' && !error && hotels.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-5"
        >
          {/* AI Summary */}
          {aiSummary && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-5">
              <div className="flex gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center shrink-0">
                  <FaRobot className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">AI Analysis</p>
                  <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">{aiSummary}</p>
                </div>
              </div>
            </div>
          )}

          {/* Matched attractions info */}
          {matchedAttractions.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Nearby attractions matching your interests:</strong>{' '}
                {matchedAttractions.join(', ')}
              </p>
            </div>
          )}

          {/* Quick preview of top 5 hotels */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Top {Math.min(hotels.length, 5)} of {hotels.length} AI-ranked hotels
              {totalFound > 0 && <span className="text-gray-400"> (from {totalFound} available)</span>}
            </p>
            {hotels.slice(0, 5).map((hotel, idx) => (
              <RecommendationCard key={hotel.name || idx} hotel={hotel} index={idx} />
            ))}
          </div>

          {/* View Recommended Hotels button */}
          <motion.button
            onClick={viewRecommendedHotels}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-base font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all"
          >
            <FaSearch /> View Recommended Hotels <FaArrowRight />
          </motion.button>

          {/* Data source badge */}
          <div className="text-center">
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs rounded-full">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              AI-powered recommendations by Travello
            </span>
          </div>
        </motion.div>
      )}

      {/* Empty results */}
      {phase === 'results' && !error && hotels.length === 0 && (
        <div className="text-center py-16 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
          <FaHotel className="text-4xl text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">No hotels found</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1 mb-4">
            We couldn't find hotels matching your criteria. Try different preferences.
          </p>
          <button
            onClick={startSession}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
};

export default RecommendationWidget;
