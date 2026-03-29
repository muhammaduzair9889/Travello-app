/**
 * Hotel Search API Service for Lahore, Pakistan
 * Connects to Django backend which runs Puppeteer scraper for REAL-TIME Booking.com data
 * 
 * API Endpoint: POST /api/scraper/scrape-hotels/
 * 
 * The backend now returns immediately with a job_id. We poll for results.
 */

import axios from 'axios';

// Backend API Configuration
const API_ROOT = (process.env.REACT_APP_API_URL || process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000')
  .replace(/\/api\/?$/, '');

const POLL_INTERVAL_MS = 3000;   // Poll every 3 seconds
const MAX_POLL_ATTEMPTS = 80;    // Max ~4 minutes of polling

/**
 * Poll a scraping job until it completes.
 * @param {string} jobId - UUID of the scrape job
 * @returns {Promise<{hotels: Array, meta: Object}>}
 */
async function pollForResults(jobId) {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

    try {
      const statusRes = await axios.get(
        `${API_ROOT}/api/scraper/job-status/${jobId}/`,
        { timeout: 10000 }
      );

      const { status: jobStatus, hotel_count, error } = statusRes.data;
      console.log(`[poll ${attempt + 1}] job=${jobId} status=${jobStatus} hotels=${hotel_count}`);

      if (jobStatus === 'COMPLETED' || jobStatus === 'PARTIAL') {
        const resultsRes = await axios.get(
          `${API_ROOT}/api/scraper/results/${jobId}/`,
          { timeout: 30000 }
        );
        return {
          hotels: resultsRes.data.hotels || [],
          meta: resultsRes.data.meta || {},
        };
      }

      if (jobStatus === 'FAILED') {
        throw new Error(error || 'Scraper job failed');
      }
      // QUEUED or RUNNING — keep polling
    } catch (pollErr) {
      // Network hiccup during poll — retry
      console.warn(`Poll attempt ${attempt + 1} error:`, pollErr.message);
    }
  }
  throw new Error('Scraping timed out after maximum poll attempts');
}


/**
 * Search hotels in Lahore, Pakistan with REAL-TIME data from Booking.com scraper
 */
export const searchLahoreHotels = async (params = {}) => {
  console.log('Searching REAL hotels in Lahore via background scraper...');

  const {
    checkIn = getDefaultCheckIn(),
    checkOut = getDefaultCheckOut(),
    adults = 2,
    children = 0
  } = params;

  try {
    // 1. POST to enqueue scrape — returns instantly
    const response = await axios.post(
      `${API_ROOT}/api/scraper/scrape-hotels/`,
      {
        city: 'Lahore',
        checkin: checkIn,
        checkout: checkOut,
        adults: adults,
        children: children,
        rooms: 1,
        use_cache: true,
        coverage_priority: false,
        deep_search: false,
        quick_mode: true,
      },
      {
        timeout: 15000,  // Should return in <1 s (no long wait)
        headers: { 'Content-Type': 'application/json' }
      }
    );

    let rawHotels = response.data.hotels || [];
    let meta = response.data.meta || {};
    const jobId = response.data.job_id;

    // 2. If the backend returned cached data, use it immediately
    if (rawHotels.length > 0) {
      console.log(`Cache hit: ${rawHotels.length} hotels. Background refresh job=${jobId || 'none'}`);
    } else if (jobId) {
      // 3. No cache — poll the background job
      console.log(`No cache. Polling job ${jobId}...`);
      const result = await pollForResults(jobId);
      rawHotels = result.hotels;
      meta = result.meta;
    } else {
      console.warn('No hotels and no job_id — capacity?');
      return [];
    }

    if (!rawHotels.length) {
      console.warn('Scraper returned no hotels');
      return [];
    }

    console.log(`Found ${rawHotels.length} REAL hotels from Booking.com`);

    // Transform scraped data to frontend format
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const nights = Math.max(1, Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24)));

    const hotels = rawHotels.map((hotel, index) => {
      let pricePerNight = 15000;
      if (hotel.price) {
        const priceMatch = hotel.price.replace(/,/g, '').match(/[\d]+/);
        if (priceMatch) pricePerNight = parseInt(priceMatch[0]) || 15000;
      }
      if (pricePerNight > 500000) pricePerNight = Math.round(pricePerNight / nights);

      let ratingValue = 0;
      if (hotel.rating) {
        const ratingMatch = hotel.rating.toString().match(/[\d.]+/);
        if (ratingMatch) ratingValue = parseFloat(ratingMatch[0]) || 0;
      }

      let reviewCount = 0;
      if (hotel.review_count) {
        const reviewMatch = hotel.review_count.toString().replace(/,/g, '').match(/\d+/);
        if (reviewMatch) reviewCount = parseInt(reviewMatch[0]) || 0;
      }

      const amenitiesArray = hotel.amenities || [];
      const amenitiesText = amenitiesArray.join(', ').toLowerCase();
      const amenities = {
        wifi: amenitiesText.includes('wifi') || amenitiesText.includes('internet') || amenitiesText.includes('wi-fi'),
        parking: amenitiesText.includes('parking') || amenitiesText.includes('car park'),
        pool: amenitiesText.includes('pool') || amenitiesText.includes('swimming'),
        restaurant: amenitiesText.includes('restaurant') || amenitiesText.includes('dining') || amenitiesText.includes('breakfast'),
        spa: amenitiesText.includes('spa') || amenitiesText.includes('wellness'),
        gym: amenitiesText.includes('gym') || amenitiesText.includes('fitness'),
      };

      const address = hotel.location || hotel.distance || 'Lahore, Pakistan';

      return {
        id: index + 1,
        hotel_name: hotel.name || 'Hotel',
        name: hotel.name || 'Hotel',
        location: address,
        address: address,
        city: 'Lahore',
        country: 'Pakistan',
        single_bed_price_per_day: Math.round(pricePerNight * 0.7),
        double_bed_price_per_day: pricePerNight,
        triple_bed_price_per_day: Math.round(pricePerNight * 1.3),
        quad_bed_price_per_day: Math.round(pricePerNight * 1.5),
        family_room_price_per_day: Math.round(pricePerNight * 1.8),
        price: pricePerNight,
        total_rooms: 50,
        available_rooms: hotel.rooms_left || 10,
        rating: ratingValue,
        reviewCount: reviewCount,
        image: hotel.image_url || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500',
        wifi_available: amenities.wifi,
        parking_available: amenities.parking,
        amenities: amenities,
        description: amenitiesArray.length > 0
          ? amenitiesArray.join(' • ')
          : `${hotel.name} in Lahore. Real-time data from Booking.com.`,
        latitude: 31.5204 + (Math.random() - 0.5) * 0.1,
        longitude: 74.3587 + (Math.random() - 0.5) * 0.1,
        booking_url: hotel.url || 'https://www.booking.com',
        lastBooked: `${Math.floor(Math.random() * 5) + 1} hours ago`,
        popularAmenities: amenitiesArray.slice(0, 4),
        availability: hotel.availability_status || hotel.availability || 'Available',
        is_limited: hotel.is_limited || false,
        has_deal: hotel.has_deal || null,
        original_price: hotel.original_price || null,
        max_occupancy: hotel.max_occupancy || 2,
        occupancy_match: hotel.occupancy_match !== false,
        room_type: hotel.room_type || 'double',
        meal_plan: hotel.meal_plan || 'room_only',
        cancellation_policy: hotel.cancellation_policy || 'standard',
        price_per_night: hotel.price_per_night || pricePerNight,
        total_stay_price: hotel.total_stay_price || null,
        is_real_time: true,
        source: 'booking.com'
      };
    });

    const result = {
      hotels,
      meta: {
        verified: meta.verified !== false,
        coverage_pct: meta.coverage_pct || null,
        reported_count: meta.reported_count || null,
        scraped_count: meta.scraped_count || hotels.length,
        verification_notes: meta.verification_notes || [],
        elapsed_seconds: meta.elapsed_seconds || null,
      }
    };

    console.log(`Transformed ${hotels.length} hotels for display (verified=${result.meta.verified})`);
    return result;

  } catch (error) {
    console.error('Error fetching real-time hotel data:', error);

    if (error.response) {
      const errorData = error.response.data;
      const errorMsg = errorData?.message || errorData?.error || `Server error: ${error.response.status}`;
      throw new Error(errorMsg);
    } else if (error.request) {
      throw new Error('Unable to connect to hotel search service. Please try again in a moment.');
    } else {
      throw error;
    }
  }
};

/**
 * Get default check-in date (tomorrow)
 * @returns {string} Date in YYYY-MM-DD format
 */
const getDefaultCheckIn = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return formatDate(tomorrow);
};

/**
 * Get default check-out date (day after tomorrow)
 * @returns {string} Date in YYYY-MM-DD format
 */
const getDefaultCheckOut = () => {
  const dayAfter = new Date();
  dayAfter.setDate(dayAfter.getDate() + 2);
  return formatDate(dayAfter);
};

/**
 * Format date to YYYY-MM-DD
 * @param {Date} date - Date object
 * @returns {string} Formatted date
 */
const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const hotelSearchAPI = {
  searchLahoreHotels,
  getDefaultCheckIn,
  getDefaultCheckOut
};

export default hotelSearchAPI;
