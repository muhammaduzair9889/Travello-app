/**
 * Alternative Puppeteer-based scraper for better bot detection bypass
 * Requires Node.js to be installed
 * 
 * To use this:
 * 1. Install Node.js
 * 2. Run: npm install puppeteer puppeteer-extra puppeteer-extra-plugin-stealth
 * 3. Call this script from Python using subprocess
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function scrapeBookingHotels(searchParams) {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            executablePath: process.env.CHROME_PATH || undefined, // Use system Chrome if available
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1920x1080',
                '--disable-blink-features=AutomationControlled',
                '--disable-features=IsolateOrigins,site-per-process'
            ],
            ignoreDefaultArgs: ['--enable-automation'],
            timeout: 60000 // Increase timeout to 60 seconds
        });
    } catch (error) {
        console.error('Failed to launch browser:', error.message);
        console.log('[]'); // Return empty array as JSON
        process.exit(0);
    }

    try {
        const page = await browser.newPage();
        
        // Set user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Set viewport
        await page.setViewport({ width: 1920, height: 1080 });
        
        // Build URL
        const baseUrl = 'https://www.booking.com/searchresults.html';
        const params = new URLSearchParams({
            ss: searchParams.city || 'Lahore',
            ssne: searchParams.city || 'Lahore',
            ssne_untouched: searchParams.city || 'Lahore',
            dest_id: searchParams.dest_id || '-2767043',
            dest_type: searchParams.dest_type || 'city',
            checkin: searchParams.checkin || '2026-02-02',
            checkout: searchParams.checkout || '2026-02-07',
            group_adults: searchParams.adults || 3,
            no_rooms: searchParams.rooms || 1,
            group_children: searchParams.children || 0,
            lang: 'en-us',
            sb: 1,
            src_elem: 'sb',
            src: 'index'
        });
        
        const url = `${baseUrl}?${params.toString()}`;
        console.log('Navigating to:', url);
        
        // Navigate with extended timeout for bot challenge
        await page.goto(url, { 
            waitUntil: 'networkidle2',
            timeout: 60000 
        });
        
        // Wait for content to load
        try {
            await page.waitForSelector('[data-testid="property-card"]', { timeout: 30000 });
        } catch (error) {
            console.log('Timeout waiting for hotel cards. Checking for challenge...');
            const content = await page.content();
            if (content.includes('challenge') || content.includes('robot')) {
                console.error('Bot detection challenge detected!');
                await page.screenshot({ path: 'challenge_detected.png' });
                return [];
            }
        }
        
        // Extra wait for dynamic content
        await page.waitForTimeout(3000);
        
        // Extract hotel data
        const hotels = await page.evaluate(() => {
            const hotelCards = document.querySelectorAll('[data-testid="property-card"]');
            const results = [];
            
            hotelCards.forEach(card => {
                try {
                    const hotel = {
                        scraped_at: new Date().toISOString(),
                        source: 'booking.com'
                    };
                    
                    // Name
                    const nameElem = card.querySelector('[data-testid="title"]');
                    hotel.name = nameElem ? nameElem.textContent.trim() : null;
                    
                    // URL
                    const linkElem = card.querySelector('a[data-testid="title-link"]');
                    hotel.url = linkElem ? linkElem.href : null;
                    
                    // Price
                    const priceElem = card.querySelector('[data-testid="price-and-discounted-price"]');
                    hotel.price = priceElem ? priceElem.textContent.trim() : null;
                    
                    // Rating
                    const ratingElem = card.querySelector('[data-testid="review-score"] div');
                    hotel.rating = ratingElem ? ratingElem.textContent.trim() : null;
                    
                    // Review count
                    const reviewsElem = card.querySelector('[data-testid="review-score"] .d8eab2cf7f');
                    hotel.review_count = reviewsElem ? reviewsElem.textContent.trim() : null;
                    
                    // Location
                    const locationElem = card.querySelector('[data-testid="address"]');
                    hotel.location = locationElem ? locationElem.textContent.trim() : null;
                    
                    // Distance
                    const distanceElem = card.querySelector('[data-testid="distance"]');
                    hotel.distance = distanceElem ? distanceElem.textContent.trim() : null;
                    
                    // Amenities
                    const amenityElems = card.querySelectorAll('[data-testid="facility-badge"]');
                    hotel.amenities = Array.from(amenityElems).map(a => a.textContent.trim());
                    
                    // Image
                    const imgElem = card.querySelector('img[data-testid="image"]');
                    hotel.image_url = imgElem ? imgElem.src : null;
                    
                    if (hotel.name) {
                        results.push(hotel);
                    }
                } catch (error) {
                    console.error('Error extracting hotel:', error);
                }
            });
            
            return results;
        });
        
        console.log(`Successfully extracted ${hotels.length} hotels`);
        
        // If no hotels found, save page HTML for debugging
        if (hotels.length === 0) {
            const html = await page.content();
            console.error('No hotels found. Page title:', await page.title());
            // Output empty array
            console.log('[]');
        } else {
            // Output JSON
            console.log(JSON.stringify(hotels));
        }
        
        return hotels;
        
    } catch (error) {
        console.error('Scraping error:', error.message);
        console.log('[]'); // Output empty array
        return [];
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Command line interface
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.error('Usage: node puppeteer_scraper.js \'{"city":"Lahore","dest_id":"-2767043",...}\'');
        console.log('[]');
        process.exit(1);
    }
    
    let searchParams;
    try {
        searchParams = JSON.parse(args[0]);
    } catch (e) {
        console.error('Invalid JSON:', e.message);
        console.log('[]');
        process.exit(1);
    }
    
    scrapeBookingHotels(searchParams).then(hotels => {
        // Already output in function
        process.exit(0);
    }).catch(error => {
        console.error('Fatal error:', error.message);
        console.log('[]');
        process.exit(1);
    });
}

module.exports = { scrapeBookingHotels };
