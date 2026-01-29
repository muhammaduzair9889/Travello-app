# Quick Start: Web Scraping Setup

## 🚀 Fast Setup (5 Minutes)

### Step 1: Install Dependencies

**For Selenium (Simpler but less effective):**
```bash
cd backend
pip install selenium webdriver-manager
```

**For Puppeteer (Recommended - Better bot bypass):**
```bash
cd backend/scraper
npm install
```

### Step 2: Test the Scraper

**Test backend is configured:**
```bash
cd backend
python manage.py shell
```

Then:
```python
from scraper.booking_scraper import BookingScraper
scraper = BookingScraper()
url = scraper.build_search_url({'city': 'Lahore', 'checkin': '2026-02-02', 'checkout': '2026-02-07'})
print(url)
```

### Step 3: Start Backend Server
```bash
cd backend
python manage.py runserver
```

### Step 4: Test API Endpoint
```bash
curl -X POST http://localhost:8000/api/scraper/test/
```

### Step 5: Try Scraping
```bash
curl -X POST http://localhost:8000/api/scraper/scrape-hotels/ \
  -H "Content-Type: application/json" \
  -d '{"city":"Lahore","checkin":"2026-02-10","checkout":"2026-02-15","adults":2,"rooms":1}'
```

## 📱 Using the Frontend

1. **Import component in your app:**

```jsx
// In App.js or Routes.js
import HotelScraper from './components/HotelScraper';

function App() {
  return (
    <div>
      <HotelScraper />
    </div>
  );
}
```

2. **Start frontend:**
```bash
cd frontend
npm start
```

3. **Navigate to the scraper page**

4. **Fill in search parameters and click "Scrape Hotels"**

## ⚡ Quick API Reference

### Scrape Hotels
```http
POST /api/scraper/scrape-hotels/
{
  "city": "Lahore",
  "checkin": "2026-02-02",
  "checkout": "2026-02-07",
  "adults": 3,
  "rooms": 1
}
```

### Get Cities List
```http
GET /api/scraper/destinations/
```

## 🔧 Common Issues & Quick Fixes

**❌ "Selenium not found"**
```bash
pip install selenium webdriver-manager
```

**❌ "ChromeDriver not found"**
```bash
pip install webdriver-manager
# It will auto-download ChromeDriver
```

**❌ "AWS WAF challenge detected"**
- Switch to Puppeteer scraper
- Add longer delays
- Use the cached results option

**❌ "Module 'scraper' not found"**
- Make sure 'scraper' is in INSTALLED_APPS in settings.py
- Restart Django server

## 📊 What Gets Scraped

From each hotel:
- ✅ Name
- ✅ Price
- ✅ Rating (1-10)
- ✅ Review count
- ✅ Location/Address
- ✅ Distance from city center
- ✅ Amenities (WiFi, Pool, etc.)
- ✅ Main image
- ✅ Booking URL

## 🎯 Next Steps

1. Read [WEB_SCRAPING_DOCUMENTATION.md](WEB_SCRAPING_DOCUMENTATION.md) for full details
2. Customize the scraper for other cities
3. Integrate with your hotel database
4. Add scheduling for automatic updates
5. Implement error handling and notifications

---

**⚠️ Legal Notice**: Always respect Terms of Service and use official APIs when available. This tool is for educational purposes.
