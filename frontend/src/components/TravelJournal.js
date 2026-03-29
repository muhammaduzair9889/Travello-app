import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaArrowLeft, 
  FaPlus, 
  FaEdit, 
  FaTrash, 
  FaSave, 
  FaTimes,
  FaMapMarkerAlt,
  FaCalendarAlt,
  FaMagic,
  FaSpinner,
  FaCheck,
  FaSearch,
  FaStar,
  FaHeart,
  FaShare,
  FaDownload
} from 'react-icons/fa';
import { 
  Notebook, 
  Sparkles, 
  MapPin, 
  Calendar,
  FileText,
  BookOpen,
  PenTool,
  Wand2
} from 'lucide-react';
import { chatAPI } from '../services/api';

// Sample journal categories
const journalCategories = [
  { id: 'all', name: 'All Entries', icon: BookOpen, color: 'bg-primary-500' },
  { id: 'trip', name: 'Trip Reports', icon: MapPin, color: 'bg-success-500' },
  { id: 'food', name: 'Food & Dining', icon: Sparkles, color: 'bg-warning-500' },
  { id: 'adventure', name: 'Adventures', icon: Sparkles, color: 'bg-danger-500' },
  { id: 'culture', name: 'Culture & History', icon: BookOpen, color: 'bg-purple-500' },
];

// Mood options for journal
const moodOptions = [
  { emoji: '😊', label: 'Happy' },
  { emoji: '🤩', label: 'Excited' },
  { emoji: '😌', label: 'Peaceful' },
  { emoji: '🥰', label: 'Loving' },
  { emoji: '🤔', label: 'Thoughtful' },
  { emoji: '😴', label: 'Tired' },
];

// Local storage key
const JOURNAL_STORAGE_KEY = 'travello_journal_entries';

// Get initial entries from localStorage or use defaults
const getInitialEntries = () => {
  try {
    const stored = localStorage.getItem(JOURNAL_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error loading journal entries:', e);
  }
  
  // Default entries for Pakistan Famous Places
  return [
    {
      id: 1,
      title: 'Badshahi Mosque Visit',
      content: 'The magnificent Badshahi Mosque left me in awe of Mughal architecture. The red sandstone structure with its massive courtyard can hold over 55,000 worshippers. I visited during sunset and the golden light illuminating the marble domes was absolutely breathtaking. The intricate calligraphy and floral frescoes inside are masterfully done.',
      date: '2025-10-15',
      location: 'Lahore, Pakistan',
      category: 'culture',
      mood: '🤩',
      images: [],
      isFavorite: true,
      isAutoLogged: false,
    },
    {
      id: 2,
      title: 'Exploring Lahore Fort',
      content: 'Walked through the historic Shahi Qila and saw the beautiful Sheesh Mahal (Palace of Mirrors). The fort spans over 20 hectares and houses numerous gardens, halls, and palaces. The Alamgiri Gate is impressive! I spent hours admiring the intricate mirror work that reflects light in magical patterns.',
      date: '2025-10-12',
      location: 'Lahore Fort, Lahore',
      category: 'trip',
      mood: '😊',
      images: [],
      isFavorite: true,
      isAutoLogged: false,
    },
    {
      id: 3,
      title: 'Minar-e-Pakistan',
      content: 'Visited the iconic national monument in Greater Iqbal Park. The 60-meter tall tower commemorates the Lahore Resolution. The surrounding park has beautiful fountains and gardens. I took so many photos! The light show at night was spectacular.',
      date: '2025-10-08',
      location: 'Greater Iqbal Park, Lahore',
      category: 'culture',
      mood: '🥰',
      images: [],
      isFavorite: false,
      isAutoLogged: false,
    },
    {
      id: 4,
      title: 'Food Street Adventure',
      content: 'Had an amazing culinary experience at Fort Road Food Street! Tried the famous Lahori karahi, seekh kababs, and ended with some delicious kulfi. The view of Badshahi Mosque from the rooftop restaurants is unmatched. The aroma of spices in the air was intoxicating!',
      date: '2025-10-05',
      location: 'Food Street, Lahore',
      category: 'food',
      mood: '😊',
      images: [],
      isFavorite: true,
      isAutoLogged: true,
    },
  ];
};

// AI Text Assistant Component
const AITextAssistant = ({ text, onApply, onClose }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedAction, setSelectedAction] = useState(null);
  const [improvedText, setImprovedText] = useState('');

  const aiActions = [
    { id: 'grammar', label: 'Fix Grammar & Spelling', icon: PenTool, prompt: 'Please correct the grammar, spelling, and punctuation in the following text. Keep the meaning same but make it grammatically correct:' },
    { id: 'enhance', label: 'Enhance Writing', icon: Wand2, prompt: 'Please enhance and improve the following travel journal text. Make it more descriptive and engaging while keeping the original meaning:' },
    { id: 'summarize', label: 'Summarize', icon: FileText, prompt: 'Please provide a concise summary of the following travel journal entry:' },
    { id: 'expand', label: 'Expand & Add Details', icon: Sparkles, prompt: 'Please expand the following travel journal text with more vivid descriptions and sensory details:' },
  ];

  const handleAIAction = async (action) => {
    if (!text.trim()) return;
    
    setSelectedAction(action.id);
    setIsProcessing(true);
    
    try {
      const response = await chatAPI.sendMessage(`${action.prompt}\n\n"${text}"`);
      const reply = response?.data?.reply || '';
      setImprovedText(reply);
    } catch (error) {
      console.error('AI assistance error:', error);
      setImprovedText('Sorry, I could not process your request. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-white dark:bg-surface-900 rounded-2xl shadow-soft-xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-gray-200 dark:border-surface-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-600 to-accent-600 p-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg">AI Writing Assistant</h3>
                <p className="text-sm text-white/80">Enhance your journal entry with AI</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <FaTimes />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Original Text Preview */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Your Text:
            </label>
            <div className="p-4 bg-gray-50 dark:bg-surface-800 rounded-xl border border-gray-200 dark:border-surface-700 text-sm text-gray-600 dark:text-gray-400 max-h-32 overflow-y-auto">
              {text || 'No text selected'}
            </div>
          </div>

          {/* AI Actions */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Choose an action:
            </label>
            <div className="grid grid-cols-2 gap-3">
              {aiActions.map((action) => (
                <motion.button
                  key={action.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleAIAction(action)}
                  disabled={isProcessing}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    selectedAction === action.id
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-200 dark:border-surface-700 hover:border-primary-300 dark:hover:border-primary-600'
                  } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      selectedAction === action.id
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 dark:bg-surface-700 text-gray-600 dark:text-gray-400'
                    }`}>
                      <action.icon className="w-5 h-5" />
                    </div>
                    <span className="font-medium text-gray-800 dark:text-gray-200">
                      {action.label}
                    </span>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Processing Indicator */}
          {isProcessing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center gap-3 py-8"
            >
              <FaSpinner className="w-6 h-6 text-primary-500 animate-spin" />
              <span className="text-gray-600 dark:text-gray-400">AI is processing your text...</span>
            </motion.div>
          )}

          {/* Result */}
          {improvedText && !isProcessing && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4"
            >
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                AI Suggestion:
              </label>
              <div className="p-4 bg-gradient-to-r from-primary-50 to-accent-50 dark:from-primary-900/20 dark:to-accent-900/20 rounded-xl border border-primary-200 dark:border-primary-800">
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {improvedText}
                </p>
              </div>
            </motion.div>
          )}
        </div>

        {/* Footer Actions */}
        {improvedText && !isProcessing && (
          <div className="p-4 border-t border-gray-200 dark:border-surface-700 bg-gray-50 dark:bg-surface-800 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={() => onApply(improvedText)}
              className="flex-1 btn-primary flex items-center justify-center gap-2"
            >
              <FaCheck />
              Apply Changes
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

// Journal Entry Editor Modal
const JournalEditor = ({ entry, onSave, onClose, isNew }) => {
  const [formData, setFormData] = useState({
    title: entry?.title || '',
    content: entry?.content || '',
    date: entry?.date || new Date().toISOString().split('T')[0],
    location: entry?.location || '',
    category: entry?.category || 'trip',
    mood: entry?.mood || '😊',
    images: entry?.images || [],
    isFavorite: entry?.isFavorite || false,
    isAutoLogged: entry?.isAutoLogged || false,
  });
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef(null);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      alert('Please enter a title and content for your journal entry.');
      return;
    }
    
    setIsSaving(true);
    // Simulate save delay for animation
    await new Promise(resolve => setTimeout(resolve, 500));
    
    onSave({
      ...formData,
      id: entry?.id || Date.now(),
    });
    setIsSaving(false);
  };

  const handleAIApply = (newText) => {
    setFormData(prev => ({ ...prev, content: newText }));
    setShowAIAssistant(false);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-white dark:bg-surface-900 rounded-2xl shadow-soft-xl w-full max-w-3xl max-h-[90vh] overflow-hidden border border-gray-200 dark:border-surface-700"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-primary-600 to-primary-700 p-5 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Notebook className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">
                    {isNew ? 'Create New Entry' : 'Edit Entry'}
                  </h3>
                  <p className="text-sm text-white/80">Document your travel memories</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <FaTimes />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[65vh]">
            {/* Title */}
            <div className="mb-5">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="Give your entry a memorable title..."
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Date & Location Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  <FaCalendarAlt className="inline mr-2" />
                  Date
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleChange('date', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  <FaMapMarkerAlt className="inline mr-2" />
                  Location
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => handleChange('location', e.target.value)}
                  placeholder="Where were you?"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Category & Mood Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => handleChange('category', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                >
                  {journalCategories.filter(c => c.id !== 'all').map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  How did you feel?
                </label>
                <div className="flex gap-2 flex-wrap">
                  {moodOptions.map((mood) => (
                    <motion.button
                      key={mood.label}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleChange('mood', mood.emoji)}
                      className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all ${
                        formData.mood === mood.emoji
                          ? 'bg-primary-100 dark:bg-primary-900/30 ring-2 ring-primary-500'
                          : 'bg-gray-100 dark:bg-surface-700 hover:bg-gray-200 dark:hover:bg-surface-600'
                      }`}
                      title={mood.label}
                    >
                      {mood.emoji}
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>

            {/* Content with AI Button */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Your Story *
                </label>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowAIAssistant(true)}
                  disabled={!formData.content.trim()}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    formData.content.trim()
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 shadow-md'
                      : 'bg-gray-200 dark:bg-surface-700 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <FaMagic className="w-4 h-4" />
                  AI Assistant
                </motion.button>
              </div>
              <textarea
                ref={textareaRef}
                value={formData.content}
                onChange={(e) => handleChange('content', e.target.value)}
                placeholder="Write about your experience... What did you see, feel, taste? What made this moment special?"
                rows={8}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                💡 Tip: Click "AI Assistant" to improve your writing with grammar fixes or enhanced descriptions
              </p>
            </div>

            {/* Favorite Toggle */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleChange('isFavorite', !formData.isFavorite)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                  formData.isFavorite
                    ? 'bg-danger-100 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400'
                    : 'bg-gray-100 dark:bg-surface-700 text-gray-600 dark:text-gray-400'
                }`}
              >
                <FaHeart className={formData.isFavorite ? 'text-danger-500' : ''} />
                {formData.isFavorite ? 'Favorited' : 'Add to Favorites'}
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 dark:border-surface-700 bg-gray-50 dark:bg-surface-800 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 btn-secondary"
            >
              Cancel
            </button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 btn-primary flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <FaSpinner className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <FaSave />
                  Save Entry
                </>
              )}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>

      {/* AI Assistant Modal */}
      <AnimatePresence>
        {showAIAssistant && (
          <AITextAssistant
            text={formData.content}
            onApply={handleAIApply}
            onClose={() => setShowAIAssistant(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
};

// Journal Entry Card Component
const JournalEntryCard = ({ entry, onEdit, onDelete, onToggleFavorite }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const getCategoryStyle = (category) => {
    const styles = {
      'trip': 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
      'food': 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
      'adventure': 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
      'culture': 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    };
    return styles[category] || 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400';
  };

  const getCategoryName = (category) => {
    const cat = journalCategories.find(c => c.id === category);
    return cat?.name || 'Trip Reports';
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -4 }}
      className="card p-6 group relative overflow-hidden"
    >
      {/* Auto-logged badge */}
      {entry.isAutoLogged && (
        <div className="absolute top-3 right-3">
          <span className="px-2 py-1 bg-accent-100 dark:bg-accent-900/30 text-accent-600 dark:text-accent-400 text-xs font-medium rounded-full">
            Auto-logged
          </span>
        </div>
      )}

      {/* Favorite star */}
      {entry.isFavorite && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-3 left-3"
        >
          <FaStar className="text-yellow-500 w-5 h-5" />
        </motion.div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-4 mt-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getCategoryStyle(entry.category)}`}>
              {getCategoryName(entry.category)}
            </span>
            <span className="text-xl">{entry.mood}</span>
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white font-display">
            {entry.title}
          </h3>
        </div>
      </div>

      {/* Meta info */}
      <div className="flex items-center gap-4 mb-4 text-sm text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-1">
          <Calendar className="w-4 h-4" />
          <span>{new Date(entry.date).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
          })}</span>
        </div>
        {entry.location && (
          <div className="flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            <span className="truncate max-w-[150px]">{entry.location}</span>
          </div>
        )}
      </div>

      {/* Content Preview */}
      <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-3 mb-4">
        {entry.content}
      </p>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-surface-700">
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onToggleFavorite(entry.id)}
            className={`p-2 rounded-lg transition-colors ${
              entry.isFavorite
                ? 'text-danger-500 bg-danger-100 dark:bg-danger-900/30'
                : 'text-gray-400 hover:text-danger-500 hover:bg-gray-100 dark:hover:bg-surface-700'
            }`}
          >
            <FaHeart />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="p-2 rounded-lg text-gray-400 hover:text-primary-500 hover:bg-gray-100 dark:hover:bg-surface-700 transition-colors"
          >
            <FaShare />
          </motion.button>
        </div>

        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onEdit(entry)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
          >
            <FaEdit />
            Edit
          </motion.button>

          {showDeleteConfirm ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onDelete(entry.id)}
                className="px-3 py-2 rounded-lg text-sm font-medium bg-danger-500 text-white hover:bg-danger-600 transition-colors"
              >
                Confirm
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors"
            >
              <FaTrash />
              Delete
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// Main Travel Journal Component
const TravelJournal = () => {
  const navigate = useNavigate();
  const [entries, setEntries] = useState(getInitialEntries);
  const [filteredEntries, setFilteredEntries] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Save entries to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(entries));
  }, [entries]);

  // Filter entries based on category and search
  useEffect(() => {
    let filtered = [...entries];
    
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(e => e.category === selectedCategory);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(e => 
        e.title.toLowerCase().includes(query) ||
        e.content.toLowerCase().includes(query) ||
        e.location?.toLowerCase().includes(query)
      );
    }
    
    // Sort by date (newest first)
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    setFilteredEntries(filtered);
    setIsLoading(false);
  }, [entries, selectedCategory, searchQuery]);

  const handleSaveEntry = (entryData) => {
    if (editingEntry) {
      // Update existing entry
      setEntries(prev => prev.map(e => 
        e.id === entryData.id ? entryData : e
      ));
    } else {
      // Add new entry
      setEntries(prev => [entryData, ...prev]);
    }
    setShowEditor(false);
    setEditingEntry(null);
  };

  const handleEditEntry = (entry) => {
    setEditingEntry(entry);
    setShowEditor(true);
  };

  const handleDeleteEntry = (entryId) => {
    setEntries(prev => prev.filter(e => e.id !== entryId));
  };

  const handleToggleFavorite = (entryId) => {
    setEntries(prev => prev.map(e => 
      e.id === entryId ? { ...e, isFavorite: !e.isFavorite } : e
    ));
  };

  const handleNewEntry = () => {
    setEditingEntry(null);
    setShowEditor(true);
  };

  const handleExportEntries = () => {
    const dataStr = JSON.stringify(entries, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `travel-journal-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const stats = {
    total: entries.length,
    favorites: entries.filter(e => e.isFavorite).length,
    thisMonth: entries.filter(e => {
      const entryDate = new Date(e.date);
      const now = new Date();
      return entryDate.getMonth() === now.getMonth() && 
             entryDate.getFullYear() === now.getFullYear();
    }).length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-30 bg-white/80 dark:bg-surface-900/80 backdrop-blur-lg border-b border-gray-200 dark:border-surface-700"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/dashboard')}
                className="p-2 rounded-xl bg-gray-100 dark:bg-surface-800 hover:bg-gray-200 dark:hover:bg-surface-700 transition-colors"
              >
                <FaArrowLeft className="text-gray-600 dark:text-gray-400" />
              </motion.button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-display flex items-center gap-2">
                  <Notebook className="w-7 h-7 text-primary-500" />
                  Travel Journal
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Document your adventures and memories
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleExportEntries}
                className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-surface-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-800 transition-colors"
              >
                <FaDownload />
                Export
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleNewEntry}
                className="btn-primary flex items-center gap-2"
              >
                <FaPlus />
                <span className="hidden sm:inline">New Entry</span>
              </motion.button>
            </div>
          </div>
        </div>
      </motion.header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8"
        >
          <div className="card p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Entries</p>
            </div>
          </div>

          <div className="card p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-danger-100 dark:bg-danger-900/30 flex items-center justify-center">
              <FaHeart className="w-6 h-6 text-danger-600 dark:text-danger-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.favorites}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Favorites</p>
            </div>
          </div>

          <div className="card p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-success-100 dark:bg-success-900/30 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-success-600 dark:text-success-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.thisMonth}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">This Month</p>
            </div>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="card p-4 mb-6"
        >
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search entries..."
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Category Filters */}
            <div className="flex flex-wrap gap-2">
              {journalCategories.map((cat) => (
                <motion.button
                  key={cat.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    selectedCategory === cat.id
                      ? `${cat.color} text-white shadow-md`
                      : 'bg-gray-100 dark:bg-surface-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-surface-600'
                  }`}
                >
                  {cat.name}
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Entries Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <FaSpinner className="w-8 h-8 text-primary-500 animate-spin" />
          </div>
        ) : filteredEntries.length > 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            <AnimatePresence mode="popLayout">
              {filteredEntries.map((entry) => (
                <JournalEntryCard
                  key={entry.id}
                  entry={entry}
                  onEdit={handleEditEntry}
                  onDelete={handleDeleteEntry}
                  onToggleFavorite={handleToggleFavorite}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div className="w-24 h-24 bg-gray-100 dark:bg-surface-800 rounded-full flex items-center justify-center mx-auto mb-6">
              <Notebook className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              No entries found
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {searchQuery 
                ? "Try adjusting your search terms"
                : "Start documenting your travel memories"
              }
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleNewEntry}
              className="btn-primary inline-flex items-center gap-2"
            >
              <FaPlus />
              Create Your First Entry
            </motion.button>
          </motion.div>
        )}
      </main>

      {/* Editor Modal */}
      <AnimatePresence>
        {showEditor && (
          <JournalEditor
            entry={editingEntry}
            onSave={handleSaveEntry}
            onClose={() => {
              setShowEditor(false);
              setEditingEntry(null);
            }}
            isNew={!editingEntry}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default TravelJournal;
