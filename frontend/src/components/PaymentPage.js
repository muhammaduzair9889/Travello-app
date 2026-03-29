import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaCreditCard, FaSpinner, FaExclamationTriangle, FaCheckCircle,
  FaLock, FaShieldAlt, FaReceipt, FaDownload, FaArrowLeft,
  FaMoneyBillWave, FaCalendarAlt, FaUsers, FaHotel
} from 'react-icons/fa';
import { bookingAPI, paymentAPI } from '../services/api';

const GST_RATE = 0.16;
const SERVICE_CHARGE_RATE = 0.05;

/* ──────────────────────────────────────────────
   Utility helpers
────────────────────────────────────────────── */
const fmt = (n) =>
  new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(n || 0);

const fmtCard = (val) =>
  val.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();

const detectBrand = (num) => {
  const n = num.replace(/\s/g, '');
  if (n.startsWith('4')) return { brand: 'Visa', color: '#1434CB' };
  if (/^5[1-5]/.test(n)) return { brand: 'Mastercard', color: '#EB001B' };
  if (/^3[47]/.test(n)) return { brand: 'Amex', color: '#007BC1' };
  return { brand: '', color: '#888' };
};

/* ──────────────────────────────────────────────
   Price Breakdown Card
────────────────────────────────────────────── */
const PriceBreakdown = ({ booking, breakdown }) => {
  const basePrice  = parseFloat(breakdown?.base_price  || booking?.base_price  || booking?.total_price || 0);
  const taxAmount  = parseFloat(breakdown?.tax_amount  || booking?.tax_amount  || basePrice * GST_RATE);
  const svcAmount  = parseFloat(breakdown?.service_charge || booking?.service_charge || basePrice * SERVICE_CHARGE_RATE);
  const total      = parseFloat(breakdown?.total_price || booking?.total_price || basePrice + taxAmount + svcAmount);
  const nights     = booking?.number_of_nights || 1;
  const rooms      = booking?.rooms_booked || 1;

  const rows = [
    { label: `Room rate × ${nights} night${nights > 1 ? 's' : ''} × ${rooms} room${rooms > 1 ? 's' : ''}`, value: basePrice },
    { label: `GST (${(GST_RATE * 100).toFixed(0)}%)`, value: taxAmount },
    { label: `Service charge (${(SERVICE_CHARGE_RATE * 100).toFixed(0)}%)`, value: svcAmount },
  ];

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="bg-gray-50 dark:bg-gray-800 px-5 py-4 font-semibold text-gray-800 dark:text-white flex items-center gap-2">
        <FaReceipt className="text-blue-500" /> Price Breakdown
      </div>
      <div className="px-5 py-4 space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
            <span>{r.label}</span>
            <span className="font-medium">{fmt(r.value)}</span>
          </div>
        ))}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-3 flex justify-between font-bold text-base text-blue-600 dark:text-blue-400">
          <span>Total</span>
          <span>{fmt(total)}</span>
        </div>
      </div>
    </div>
  );
};

/* ──────────────────────────────────────────────
   Room Lock Timer
────────────────────────────────────────────── */
const RoomLockTimer = () => {
  const [seconds, setSeconds] = useState(15 * 60);
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const urgent = seconds < 120;
  return (
    <div className={`flex items-center gap-2 text-sm px-4 py-2 rounded-xl ${urgent ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'}`}>
      <FaLock className="text-xs" />
      Room reserved for <strong>{m}:{String(s).padStart(2, '0')}</strong>
    </div>
  );
};

/* ──────────────────────────────────────────────
   Confirmation Screen
────────────────────────────────────────────── */
const ConfirmationScreen = ({ result, booking, onDownloadInvoice, onBack }) => {
  const isCash = result.payment_method === 'cash_on_arrival';
  const guestMeta = useMemo(() => {
    if (!booking?.special_requests) return null;
    try {
      const parsed = JSON.parse(booking.special_requests);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      return null;
    }
    return null;
  }, [booking?.special_requests]);

  const leadPax = guestMeta?.lead_pax || null;
  const passengers = Array.isArray(guestMeta?.passengers) ? guestMeta.passengers : [];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center py-4 space-y-6"
    >
      {/* Success Icon */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
        className="w-24 h-24 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center"
      >
        <FaCheckCircle className="text-emerald-500 text-5xl" />
      </motion.div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {isCash ? 'Booking Confirmed!' : 'Payment Successful!'}
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {isCash
            ? 'Your room is reserved. Pay at the hotel on arrival.'
            : 'Your booking has been confirmed and payment processed.'}
        </p>
      </div>

      {/* Confirmation details */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-5 text-left space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">Booking ID</span>
          <span className="font-bold text-gray-900 dark:text-white">{result.booking_id}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">Reference</span>
          <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-base">
            {result.booking_reference}
          </span>
        </div>
        {result.invoice_number && (
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Invoice No.</span>
            <span className="font-semibold text-gray-700 dark:text-gray-300">{result.invoice_number}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">Status</span>
          <span className={`font-bold ${isCash ? 'text-amber-600' : 'text-emerald-600'}`}>
            {result.status}
          </span>
        </div>
        {result.card_brand && (
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Paid with</span>
            <span className="font-semibold">{result.card_brand} •••• {result.card_last4}</span>
          </div>
        )}
      </div>

      {/* Price Breakdown */}
      {result.price_breakdown && (
        <div className="text-left">
          <PriceBreakdown booking={booking} breakdown={result.price_breakdown} />
        </div>
      )}

      {(leadPax || passengers.length > 0) && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-5 text-left space-y-3 text-sm">
          <h3 className="font-semibold text-gray-900 dark:text-white">Guest Details</h3>
          {leadPax && (
            <div className="space-y-1 text-gray-700 dark:text-gray-300">
              <p><span className="text-gray-500 dark:text-gray-400">Lead Passenger:</span> {leadPax.name || 'N/A'}</p>
              <p><span className="text-gray-500 dark:text-gray-400">Date of Birth:</span> {leadPax.dob || 'N/A'}</p>
              {(leadPax.phone || leadPax.email) && (
                <p>
                  <span className="text-gray-500 dark:text-gray-400">Contact:</span> {leadPax.phone || leadPax.email}
                </p>
              )}
            </div>
          )}
          {passengers.length > 0 && (
            <div>
              <p className="text-gray-500 dark:text-gray-400 mb-1">Passengers</p>
              <ul className="space-y-1 text-gray-700 dark:text-gray-300">
                {passengers.map((p, idx) => (
                  <li key={`${p.type || 'pax'}-${idx}`}>
                    {idx + 1}. {p.name || 'N/A'} ({p.type || 'guest'})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Email simulation */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4 text-sm text-blue-800 dark:text-blue-200 text-left">
        📧 A confirmation email has been sent to <strong>{booking?.guest_email || booking?.user_email || 'your registered email address'}</strong>.
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={onDownloadInvoice}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
        >
          <FaDownload /> Download Invoice
        </button>
        <button
          onClick={onBack}
          className="flex-1 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-semibold rounded-xl transition-colors"
        >
          My Bookings
        </button>
      </div>
    </motion.div>
  );
};

/* ──────────────────────────────────────────────
   Main PaymentPage Component
────────────────────────────────────────────── */
const PaymentPage = () => {
  const navigate = useNavigate();
  const { bookingId: paramBookingId } = useParams();
  const location = useLocation();
  const stateBookingId = location.state?.booking_id || location.state?.bookingId;
  const bookingId = paramBookingId || stateBookingId;

  /* State */
  const [booking, setBooking]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [paying, setPaying]         = useState(false);
  const [error, setError]           = useState(null);
  const [validationError, setValidationError] = useState(null);
  const [method, setMethod]         = useState('card'); // 'card' | 'cash_on_arrival' | 'stripe'
  const [result, setResult]         = useState(null);
  const [stripeLoading, setStripeLoading] = useState(false);

  /* Card fields */
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv]       = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  /* ── Fetch booking ── */
  useEffect(() => {
    if (!bookingId) { setError('No booking ID provided'); setLoading(false); return; }
    const fetch_ = async () => {
      setLoading(true);
      try {
        const res = await bookingAPI.getBooking(bookingId);
        const b = res.data?.booking || res.data;
        if (!b) throw new Error('Booking not found');
        setBooking(b);
      } catch (err) {
        setError(err.response?.data?.error || err.response?.data?.detail || err.message || 'Failed to load booking');
      } finally {
        setLoading(false);
      }
    };
    fetch_();
  }, [bookingId]);

  /* ── Card field handlers ── */
  const handleCardNumber = (e) => {
    setCardNumber(fmtCard(e.target.value));
    setFieldErrors((p) => ({ ...p, cardNumber: '' }));
  };

  const handleExpiry = (e) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (v.length >= 3) v = v.slice(0, 2) + '/' + v.slice(2);
    setCardExpiry(v);
    setFieldErrors((p) => ({ ...p, cardExpiry: '' }));
  };

  const handleCvv = (e) => {
    setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4));
    setFieldErrors((p) => ({ ...p, cardCvv: '' }));
  };

  /* ── Validate card ── */
  const validateCard = useCallback(() => {
    const errors = {};
    const num = cardNumber.replace(/\s/g, '');
    if (!num || num.length < 13 || num.length > 19) errors.cardNumber = 'Enter a valid card number';
    if (!cardHolder.trim() || cardHolder.trim().length < 2) errors.cardHolder = 'Enter card holder name';
    if (!cardExpiry.includes('/')) { errors.cardExpiry = 'Use MM/YY format'; }
    else {
      const [mm, yy] = cardExpiry.split('/').map(Number);
      const now = new Date();
      const expDate = new Date(2000 + yy, mm - 1, 1);
      if (!mm || mm < 1 || mm > 12) errors.cardExpiry = 'Invalid month';
      else if (expDate < new Date(now.getFullYear(), now.getMonth(), 1)) errors.cardExpiry = 'Card has expired';
    }
    if (!cardCvv || cardCvv.length < 3) errors.cardCvv = 'Enter CVV';
    return errors;
  }, [cardNumber, cardHolder, cardExpiry, cardCvv]);

  /* ── Handle pay ── */
  const handlePay = async () => {
    setError(null);
    setValidationError(null);

    // ── Stripe real checkout ──
    if (method === 'stripe') {
      setStripeLoading(true);
      try {
        const res = await paymentAPI.createSession(bookingId);
        if (res.data?.success && res.data?.session_url) {
          // Send confirmation email before redirecting
          try { await paymentAPI.sendConfirmation(bookingId); } catch {}
          window.location.href = res.data.session_url;
          return;
        }
        throw new Error(res.data?.error || 'Failed to create Stripe session');
      } catch (err) {
        setError(err.data?.error || err.message || 'Stripe checkout failed. Try another method.');
      } finally {
        setStripeLoading(false);
      }
      return;
    }

    if (method === 'card') {
      const errs = validateCard();
      if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }
    }

    setPaying(true);
    try {
      const payload = { booking_id: bookingId, payment_method: method };
      if (method === 'card') {
        Object.assign(payload, {
          card_number: cardNumber.replace(/\s/g, ''),
          card_expiry: cardExpiry,
          card_cvv: cardCvv,
          card_holder: cardHolder,
        });
      }
      const res = await paymentAPI.simulate(payload);
      if (res.data?.success) {
        setResult(res.data);
        // Send confirmation email after successful payment
        try { await paymentAPI.sendConfirmation(bookingId); } catch {}
      } else {
        throw new Error(res.data?.error || 'Payment failed');
      }
    } catch (err) {
      const data = err.response?.data;
      if (data?.validation_error === 'price_changed') {
        setValidationError(
          `⚠️ Price updated: was PKR ${data.old_total?.toFixed(0)}, now PKR ${data.new_total?.toFixed(0)}. Please review the new total and try again.`
        );
      } else if (data?.validation_error === 'room_unavailable') {
        setValidationError('⚠️ Sorry, this room is no longer available. Please choose a different room.');
      } else if (data?.validation_error === 'dates_invalid') {
        setValidationError('⚠️ Check-in date is in the past. Please update your booking dates.');
      } else if (data?.validation_error === 'occupancy_exceeded') {
        setValidationError(`⚠️ ${data.error}`);
      } else {
        setError(data?.error || err.message || 'Payment failed. Please try again.');
      }
    } finally {
      setPaying(false);
    }
  };

  /* ── Download Invoice ── */
  const downloadInvoice = async () => {
    try {
      const res = await paymentAPI.invoice(bookingId);
      const htmlBlob = new Blob([res.data], { type: 'text/html' });
      const url = URL.createObjectURL(htmlBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${result?.booking_reference || bookingId}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // fallback: open in new tab
      window.open(`/api/payments/booking/${bookingId}/invoice/`, '_blank');
    }
  };

  const bookingGuestMeta = useMemo(() => {
    if (!booking?.special_requests) return null;
    try {
      const parsed = JSON.parse(booking.special_requests);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      return null;
    }
    return null;
  }, [booking?.special_requests]);

  /* ── Error screen ── */
  if (!loading && (error && !booking)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-sky-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          <FaExclamationTriangle className="text-red-500 text-5xl mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Something went wrong</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <button onClick={() => navigate('/my-bookings')} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium">
            My Bookings
          </button>
        </motion.div>
      </div>
    );
  }

  const hotelName  = booking?.hotel_details?.name || booking?.hotel_name || booking?.hotel || 'Hotel';
  const roomType   = booking?.room_type_details?.type_display || booking?.room_type || 'Room';
  const checkIn    = booking?.check_in  ? new Date(booking.check_in).toLocaleDateString('en-PK', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : '—';
  const checkOut   = booking?.check_out ? new Date(booking.check_out).toLocaleDateString('en-PK', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : '—';
  const nights     = booking?.number_of_nights || 1;
  const adults     = booking?.adults || 1;
  const children   = booking?.children || 0;
  const { brand }  = detectBrand(cardNumber);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-sky-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 py-8 px-4">
      <div className="max-w-5xl mx-auto grid lg:grid-cols-5 gap-6">

        {/* ── Left: Payment form ── */}
        <div className="lg:col-span-3">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">

            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-6 text-white">
              <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-blue-200 hover:text-white mb-3 text-sm transition-colors">
                <FaArrowLeft /> Back
              </button>
              <div className="flex items-center gap-3">
                <FaShieldAlt className="text-2xl text-blue-200" />
                <div>
                  <h1 className="text-2xl font-bold">Secure Checkout</h1>
                  <p className="text-blue-200 text-sm">Your payment is encrypted & protected</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Loading */}
              {loading && (
                <div className="text-center py-12">
                  <FaSpinner className="text-blue-500 text-4xl animate-spin mx-auto mb-3" />
                  <p className="text-gray-500">Loading booking details…</p>
                </div>
              )}

              {/* Confirmation screen */}
              {result && (
                <ConfirmationScreen
                  result={result}
                  booking={booking}
                  onDownloadInvoice={downloadInvoice}
                  onBack={() => navigate('/my-bookings')}
                />
              )}

              {/* Payment form */}
              {!loading && !result && booking && (
                <>
                  {/* Room lock timer */}
                  <div className="flex items-center justify-between">
                    <RoomLockTimer />
                    <span className="text-xs text-gray-400 dark:text-gray-500">🔒 SSL Secured</span>
                  </div>

                  {/* Validation errors */}
                  <AnimatePresence>
                    {validationError && (
                      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-xl text-sm text-amber-800 dark:text-amber-200">
                        {validationError}
                      </motion.div>
                    )}
                    {error && (
                      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-xl text-sm text-red-800 dark:text-red-200">
                        {error}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Payment Method Toggle */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      Payment Method
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: 'stripe', label: 'Stripe Checkout', icon: FaCreditCard },
                        { id: 'card', label: 'Test Card', icon: FaCreditCard },
                        { id: 'cash_on_arrival', label: 'Cash on Arrival', icon: FaMoneyBillWave },
                      ].map(({ id, label, icon: Icon }) => (
                        <button
                          key={id}
                          onClick={() => setMethod(id)}
                          className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                            method === id
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                              : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                          }`}
                        >
                          <Icon className="text-lg flex-shrink-0" />
                          <span className="text-sm font-medium">{label}</span>
                          {method === id && <FaCheckCircle className="ml-auto text-blue-500 text-sm" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Card Form */}
                  <AnimatePresence mode="wait">
                    {method === 'card' && (
                      <motion.div key="card" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-4 overflow-hidden">
                        {/* Card Number */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Card Number {brand && <span className="ml-2 text-blue-600 font-semibold">{brand}</span>}
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              value={cardNumber}
                              onChange={handleCardNumber}
                              placeholder="1234 5678 9012 3456"
                              maxLength={19}
                              className={`w-full pl-4 pr-12 py-3 rounded-xl border text-sm font-mono bg-white dark:bg-gray-900 text-gray-800 dark:text-white outline-none transition-colors ${
                                fieldErrors.cardNumber ? 'border-red-400' : 'border-gray-300 dark:border-gray-600 focus:border-blue-500'
                              }`}
                            />
                            <FaCreditCard className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                          </div>
                          {fieldErrors.cardNumber && <p className="text-xs text-red-500 mt-1">{fieldErrors.cardNumber}</p>}
                        </div>

                        {/* Card Holder */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Card Holder Name</label>
                          <input
                            type="text"
                            value={cardHolder}
                            onChange={(e) => { setCardHolder(e.target.value); setFieldErrors((p) => ({ ...p, cardHolder: '' })); }}
                            placeholder="JOHN DOE"
                            className={`w-full px-4 py-3 rounded-xl border text-sm uppercase bg-white dark:bg-gray-900 text-gray-800 dark:text-white outline-none transition-colors ${
                              fieldErrors.cardHolder ? 'border-red-400' : 'border-gray-300 dark:border-gray-600 focus:border-blue-500'
                            }`}
                          />
                          {fieldErrors.cardHolder && <p className="text-xs text-red-500 mt-1">{fieldErrors.cardHolder}</p>}
                        </div>

                        {/* Expiry + CVV */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expiry (MM/YY)</label>
                            <input
                              type="text"
                              value={cardExpiry}
                              onChange={handleExpiry}
                              placeholder="12/28"
                              maxLength={5}
                              className={`w-full px-4 py-3 rounded-xl border text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-white outline-none transition-colors ${
                                fieldErrors.cardExpiry ? 'border-red-400' : 'border-gray-300 dark:border-gray-600 focus:border-blue-500'
                              }`}
                            />
                            {fieldErrors.cardExpiry && <p className="text-xs text-red-500 mt-1">{fieldErrors.cardExpiry}</p>}
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CVV</label>
                            <div className="relative">
                              <input
                                type="password"
                                value={cardCvv}
                                onChange={handleCvv}
                                placeholder="•••"
                                maxLength={4}
                                className={`w-full px-4 py-3 rounded-xl border text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-white outline-none transition-colors ${
                                  fieldErrors.cardCvv ? 'border-red-400' : 'border-gray-300 dark:border-gray-600 focus:border-blue-500'
                                }`}
                              />
                            </div>
                            {fieldErrors.cardCvv && <p className="text-xs text-red-500 mt-1">{fieldErrors.cardCvv}</p>}
                          </div>
                        </div>

                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          🔒 This is a simulation — no real payment is processed. Use any test card number.
                        </p>
                      </motion.div>
                    )}

                    {method === 'cash_on_arrival' && (
                      <motion.div key="cash" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="p-5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl text-sm text-amber-800 dark:text-amber-200 space-y-2">
                        <p className="font-semibold flex items-center gap-2"><FaMoneyBillWave /> Cash on Arrival</p>
                        <p>Your room will be reserved and payment will be collected at the hotel reception during check-in.</p>
                        <p className="text-xs opacity-75">Note: Some hotels may require a card as guarantee. Please confirm with the hotel directly.</p>
                      </motion.div>
                    )}

                    {method === 'stripe' && (
                      <motion.div key="stripe" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="p-5 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-xl text-sm text-indigo-800 dark:text-indigo-200 space-y-2">
                        <p className="font-semibold flex items-center gap-2"><FaShieldAlt /> Stripe Secure Checkout</p>
                        <p>You'll be securely redirected to Stripe's payment page to complete your transaction with real card processing.</p>
                        <div className="flex items-center gap-3 mt-2 text-xs opacity-75">
                          <span>✓ PCI DSS Compliant</span>
                          <span>✓ 3D Secure</span>
                          <span>✓ All major cards accepted</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Pay Button */}
                  <button
                    onClick={handlePay}
                    disabled={paying || stripeLoading}
                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 text-white font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-3 text-base"
                  >
                    {paying || stripeLoading ? (
                      <><FaSpinner className="animate-spin" /> Processing…</>
                    ) : method === 'stripe' ? (
                      <><FaShieldAlt /> Pay with Stripe</>
                    ) : method === 'card' ? (
                      <><FaCreditCard /> Confirm & Pay (Test)</>
                    ) : (
                      <><FaCheckCircle /> Confirm Booking</>
                    )}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </div>

        {/* ── Right: Order Summary ── */}
        <div className="lg:col-span-2 space-y-4">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-5 space-y-4">
            <h2 className="font-bold text-gray-900 dark:text-white text-base border-b border-gray-100 dark:border-gray-700 pb-3">
              Your booking
            </h2>

            {/* Hotel info */}
            {loading ? (
              <div className="animate-pulse space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />)}
              </div>
            ) : booking && (
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <FaHotel className="text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{hotelName}</p>
                    <p className="text-gray-500 dark:text-gray-400 capitalize">{roomType}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <FaCalendarAlt className="text-blue-500 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-700 dark:text-gray-300">{checkIn}</p>
                    <p className="text-xs text-gray-400">→ {checkOut}</p>
                    <p className="text-xs text-blue-500 mt-0.5">{nights} night{nights > 1 ? 's' : ''}</p>
                  </div>
                </div>
                {adults > 0 && (
                  <div className="flex items-center gap-3">
                    <FaUsers className="text-blue-500 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300">
                      {adults} adult{adults > 1 ? 's' : ''}{children > 0 ? `, ${children} child${children > 1 ? 'ren' : ''}` : ''}
                    </span>
                  </div>
                )}

                {bookingGuestMeta?.lead_pax && (
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400 space-y-1">
                    <p className="font-semibold text-gray-700 dark:text-gray-300">Lead Passenger</p>
                    <p>{bookingGuestMeta.lead_pax.name || 'N/A'}</p>
                    <p>DOB: {bookingGuestMeta.lead_pax.dob || 'N/A'}</p>
                    {(bookingGuestMeta.lead_pax.phone || bookingGuestMeta.lead_pax.email) && (
                      <p>Contact: {bookingGuestMeta.lead_pax.phone || bookingGuestMeta.lead_pax.email}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Price Breakdown */}
            {booking && (
              <PriceBreakdown booking={booking} breakdown={booking.price_breakdown} />
            )}
          </motion.div>

          {/* Trust badges */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow p-4 flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
            {['🔒 256-bit SSL', '✅ Free cancellation*', '🏨 Instant confirmation', '📞 24/7 support'].map((b) => (
              <span key={b} className="flex items-center gap-1">{b}</span>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default PaymentPage;
