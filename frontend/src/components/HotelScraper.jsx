import React, { useState } from 'react';
import axios from 'axios';
import './HotelScraper.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const PAKISTAN_CITIES = [
  { name: 'Lahore', dest_id: '-2767043' },
  { name: 'Karachi', dest_id: '-2240905' },
  { name: 'Islamabad', dest_id: '-2290032' },
  { name: 'Rawalpindi', dest_id: '-2290033' },
  { name: 'Faisalabad', dest_id: '-2762268' },
  { name: 'Multan', dest_id: '-2240572' }
];

const HotelScraper = () => {
  const [searchParams, setSearchParams] = useState({
    city: 'Lahore',
    dest_id: '-2767043',
    checkin: '',
    checkout: '',
    adults: 3,
    rooms: 1,
    children: 0,
    use_cache: true
  });

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const handleCityChange = (e) => {
    const selectedCity = PAKISTAN_CITIES.find(c => c.name === e.target.value);
    setSearchParams({
      ...searchParams,
      city: selectedCity.name,
      dest_id: selectedCity.dest_id
    });
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSearchParams({
      ...searchParams,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/scraper/scrape-hotels/`,
        searchParams
      );

      if (response.data.success) {
        setResults(response.data);
      } else {
        setError(response.data.message || 'Failed to scrape hotels');
      }
    } catch (err) {
      console.error('Scraping error:', err);
      setError(err.response?.data?.message || err.message || 'An error occurred while scraping');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="hotel-scraper-container">
      <div className="scraper-header">
        <h1>🔍 Hotel Data Scraper</h1>
        <p className="warning-text">
          ⚠️ <strong>Disclaimer:</strong> This tool is for educational purposes. 
          Please respect Booking.com's Terms of Service and robots.txt.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="scraper-form">
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="city">City</label>
            <select
              id="city"
              name="city"
              value={searchParams.city}
              onChange={handleCityChange}
              className="form-input"
            >
              {PAKISTAN_CITIES.map(city => (
                <option key={city.dest_id} value={city.name}>
                  {city.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="checkin">Check-in Date</label>
            <input
              type="date"
              id="checkin"
              name="checkin"
              value={searchParams.checkin}
              onChange={handleInputChange}
              className="form-input"
              required
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div className="form-group">
            <label htmlFor="checkout">Check-out Date</label>
            <input
              type="date"
              id="checkout"
              name="checkout"
              value={searchParams.checkout}
              onChange={handleInputChange}
              className="form-input"
              required
              min={searchParams.checkin || new Date().toISOString().split('T')[0]}
            />
          </div>

          <div className="form-group">
            <label htmlFor="adults">Adults</label>
            <input
              type="number"
              id="adults"
              name="adults"
              value={searchParams.adults}
              onChange={handleInputChange}
              className="form-input"
              min="1"
              max="10"
            />
          </div>

          <div className="form-group">
            <label htmlFor="rooms">Rooms</label>
            <input
              type="number"
              id="rooms"
              name="rooms"
              value={searchParams.rooms}
              onChange={handleInputChange}
              className="form-input"
              min="1"
              max="5"
            />
          </div>

          <div className="form-group">
            <label htmlFor="children">Children</label>
            <input
              type="number"
              id="children"
              name="children"
              value={searchParams.children}
              onChange={handleInputChange}
              className="form-input"
              min="0"
              max="10"
            />
          </div>
        </div>

        <div className="form-group checkbox-group">
          <label>
            <input
              type="checkbox"
              name="use_cache"
              checked={searchParams.use_cache}
              onChange={handleInputChange}
            />
            <span>Use cached results (if available)</span>
          </label>
        </div>

        <button 
          type="submit" 
          className="scrape-button"
          disabled={loading}
        >
          {loading ? '🔄 Scraping...' : '🚀 Scrape Hotels'}
        </button>
      </form>

      {loading && (
        <div className="loading-message">
          <div className="spinner"></div>
          <p>Scraping hotel data... This may take 30-60 seconds.</p>
          <p className="sub-text">Bypassing bot detection and extracting data...</p>
        </div>
      )}

      {error && (
        <div className="error-message">
          <h3>❌ Error</h3>
          <p>{error}</p>
          <div className="error-help">
            <h4>Common Issues:</h4>
            <ul>
              <li>AWS WAF bot detection - Try using Puppeteer scraper</li>
              <li>Selenium/ChromeDriver not installed</li>
              <li>Rate limiting - Wait a few minutes and try again</li>
            </ul>
          </div>
        </div>
      )}

      {results && (
        <div className="results-container">
          <div className="results-header">
            <h2>✅ Scraping Results</h2>
            <div className="results-meta">
              <span className="badge">
                {results.cached ? '📦 Cached' : '🆕 Fresh'}
              </span>
              <span className="badge">
                {results.count} Hotels Found
              </span>
            </div>
          </div>

          <div className="search-summary">
            <h3>Search Parameters:</h3>
            <p>📍 <strong>{results.search_params.city}</strong></p>
            <p>📅 {results.search_params.checkin} → {results.search_params.checkout}</p>
            <p>👥 {results.search_params.adults} Adults, {results.search_params.rooms} Room(s)</p>
          </div>

          <div className="hotels-grid">
            {results.hotels.map((hotel, index) => (
              <div key={index} className="hotel-card">
                {hotel.image_url && (
                  <div className="hotel-image">
                    <img src={hotel.image_url} alt={hotel.name} />
                  </div>
                )}
                
                <div className="hotel-content">
                  <h3 className="hotel-name">{hotel.name || 'Unnamed Hotel'}</h3>
                  
                  {hotel.location && (
                    <p className="hotel-location">📍 {hotel.location}</p>
                  )}
                  
                  {hotel.distance && (
                    <p className="hotel-distance">🗺️ {hotel.distance}</p>
                  )}
                  
                  <div className="hotel-rating">
                    {hotel.rating && (
                      <span className="rating-score">⭐ {hotel.rating}</span>
                    )}
                    {hotel.review_count && (
                      <span className="review-count">({hotel.review_count})</span>
                    )}
                  </div>
                  
                  {hotel.price && (
                    <div className="hotel-price">
                      <span className="price-label">Price:</span>
                      <span className="price-value">{hotel.price}</span>
                    </div>
                  )}
                  
                  {hotel.amenities && hotel.amenities.length > 0 && (
                    <div className="hotel-amenities">
                      <strong>Amenities:</strong>
                      <div className="amenities-tags">
                        {hotel.amenities.map((amenity, idx) => (
                          <span key={idx} className="amenity-tag">{amenity}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {hotel.url && (
                    <a 
                      href={hotel.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="view-details-btn"
                    >
                      View Details →
                    </a>
                  )}
                </div>
                
                <div className="scrape-info">
                  <small>Scraped: {new Date(hotel.scraped_at).toLocaleString()}</small>
                </div>
              </div>
            ))}
          </div>

          <button 
            onClick={() => {
              const dataStr = JSON.stringify(results.hotels, null, 2);
              const dataBlob = new Blob([dataStr], { type: 'application/json' });
              const url = URL.createObjectURL(dataBlob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `hotels_${searchParams.city}_${new Date().toISOString()}.json`;
              link.click();
            }}
            className="download-button"
          >
            📥 Download JSON
          </button>
        </div>
      )}
    </div>
  );
};

export default HotelScraper;
