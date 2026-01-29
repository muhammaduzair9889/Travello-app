# Web Scraping System Documentation

## ⚠️ Important Disclaimers

**PLEASE READ CAREFULLY:**

1. **Legal Compliance**: Web scraping may violate the Terms of Service of websites. Always:
   - Review the target website's Terms of Service
   - Check and respect robots.txt files
   - Obtain explicit permission when possible
   - Consider using official APIs instead

2. **Ethical Considerations**:
   - Implement rate limiting to avoid overloading servers
   - Use reasonable delays between requests
   - Don't scrape personal or sensitive data without consent
   - Respect website resources and bandwidth

3. **Bot Detection**: Booking.com uses **AWS WAF** (Web Application Firewall) for bot protection. This system includes:
   - Selenium WebDriver scraper (basic)
   - Puppeteer scraper (advanced, better at bypassing detection)

## 📋 System Overview

The web scraping system extracts hotel search data from Booking.com, including:
- Hotel names
- Prices
- Ratings & reviews
- Locations & distances
- Amenities
- Images
- Booking URLs

## 🏗️ Architecture

```
Frontend (React)
    ↓
Django REST API
    ↓
┌─────────────┬──────────────┐
│  Selenium   │  Puppeteer   │
│  Scraper    │  Scraper     │
└─────────────┴──────────────┘
    ↓
Booking.com Website
```

## 🚀 Installation & Setup

### Option 1: Selenium (Python-based)

1. **Install Python dependencies:**
```bash
cd backend
pip install selenium webdriver-manager
```

2. **Install ChromeDriver:**
   - **Windows**: Download from https://chromedriver.chromium.org/
   - **Or use webdriver-manager** (automatic):
   ```python
   from selenium import webdriver
   from webdriver_manager.chrome import ChromeDriverManager
   driver = webdriver.Chrome(ChromeDriverManager().install())
   ```

3. **Update requirements.txt:**
```bash
echo "selenium==4.16.0" >> requirements.txt
echo "webdriver-manager==4.0.1" >> requirements.txt
```

### Option 2: Puppeteer (Node.js-based) - RECOMMENDED

1. **Install Node.js** (if not installed):
   - Download from https://nodejs.org/

2. **Install Puppeteer dependencies:**
```bash
cd backend/scraper
npm install
```

This installs:
- puppeteer
- puppeteer-extra
- puppeteer-extra-plugin-stealth (bypasses bot detection)

3. **Test Puppeteer:**
```bash
node puppeteer_scraper.js '{"city":"Lahore","checkin":"2026-02-02","checkout":"2026-02-07"}'
```

## 📡 API Endpoints

### 1. Scrape Hotels
```http
POST /api/scraper/scrape-hotels/
Content-Type: application/json

{
  "city": "Lahore",
  "dest_id": "-2767043",
  "checkin": "2026-02-02",
  "checkout": "2026-02-07",
  "adults": 3,
  "rooms": 1,
  "children": 0,
  "use_cache": true
}
```

**Response:**
```json
{
  "success": true,
  "count": 25,
  "cached": false,
  "search_params": { ... },
  "hotels": [
    {
      "name": "Pearl Continental Hotel Lahore",
      "url": "https://booking.com/...",
      "price": "PKR 25,000",
      "rating": "8.5",
      "review_count": "1,234 reviews",
      "location": "Mall Road, Lahore",
      "distance": "1.2 km from center",
      "amenities": ["Free WiFi", "Pool", "Spa"],
      "image_url": "https://...",
      "scraped_at": "2026-01-28T10:30:00"
    }
  ]
}
```

### 2. Get Supported Destinations
```http
GET /api/scraper/destinations/
```

**Response:**
```json
{
  "success": true,
  "destinations": [
    {
      "city": "Lahore",
      "dest_id": "-2767043",
      "country": "Pakistan",
      "key": "lahore"
    },
    ...
  ]
}
```

### 3. Test Scraper Setup
```http
POST /api/scraper/test/
```

**Response:**
```json
{
  "success": true,
  "selenium_available": true,
  "chrome_driver_available": true,
  "message": "Scraper is ready"
}
```

## 🔍 URL Parameters Explained

From your example URL:
```
https://www.booking.com/searchresults.html?
  ss=Lahore                    # Search string (city name)
  &dest_id=-2767043            # Destination ID (unique for each city)
  &dest_type=city              # Type: city, region, hotel, etc.
  &checkin=2026-02-02          # Check-in date (YYYY-MM-DD)
  &checkout=2026-02-07         # Check-out date (YYYY-MM-DD)
  &group_adults=3              # Number of adults
  &no_rooms=1                  # Number of rooms
  &group_children=0            # Number of children
```

## 🇵🇰 Pakistani Cities Destination IDs

| City       | Destination ID |
|------------|----------------|
| Lahore     | -2767043       |
| Karachi    | -2240905       |
| Islamabad  | -2290032       |
| Rawalpindi | -2290033       |
| Faisalabad | -2762268       |
| Multan     | -2240572       |

## 💻 Frontend Usage

### 1. Import the Component
```jsx
import HotelScraper from './components/HotelScraper';

function App() {
  return (
    <div>
      <HotelScraper />
    </div>
  );
}
```

### 2. Configure API URL
In `.env`:
```
REACT_APP_API_URL=http://localhost:8000
```

## 🛠️ Troubleshooting

### Problem: AWS WAF Challenge Detected

**Symptoms:**
- "Bot detection challenge detected!" error
- No hotels returned
- Timeout waiting for hotel cards

**Solutions:**

1. **Use Puppeteer instead of Selenium** (better stealth):
```javascript
// backend/scraper/puppeteer_scraper.js is already configured
```

2. **Add more delays:**
```python
await asyncio.sleep(5)  # Increase wait time
```

3. **Use residential proxies** (advanced):
```python
chrome_options.add_argument('--proxy-server=http://your-proxy:port')
```

4. **Rotate User Agents:**
```python
user_agents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...'
]
```

### Problem: ChromeDriver Not Found

**Solution:**
```bash
pip install webdriver-manager
```

Then update scraper to use:
```python
from webdriver_manager.chrome import ChromeDriverManager
driver = webdriver.Chrome(ChromeDriverManager().install())
```

### Problem: Timeout Errors

**Solution:**
Increase timeouts in [booking_scraper.py](backend/scraper/booking_scraper.py):
```python
wait = WebDriverWait(driver, 60)  # Increase from 30 to 60
```

## 📊 Data Extraction Details

### HTML Selectors Used

The scraper uses these CSS selectors (as of Jan 2026):

```css
[data-testid="property-card"]      /* Hotel card container */
[data-testid="title"]               /* Hotel name */
[data-testid="title-link"]          /* Hotel URL */
[data-testid="price-and-discounted-price"] /* Price */
[data-testid="review-score"]        /* Rating */
[data-testid="address"]             /* Location */
[data-testid="distance"]            /* Distance from center */
[data-testid="facility-badge"]      /* Amenities */
img[data-testid="image"]            /* Hotel image */
```

⚠️ **Note**: Selectors may change if Booking.com updates their website.

## 🔒 Rate Limiting & Caching

### Caching System

Results are cached for **1 hour** using Django's cache framework:

```python
cache_key = f"scrape_{city}_{checkin}_{checkout}"
cache.set(cache_key, hotels, 3600)  # 1 hour
```

### Rate Limiting Recommendations

Implement delays between requests:

```python
import time
time.sleep(2)  # 2 second delay between requests
```

For production, use Django rate limiting:
```bash
pip install django-ratelimit
```

## 🎯 Best Practices

1. **Use Caching**: Enable `use_cache: true` to reduce scraping frequency

2. **Schedule Off-Peak Scraping**: Run scraping during low-traffic hours

3. **Monitor Logs**: Check for bot detection patterns

4. **Respect robots.txt**: Add to scraper:
```python
def check_robots_txt(self, url):
    # Implementation to respect robots.txt
    pass
```

5. **Add Request Headers**:
```python
headers = {
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': 'https://www.booking.com/'
}
```

## 🚦 Testing

### Test Backend API
```bash
# Test scraper availability
curl -X POST http://localhost:8000/api/scraper/test/

# Test scraping
curl -X POST http://localhost:8000/api/scraper/scrape-hotels/ \
  -H "Content-Type: application/json" \
  -d '{
    "city": "Lahore",
    "checkin": "2026-02-02",
    "checkout": "2026-02-07",
    "adults": 2,
    "rooms": 1
  }'
```

### Test Puppeteer Directly
```bash
cd backend/scraper
node puppeteer_scraper.js '{"city":"Lahore","checkin":"2026-02-10","checkout":"2026-02-15"}'
```

## 📝 Logging

Enable detailed logging in Django settings:

```python
LOGGING = {
    'version': 1,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'loggers': {
        'scraper': {
            'handlers': ['console'],
            'level': 'DEBUG',
        },
    },
}
```

## 🔄 Alternative: Using Official APIs

Consider using Booking.com's official APIs instead:

1. **Booking.com Affiliate Partner Program**
   - URL: https://www.booking.com/affiliate-program/
   - Provides official API access
   - Legal and reliable

2. **RapidAPI Booking.com API**
   - URL: https://rapidapi.com/
   - Third-party API wrapper
   - Paid service

## 📦 Project Structure

```
backend/
└── scraper/
    ├── __init__.py
    ├── booking_scraper.py      # Python/Selenium scraper
    ├── puppeteer_scraper.js    # Node.js/Puppeteer scraper
    ├── package.json            # Node.js dependencies
    ├── views.py                # Django API views
    └── urls.py                 # API URL routes

frontend/
└── src/
    └── components/
        ├── HotelScraper.jsx    # React component
        └── HotelScraper.css    # Styles
```

## 🎓 Learning Resources

- [Selenium Documentation](https://selenium-python.readthedocs.io/)
- [Puppeteer Documentation](https://pptr.dev/)
- [Web Scraping Best Practices](https://www.scrapehero.com/web-scraping-best-practices/)
- [robots.txt Guide](https://developers.google.com/search/docs/crawling-indexing/robots/intro)

## ⚖️ Legal Resources

- [Web Scraping Legality](https://www.eff.org/issues/coders/reverse-engineering-faq)
- [Terms of Service](https://www.booking.com/content/terms.html)
- [GDPR Compliance](https://gdpr.eu/)

---

**Remember**: Always prioritize legal compliance and ethical scraping practices. When in doubt, seek legal advice or use official APIs.
