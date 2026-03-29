# 🕷️ Web Scraping System – Travello

Complete documentation for the hotel data scraping system that extracts real-time pricing and availability from Booking.com.

---

## Table of Contents

- [Disclaimer](#disclaimer)
- [Overview](#overview)
- [Architecture](#architecture)
- [Installation](#installation)
- [API Endpoints](#api-endpoints)
- [Supported Cities](#supported-cities)
- [URL Parameters](#url-parameters)
- [Data Extraction](#data-extraction)
- [Bot Detection & Stealth](#bot-detection--stealth)
- [Caching & Rate Limiting](#caching--rate-limiting)
- [Troubleshooting](#troubleshooting)
- [Configuration](#configuration)
- [Testing](#testing)

---

## Disclaimer

> **This scraper is for educational purposes only (FYP).** Web scraping may violate the Terms of Service of target websites.
>
> - Review the target website's Terms of Service before use
> - Respect `robots.txt` rules
> - Use official APIs for production / commercial use (e.g. Booking.com Affiliate API)
> - Implement rate limiting to avoid overloading servers

---

## Overview

The scraper extracts hotel search data from Booking.com including:

- Hotel names, prices, ratings, review counts
- Locations & distances from city center
- Amenities (WiFi, pool, parking, etc.)
- Images and booking URLs
- Check-in / check-out availability

Two scraper engines are available:

| Engine | Language | Bot Bypass | Speed | Recommended |
|--------|----------|-----------|-------|-------------|
| **Puppeteer** | Node.js | ✅ Stealth plugin | Fast | ✅ Yes |
| **Selenium** | Python | ⚠️ Basic | Slower | Fallback only |

---

## Architecture

```
React Frontend
      ↓  POST /api/scraper/scrape-hotels/
Django REST API (views.py)
      ↓
┌─────────────────┬───────────────────┐
│  booking_       │  puppeteer_       │
│  scraper.py     │  scraper.js       │
│  (Selenium)     │  (Puppeteer)      │
└────────┬────────┴────────┬──────────┘
         │                 │
         └────────┬────────┘
                  ↓
         Booking.com Website
                  ↓
         JSON Response → Frontend
```

**File structure:**

```
backend/scraper/
├── booking_scraper.py       # Python/Selenium scraper
├── puppeteer_scraper.js     # Node.js/Puppeteer scraper (recommended)
├── package.json             # Node.js dependencies
├── views.py                 # Django API views
├── urls.py                  # URL routing
└── models.py                # Data models
```

---

## Installation

### Puppeteer (Recommended)

```powershell
cd backend/scraper
npm install
```

This installs:
- `puppeteer` — Headless Chromium browser automation
- `puppeteer-extra` — Plugin system for Puppeteer
- `puppeteer-extra-plugin-stealth` — Bypasses bot detection (AWS WAF)

### Selenium (Fallback)

```bash
pip install selenium webdriver-manager
```

ChromeDriver is managed automatically by `webdriver-manager`.

---

## API Endpoints

### 1. Scrape Hotels

```http
POST /api/scraper/scrape-hotels/
Content-Type: application/json
Authorization: Bearer <token>

{
  "city": "Lahore",
  "dest_id": "-2767043",
  "checkin": "2026-04-01",
  "checkout": "2026-04-05",
  "adults": 2,
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
      "scraped_at": "2026-04-01T10:30:00"
    }
  ]
}
```

### 2. Get Supported Destinations

```http
GET /api/scraper/destinations/
```

Returns list of supported Pakistani cities with their Booking.com destination IDs.

### 3. Test Scraper Setup

```http
POST /api/scraper/test/
```

Checks if Puppeteer/Selenium and Chrome are available.

---

## Supported Cities

| City | Destination ID | Key |
|------|---------------|-----|
| Lahore | `-2767043` | `lahore` |
| Karachi | `-2240905` | `karachi` |
| Islamabad | `-2290032` | `islamabad` |
| Rawalpindi | `-2290033` | `rawalpindi` |
| Faisalabad | `-2762268` | `faisalabad` |
| Multan | `-2240572` | `multan` |

---

## URL Parameters

The scraper constructs Booking.com search URLs:

```
https://www.booking.com/searchresults.html?
  ss=Lahore                    # City name
  &dest_id=-2767043            # Unique destination ID
  &dest_type=city              # Always "city"
  &checkin=2026-04-01          # Check-in (YYYY-MM-DD)
  &checkout=2026-04-05         # Check-out (YYYY-MM-DD)
  &group_adults=2              # Number of adults
  &no_rooms=1                  # Number of rooms
  &group_children=0            # Number of children
```

---

## Data Extraction

### CSS Selectors Used

```css
[data-testid="property-card"]                  /* Hotel card container */
[data-testid="title"]                           /* Hotel name */
[data-testid="title-link"]                      /* Hotel URL */
[data-testid="price-and-discounted-price"]      /* Price */
[data-testid="review-score"]                    /* Rating */
[data-testid="address"]                         /* Location */
[data-testid="distance"]                        /* Distance from center */
[data-testid="facility-badge"]                  /* Amenities */
img[data-testid="image"]                        /* Hotel image */
```

> ⚠️ Selectors may change if Booking.com updates their HTML. Check and update accordingly.

---

## Bot Detection & Stealth

Booking.com uses **AWS WAF** (Web Application Firewall). The Puppeteer scraper uses these evasion techniques:

1. **Stealth Plugin** — Patches browser fingerprint (WebGL, plugins, languages)
2. **Randomized User-Agent** — Rotates between real browser signatures
3. **Human-like Delays** — Random wait times between actions
4. **Headless Detection Bypass** — Hides `navigator.webdriver` flag

If you still get blocked:
- Increase delays between requests
- Use residential proxies: `--proxy-server=http://your-proxy:port`
- Rotate User-Agent strings
- Run during off-peak hours

---

## Caching & Rate Limiting

### Caching

Results are cached to reduce scraping frequency:

```python
# Cache key format
cache_key = f"scrape_{city}_{checkin}_{checkout}"
# Default TTL: 15 minutes (configurable via SCRAPER_CACHE_TTL_MINS)
```

Send `"use_cache": true` in API requests to use cached results when available.

### Rate Limiting

- Max concurrent scrapes: 4 (configurable via `SCRAPER_CONCURRENCY_LIMIT`)
- Per-run time limit: 140s (configurable via `SCRAPER_MAX_SECONDS`)
- Hard timeout: 200s (configurable via `SCRAPER_HARD_TIMEOUT`)

---

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| "Bot detection challenge detected!" | AWS WAF blocked the request | Use Puppeteer (not Selenium), increase delays |
| No hotels returned | Page didn't load or selectors changed | Check Chrome DevTools for updated selectors |
| ChromeDriver not found | Missing Chrome or driver | `pip install webdriver-manager` |
| Puppeteer errors | Node.js not installed or wrong version | Install Node.js 18+ and run `npm install` in `backend/scraper/` |
| Timeout errors | Slow network or heavy page | Increase timeout in settings: `SCRAPER_MAX_SECONDS=200` |
| Empty price fields | Booking.com A/B testing different layouts | Update CSS selectors for price element |

---

## Configuration

All scraper settings are in Django settings (`backend/travello_backend/travello_backend/settings.py`):

```python
SCRAPER_MAX_RESULTS = 600          # Target hotel count
SCRAPER_CACHE_TTL_MINS = 15       # Cache lifetime in minutes
SCRAPER_CONCURRENCY_LIMIT = 4     # Max parallel scrapes
SCRAPER_MAX_SECONDS = 140         # Per-run time limit
SCRAPER_HARD_TIMEOUT = 200        # Subprocess hard timeout
```

---

## Testing

### Test Puppeteer Directly

```powershell
cd backend/scraper
node puppeteer_scraper.js '{"city":"Lahore","checkin":"2026-04-01","checkout":"2026-04-05"}'
```

### Test via API

```bash
# Test scraper availability
curl -X POST http://localhost:8000/api/scraper/test/ \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test scraping
curl -X POST http://localhost:8000/api/scraper/scrape-hotels/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"city": "Lahore", "checkin": "2026-04-01", "checkout": "2026-04-05", "adults": 2, "rooms": 1}'
```
