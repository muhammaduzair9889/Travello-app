# Web Scraper Module

This module handles web scraping of hotel data from Booking.com.

## ⚠️ Disclaimer

This scraper is for **educational purposes only**. Always:
- Respect the website's Terms of Service
- Follow robots.txt guidelines
- Implement rate limiting
- Consider using official APIs for production

## Files

- `booking_scraper.py` - Python/Selenium-based scraper
- `puppeteer_scraper.js` - Node.js/Puppeteer-based scraper (better bot bypass)
- `views.py` - Django REST API endpoints
- `urls.py` - URL routing
- `package.json` - Node.js dependencies

## Setup

### Python Dependencies
```bash
pip install selenium webdriver-manager
```

### Node.js Dependencies (Recommended)
```bash
npm install
```

This installs:
- puppeteer
- puppeteer-extra
- puppeteer-extra-plugin-stealth

## Usage

### Via API

```bash
curl -X POST http://localhost:8000/api/scraper/scrape-hotels/ \
  -H "Content-Type: application/json" \
  -d '{
    "city": "Lahore",
    "checkin": "2026-02-10",
    "checkout": "2026-02-15",
    "adults": 2,
    "rooms": 1
  }'
```

### Direct Python

```python
from scraper.booking_scraper import BookingScraper

scraper = BookingScraper()
hotels = scraper.scrape_hotels_sync({
    'city': 'Lahore',
    'checkin': '2026-02-10',
    'checkout': '2026-02-15',
    'adults': 2,
    'rooms': 1
})

print(f"Found {len(hotels)} hotels")
```

### Direct Node.js

```bash
node puppeteer_scraper.js '{"city":"Lahore","checkin":"2026-02-10","checkout":"2026-02-15"}'
```

## API Endpoints

- `POST /api/scraper/scrape-hotels/` - Scrape hotel data
- `GET /api/scraper/destinations/` - Get supported cities
- `POST /api/scraper/test/` - Test scraper setup

## Supported Cities

- Lahore (dest_id: -2767043)
- Karachi (dest_id: -2240905)
- Islamabad (dest_id: -2290032)
- Rawalpindi (dest_id: -2290033)
- Faisalabad (dest_id: -2762268)
- Multan (dest_id: -2240572)

## Extracted Data

Each hotel includes:
- Name
- Price
- Rating (1-10)
- Review count
- Location/Address
- Distance from center
- Amenities
- Image URL
- Booking URL

## Bot Detection

Booking.com uses AWS WAF for bot protection. This module includes:

1. **Selenium scraper** - Basic bot detection bypass
2. **Puppeteer scraper** - Advanced stealth techniques (recommended)
3. **Caching** - Reduce scraping frequency
4. **Rate limiting** - Respectful scraping patterns

## Troubleshooting

**AWS WAF Challenge Detected:**
- Use Puppeteer scraper (better stealth)
- Increase delays between requests
- Enable caching

**ChromeDriver Not Found:**
```bash
pip install webdriver-manager
```

**Puppeteer Not Working:**
```bash
npm install
```

## Documentation

See root directory for complete documentation:
- `WEB_SCRAPING_DOCUMENTATION.md` - Full guide
- `WEB_SCRAPING_QUICK_START.md` - Quick setup
- `WEB_SCRAPING_COMPLETE.md` - Implementation summary
