import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { chatAPI } from '../services/api';

/* ── Typing indicator ──────────────────────────────────────────────────── */
function TypingDots() {
  return (
    <div className="flex space-x-1 items-center py-1">
      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.2s]" />
      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.1s]" />
      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
    </div>
  );
}

/* ── Hotel card for chat ───────────────────────────────────────────────── */
function ChatHotelCard({ hotel, index, onBook, onViewDetails }) {
  const stars = hotel.stars ? '★'.repeat(hotel.stars) + '☆'.repeat(5 - hotel.stars) : null;
  const price = hotel.price_per_night
    ? `${hotel.currency || 'PKR'} ${Number(hotel.price_per_night).toLocaleString()}`
    : null;
  const ratingNum = hotel.rating ? parseFloat(hotel.rating) : null;
  const ratingColor =
    ratingNum >= 8 ? 'bg-green-600' : ratingNum >= 6 ? 'bg-yellow-500' : 'bg-gray-500';

  return (
    <div className="bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden hover:shadow-md transition-shadow">
      {/* Image or placeholder */}
      {hotel.image_url ? (
        <img
          src={hotel.image_url}
          alt={hotel.name}
          className="w-full h-24 object-cover"
          loading="lazy"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
      ) : (
        <div className="w-full h-16 bg-gradient-to-r from-primary-500 to-blue-500 flex items-center justify-center">
          <span className="text-white text-lg font-bold">🏨</span>
        </div>
      )}

      <div className="p-2.5">
        {/* Name + stars */}
        <div className="flex items-start justify-between gap-1">
          <h4 className="text-xs font-semibold text-gray-900 dark:text-white leading-tight line-clamp-2">
            {index}. {hotel.name}
          </h4>
          {ratingNum && (
            <span className={`${ratingColor} text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0`}>
              {ratingNum.toFixed(1)}
            </span>
          )}
        </div>
        {stars && <p className="text-yellow-500 text-[10px] mt-0.5">{stars}</p>}
        {hotel.distance_from_center && (
          <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate mt-0.5">{hotel.distance_from_center}</p>
        )}

        {/* Price + room */}
        <div className="mt-1.5 space-y-0.5">
          {price && (
            <p className="text-xs font-bold text-primary-600 dark:text-blue-400">{price}<span className="font-normal text-gray-500 dark:text-gray-400"> /night</span></p>
          )}
          {hotel.room_type && hotel.room_type !== 'Standard Room' && (
            <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{hotel.room_type}</p>
          )}
        </div>

        {/* Availability */}
        {hotel.is_sold_out ? (
          <span className="inline-block mt-1 text-[10px] bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full font-medium">
            Sold Out
          </span>
        ) : hotel.rooms_left && hotel.rooms_left <= 5 ? (
          <span className="inline-block mt-1 text-[10px] bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-1.5 py-0.5 rounded-full font-medium">
            Only {hotel.rooms_left} left!
          </span>
        ) : hotel.availability_status ? (
          <span className="inline-block mt-1 text-[10px] bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded-full font-medium">
            Available
          </span>
        ) : null}

        {/* Actions */}
        <div className="mt-2 flex gap-1.5">
          {!hotel.is_sold_out && (
            <button
              onClick={() => onViewDetails(hotel)}
              className="flex-1 text-[10px] font-medium py-1 px-2 rounded bg-primary-600 hover:bg-primary-700 text-white transition-colors"
            >
              Book Now
            </button>
          )}
          <button
            onClick={() => onViewDetails(hotel)}
            className="flex-1 text-[10px] font-medium py-1 px-2 rounded border border-gray-300 dark:border-gray-500 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 text-center transition-colors"
          >
            View Details
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Markdown-lite renderer ────────────────────────────────────────────── */
function FormattedMessage({ text }) {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];
  let listBuffer = [];
  let listType = null;

  const flushList = () => {
    if (listBuffer.length === 0) return;
    const Tag = listType === 'ol' ? 'ol' : 'ul';
    const cls =
      listType === 'ol'
        ? 'list-decimal list-inside space-y-0.5 my-1'
        : 'list-disc list-inside space-y-0.5 my-1';
    elements.push(
      <Tag key={`list-${elements.length}`} className={cls}>
        {listBuffer.map((item, i) => (
          <li key={i}>{formatInline(item)}</li>
        ))}
      </Tag>,
    );
    listBuffer = [];
    listType = null;
  };

  const formatInline = (line) => {
    const parts = [];
    const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
    let lastIndex = 0;
    let match;
    let key = 0;

    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) parts.push(line.slice(lastIndex, match.index));
      if (match[2]) parts.push(<strong key={key++}>{match[2]}</strong>);
      else if (match[3]) parts.push(<em key={key++}>{match[3]}</em>);
      else if (match[4])
        parts.push(
          <code key={key++} className="bg-gray-100 dark:bg-gray-600 px-1 rounded text-xs">
            {match[4]}
          </code>,
        );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < line.length) parts.push(line.slice(lastIndex));
    return parts.length > 0 ? parts : line;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();

    const ulMatch = trimmed.match(/^[-\u2022]\s+(.+)/);
    const olMatch = trimmed.match(/^\d+[.)]\s+(.+)/);

    if (ulMatch) {
      if (listType === 'ol') flushList();
      listType = 'ul';
      listBuffer.push(ulMatch[1]);
    } else if (olMatch) {
      if (listType === 'ul') flushList();
      listType = 'ol';
      listBuffer.push(olMatch[1]);
    } else {
      flushList();
      if (trimmed === '') {
        elements.push(<div key={`br-${i}`} className="h-1.5" />);
      } else {
        elements.push(
          <p key={`p-${i}`} className="my-0.5">
            {formatInline(trimmed)}
          </p>,
        );
      }
    }
  }
  flushList();
  return <div className="space-y-0">{elements}</div>;
}

/* ── Quick action chips ────────────────────────────────────────────────── */
const QUICK_ACTIONS = [
  { label: '🏨 Hotels', message: 'Show me popular hotels in Lahore' },
  { label: '🤖 AI Recommend', message: 'I want personalized hotel recommendations based on my preferences' },
  { label: '🗺️ Destinations', message: 'What are the best travel destinations in Pakistan?' },
  { label: '💰 Budget', message: 'Find budget hotels in Islamabad' },
  { label: '🌐 Travel Tips', message: 'What are the top travel tips for visiting Pakistan?' },
  { label: '📅 Book Hotel', message: 'I want to book a hotel' },
];

/* ── Session ID generator ──────────────────────────────────────────────── */
function getSessionId() {
  let id = sessionStorage.getItem('travello_chat_session');
  if (!id) {
    id = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem('travello_chat_session', id);
  }
  return id;
}

/* ── Main component ────────────────────────────────────────────────────── */
export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [bookingFlow, setBookingFlow] = useState(null);
  const [isMaximized, setIsMaximized] = useState(false); // Windows-style maximize/restore
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const sessionId = useMemo(getSessionId, []);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'bot',
          content:
            "Hi there! I'm your **Travello AI assistant**. I can help you find hotels, explore destinations, get travel tips, and even book hotels — just ask!",
        },
      ]);
    }
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen, messages.length]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading]);

  /* ── Send message ──────────────────────────────────── */
  const sendMessage = useCallback(
    async (text) => {
      const trimmed = (text || '').trim();
      if (!trimmed || isLoading) return;

      const userMessage = { id: `${Date.now()}-u`, role: 'user', content: trimmed };
      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setIsLoading(true);

      try {
        const response = await chatAPI.sendMessage(trimmed, sessionId);
        const data = response?.data || {};
        const botText = data.reply || 'Sorry, I could not process that.';

        // Track booking flow state from backend
        if (data.booking_flow) setBookingFlow('active');
        else setBookingFlow(null);

        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-b`,
            role: 'bot',
            content: botText,
            hasHotels: data.has_hotels || false,
            bookingId: data.booking_id || null,
            webSearchUsed: data.web_search_used || false,
            toolsUsed: data.tools_used || null,
            sources: data.sources || null,
          },
        ]);

        // Show structured hotel cards if available
        if (data.hotels && data.hotels.length > 0) {
          setTimeout(() => {
            setMessages((prev) => [
              ...prev,
              {
                id: `${Date.now()}-hotels`,
                role: 'hotels',
                hotels: data.hotels,
                searchParams: data.search_params || null,
              },
            ]);
          }, 200);
        }

        // Show follow-up suggestions for hotel results
        if (data.has_hotels) {
          setTimeout(() => {
            setMessages((prev) => [
              ...prev,
              {
                id: `${Date.now()}-suggest`,
                role: 'suggestions',
                suggestions: [
                  { label: 'Book Option 1', message: 'Book option 1' },
                  { label: 'Book Option 2', message: 'Book option 2' },
                  { label: 'More Hotels', message: 'Show me more hotel options' },
                  { label: 'Different City', message: 'Show hotels in another city' },
                ],
              },
            ]);
          }, 500);
        }
      } catch (err) {
        console.error('Chat error:', err);
        const errorMessage =
          err?.response?.data?.error ||
          err?.message ||
          (err?.request
            ? 'Unable to connect. Check your internet connection.'
            : 'Something went wrong. Please try again.');
        setMessages((prev) => [
          ...prev,
          { id: `${Date.now()}-e`, role: 'bot', content: errorMessage },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, sessionId],
  );

  const handleSend = () => sendMessage(input);
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  const toggle = () => setIsOpen((v) => !v);

  const showQuickActions = messages.length <= 1 && !isLoading;

  const buttonClasses = useMemo(
    () =>
      'fixed bottom-6 right-6 z-40 rounded-full shadow-lg bg-primary-600 hover:bg-primary-700 text-white w-14 h-14 flex items-center justify-center transition-transform duration-200',
    [],
  );

  return (
    <>
      {/* Floating Action Button */}
      <button
        type="button"
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
        className={buttonClasses}
        onClick={toggle}
      >
        {isOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
            <path
              fillRule="evenodd"
              d="M6.225 4.811a1 1 0 0 1 1.414 0L12 9.172l4.361-4.361a1 1 0 1 1 1.414 1.414L13.414 10.586l4.361 4.361a1 1 0 0 1-1.414 1.414L12 12l-4.361 4.361a1 1 0 1 1-1.414-1.414l4.361-4.361-4.361-4.361a1 1 0 0 1 0-1.414Z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7.5 8.25h9m-9 3h9m-9 3h5.25M21 12c0 4.97-4.477 9-10 9-1.225 0-2.397-.215-3.477-.61-.52-.192-1.086-.127-1.561.135L3 21l.475-2.379c.104-.523-.063-1.065-.446-1.449A8.943 8.943 0 0 1 1 12c0-4.97 4.477-9 10-9s10 4.03 10 9Z"
            />
          </svg>
        )}
      </button>

      {/* Chat Panel */}
      <div
        className={`fixed z-40 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden transform transition-all duration-300 flex flex-col ${
          isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
        } ${!isMaximized ? 'bottom-24 right-6 w-[22rem] h-80' : 'w-[95vw] h-[90vh]'}`}
        style={isMaximized && isOpen ? { position: 'fixed', bottom: 'auto', right: 'auto', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' } : {}}
      >
        {/* Header */}
        <div className="bg-primary-600 dark:bg-blue-700 text-white px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full" />
            <span className="font-semibold text-sm">Travello AI Assistant</span>
            {bookingFlow && (
              <span className="text-[10px] bg-yellow-400 text-gray-900 px-1.5 py-0.5 rounded-full font-medium">
                Booking
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {/* Maximize/Restore button (Windows-style) */}
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              title={isMaximized ? 'Restore' : 'Maximize'}
              className="text-white/70 hover:text-white transition-colors p-1"
            >
              {isMaximized ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path d="M3 4a1 1 0 011-1h4a1 1 0 010 2H5.414l7.293 7.293a1 1 0 01-1.414 1.414L4 6.414V8a1 1 0 01-2 0V4z" />
                  <path d="M13 13a1 1 0 01.707.293l2.828-2.829a1 1 0 01-1.414-1.414l-2.828 2.829A1 1 0 0113 13z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path d="M4.5 3A1.5 1.5 0 003 4.5v5A1.5 1.5 0 004.5 11h5A1.5 1.5 0 0011 9.5v-5A1.5 1.5 0 009.5 3h-5zm9 6a1.5 1.5 0 011.5-1.5h5A1.5 1.5 0 0121 9.5v5a1.5 1.5 0 01-1.5 1.5h-5A1.5 1.5 0 0113 14.5v-5z" />
                </svg>
              )}
            </button>
            {/* Close button */}
            <button onClick={toggle} className="text-white/70 hover:text-white transition-colors p-1">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-900">
          {messages.map((m) => {
            /* ── Suggestion chips ── */
            if (m.role === 'suggestions') {
              return (
                <div key={m.id} className="flex flex-wrap gap-1.5 pt-1">
                  {m.suggestions.map((s) => (
                    <button
                      key={s.label}
                      onClick={() => sendMessage(s.message)}
                      className="text-xs px-2.5 py-1 rounded-full border border-primary-300 dark:border-blue-600 text-primary-600 dark:text-blue-400 hover:bg-primary-50 dark:hover:bg-blue-900/30 transition-colors"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              );
            }

            /* ── Hotel cards grid ── */
            if (m.role === 'hotels') {
              return (
                <div key={m.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Real-time Results
                    </p>
                    <span className="text-[9px] bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded-full font-medium">
                      Live from Booking.com
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {m.hotels.map((hotel, i) => (
                      <ChatHotelCard
                        key={`${hotel.name}-${i}`}
                        hotel={hotel}
                        index={i + 1}
                        onBook={(idx) => sendMessage(`Book option ${idx}`)}
                        onViewDetails={(h) => {
                          navigate('/hotel-details', {
                            state: {
                              hotel: {
                                ...h,
                                id: h.id || `chat_${i}`,
                              },
                              searchParams: m.searchParams || {},
                            },
                          });
                        }}
                      />
                    ))}
                  </div>
                  {m.searchParams?.destination && (
                    <button
                      onClick={() => {
                        navigate('/hotels/search-results', { state: m.searchParams });
                      }}
                      className="w-full text-xs font-medium py-1.5 rounded-lg border border-primary-300 dark:border-blue-600 text-primary-600 dark:text-blue-400 hover:bg-primary-50 dark:hover:bg-blue-900/30 transition-colors mt-1"
                    >
                      View All Results on Search Page →
                    </button>
                  )}
                </div>
              );
            }

            /* ── User or bot message ── */
            return (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-2xl shadow-sm text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-primary-600 dark:bg-blue-600 text-white rounded-br-sm'
                      : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-600 rounded-bl-sm'
                  }`}
                >
                  {m.role === 'user' ? m.content : <FormattedMessage text={m.content} />}
                  {/* Tool usage badges */}
                  {m.role === 'bot' && (m.toolsUsed || m.webSearchUsed) && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {m.toolsUsed?.includes('hotel_scraper') && (
                        <span className="text-[9px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full font-medium">
                          🔍 Live Scraper
                        </span>
                      )}
                      {m.webSearchUsed && (
                        <span className="text-[9px] bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded-full font-medium">
                          🌐 Web Search
                        </span>
                      )}
                    </div>
                  )}
                  {/* Booking confirmation badge */}
                  {m.bookingId && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Booking Confirmed
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Quick action chips after welcome */}
          {showQuickActions && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {QUICK_ACTIONS.map((a) => (
                <button
                  key={a.label}
                  onClick={() => sendMessage(a.message)}
                  className="text-xs px-2.5 py-1 rounded-full border border-primary-300 dark:border-blue-600 text-primary-600 dark:text-blue-400 hover:bg-primary-50 dark:hover:bg-blue-900/30 transition-colors"
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}

          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-[85%] px-3 py-2 rounded-2xl shadow-sm text-sm leading-relaxed bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-600 rounded-bl-sm">
                <TypingDots />
              </div>
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="flex-shrink-0 p-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          {bookingFlow && (
            <div className="mb-2 flex items-center gap-2 text-xs text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 px-2 py-1 rounded-lg">
              <span>📝 Booking in progress</span>
              <button
                onClick={() => sendMessage('cancel booking')}
                className="ml-auto text-red-500 hover:text-red-700 dark:hover:text-red-400 font-medium"
              >
                Cancel
              </button>
            </div>
          )}
          <div className="flex items-end space-x-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder={
                bookingFlow
                  ? 'Type your booking details...'
                  : 'Ask me about hotels, destinations, tips...'
              }
              className="flex-1 resize-none rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent max-h-28 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={isLoading || input.trim().length === 0}
              className="shrink-0 inline-flex items-center justify-center rounded-lg bg-primary-600 dark:bg-blue-600 hover:bg-primary-700 dark:hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-2 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.155.75.75 0 0 0 0-1.114A28.897 28.897 0 0 0 3.105 2.288Z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
