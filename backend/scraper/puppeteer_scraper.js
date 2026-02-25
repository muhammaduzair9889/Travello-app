/**
 * Real-time Booking.com Scraper with Multi-Sort Strategy
 *
 * Booking.com ignores offset/pagination parameters and always returns the same 25 hotels.
 * This scraper uses DIFFERENT SORT ORDERS to get different sets of 25 hotels,
 * then combines and deduplicates them for 125-175+ unique hotels.
 *
 * Sort orders used (all 7 for maximum results):
 *   - popularity, price, review_score_and_price, class, class_asc,
 *     distance_from_landmark, bayesian_review_score
 *
 * Memory optimisation: images, fonts, media and analytics are blocked —
 * hotel text data is unaffected but memory/bandwidth drops ~70%.
 *
 * Requirements: npm install puppeteer puppeteer-extra puppeteer-extra-plugin-stealth
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

// Utility to add random delay (human-like behaviour)
const randomDelay = (min, max) => new Promise(resolve =>
    setTimeout(resolve, Math.floor(Math.random() * (max - min + 1) + min))
);

// All Booking.com sort orders that return different hotel sets
const SORT_ORDERS = [
    'popularity',
    'price',
    'review_score_and_price',
    'class',
    'class_asc',
    'distance_from_landmark',
    'bayesian_review_score'
];

// Resource types that carry zero useful data for scraping — block them to
// save memory, CPU and bandwidth on every tab.
const BLOCKED_RESOURCE_TYPES = new Set([
    'image', 'media', 'font', 'stylesheet',
    'ping', 'other'   // 'other' covers beacon/analytics
]);

// Known analytics / ad domains — block their network requests regardless of type.
const BLOCKED_DOMAINS = [
    'google-analytics.com', 'googletagmanager.com', 'doubleclick.net',
    'facebook.net', 'hotjar.com', 'amplitude.com', 'segment.io',
    'booking-ext.com', 'bizographics.com', 'criteo.com'
];

/**
 * Configure a browser page with stealth + resource-blocking settings.
 */
async function configurePage(page) {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    // Smaller viewport — Booking.com renders the same card data regardless
    await page.setViewport({ width: 1366, height: 768 });

    await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0'
    });

    // Anti-detection overrides
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        Object.defineProperty(navigator, 'plugins',   { get: () => [1, 2, 3, 4, 5] });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        window.chrome = { runtime: {} };
    });

    // ── Block images, fonts, media, analytics ──────────────────────────────
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        const type = req.resourceType();
        const url  = req.url();

        if (BLOCKED_RESOURCE_TYPES.has(type)) {
            req.abort();
            return;
        }
        if (BLOCKED_DOMAINS.some(d => url.includes(d))) {
            req.abort();
            return;
        }
        req.continue();
    });
}

/**
 * Extract hotel data from all property cards on a page.
 * Images are blocked, so fewer scroll pauses are needed.
 */
async function extractHotelsFromPage(page) {
    // Scroll to trigger lazy-loaded card text (images are already blocked)
    for (let i = 0; i < 4; i++) {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        await randomDelay(150, 300);
    }
    await randomDelay(300, 600);

    return await page.evaluate(() => {
        const hotelCards = document.querySelectorAll('[data-testid="property-card"]');
        const results = [];
        
        hotelCards.forEach((card) => {
            try {
                const hotel = {
                    scraped_at: new Date().toISOString(),
                    source: 'booking.com',
                    is_real_time: true
                };
                
                // Hotel Name
                const nameElem = card.querySelector('[data-testid="title"]');
                hotel.name = nameElem ? nameElem.textContent.trim() : null;
                
                // URL
                const linkElem = card.querySelector('a[data-testid="title-link"]');
                hotel.url = linkElem ? linkElem.href : null;
                
                // Price - Try multiple selectors
                let priceElem = card.querySelector('[data-testid="price-and-discounted-price"]');
                if (!priceElem) priceElem = card.querySelector('.prco-valign-middle-helper');
                if (!priceElem) priceElem = card.querySelector('[class*="price"]');
                if (!priceElem) priceElem = card.querySelector('.bui-price-display__value');
                hotel.price = priceElem ? priceElem.textContent.trim() : null;
                
                // Original price (if discounted)
                const originalPriceElem = card.querySelector('[data-testid="price-before-discount"]');
                hotel.original_price = originalPriceElem ? originalPriceElem.textContent.trim() : null;
                
                // Rating score
                const ratingElem = card.querySelector('[data-testid="review-score"] > div:first-child');
                if (!ratingElem) {
                    const altRating = card.querySelector('.bui-review-score__badge');
                    hotel.rating = altRating ? altRating.textContent.trim() : null;
                } else {
                    hotel.rating = ratingElem.textContent.trim();
                }
                
                // Review count
                let reviewCount = null;
                const reviewSelectors = [
                    '[data-testid="review-score"] .abf093bdfe',
                    '[data-testid="review-score"] div:nth-child(2)',
                    '.bui-review-score__text',
                    '[class*="review"] span',
                    '[data-testid="review-score"]'
                ];
                for (const selector of reviewSelectors) {
                    const elem = card.querySelector(selector);
                    if (elem) {
                        const text = elem.textContent.trim();
                        const match = text.match(/(\d[\d,]*)\s*review/i);
                        if (match) {
                            reviewCount = match[1].replace(/,/g, '') + ' reviews';
                            break;
                        }
                        if (text && !reviewCount) {
                            reviewCount = text;
                        }
                    }
                }
                hotel.review_count = reviewCount;
                
                // Location/Address
                const locationElem = card.querySelector('[data-testid="address"]');
                hotel.location = locationElem ? locationElem.textContent.trim() : null;
                
                // Distance from center
                const distanceElem = card.querySelector('[data-testid="distance"]');
                hotel.distance = distanceElem ? distanceElem.textContent.trim() : null;
                
                // Amenities/Facilities
                const amenityElems = card.querySelectorAll('[data-testid="property-card-unit-configuration"] span');
                hotel.amenities = Array.from(amenityElems).map(a => a.textContent.trim()).filter(a => a.length > 0);
                
                if (hotel.amenities.length === 0) {
                    const facilityBadges = card.querySelectorAll('.b5cd09854e');
                    hotel.amenities = Array.from(facilityBadges).map(a => a.textContent.trim()).filter(a => a.length > 0);
                }
                
                // Image URL
                const imgElem = card.querySelector('img[data-testid="image"]');
                if (imgElem) {
                    hotel.image_url = imgElem.src || imgElem.getAttribute('data-src');
                } else {
                    const altImg = card.querySelector('.hotel_image, img');
                    hotel.image_url = altImg ? (altImg.src || altImg.getAttribute('data-src')) : null;
                }
                
                // Room info
                const roomInfoElem = card.querySelector('[data-testid="recommended-units"]');
                hotel.room_info = roomInfoElem ? roomInfoElem.textContent.trim() : null;
                
                // Availability / rooms left
                let roomsLeftCount = null;
                let availabilityText = null;
                let isLimited = false;
                
                if (hotel.room_info) {
                    const leftMatch = hotel.room_info.match(/Only\s*(\d+)\s*(left|room)/i);
                    if (leftMatch) {
                        roomsLeftCount = parseInt(leftMatch[1]);
                        availabilityText = `Only ${roomsLeftCount} left at this price!`;
                        isLimited = true;
                    }
                    if (hotel.room_info.toLowerCase().includes('only') || 
                        hotel.room_info.toLowerCase().includes('left') ||
                        hotel.room_info.toLowerCase().includes('last') ||
                        hotel.room_info.toLowerCase().includes('limited')) {
                        isLimited = true;
                        if (!availabilityText) availabilityText = 'Limited availability';
                    }
                }
                
                const urgencySelectors = [
                    '[data-testid="availability-rate-information"]',
                    '.sr_room_reinforcement',
                    '.urgency_message_red',
                    '.urgency_message',
                    '[class*="urgent"]',
                    '[class*="scarcity"]'
                ];
                for (const selector of urgencySelectors) {
                    const elem = card.querySelector(selector);
                    if (elem) {
                        const text = elem.textContent.trim();
                        if (text && !roomsLeftCount) {
                            const match = text.match(/(\d+)\s*(left|remaining|room)/i);
                            if (match) {
                                roomsLeftCount = parseInt(match[1]);
                                availabilityText = text;
                                isLimited = true;
                                break;
                            }
                        }
                    }
                }
                
                const dealBadge = card.querySelector('[data-testid="deal-badge"], .deal-badge, [class*="deal"]');
                hotel.has_deal = dealBadge ? dealBadge.textContent.trim() : null;
                
                hotel.rooms_left = roomsLeftCount;
                hotel.availability = availabilityText || (isLimited ? 'Limited availability' : 'Available');
                hotel.is_limited = isLimited;
                
                if (hotel.name) {
                    results.push(hotel);
                }
            } catch (error) {
                // Skip this hotel card on error
            }
        });
        
        return results;
    });
}

/**
 * Scrape one sort order in a dedicated browser page
 */
async function scrapeSortOrder(browser, searchParams, sortOrder, index) {
    let page;
    try {
        page = await browser.newPage();
        await configurePage(page);

        const baseUrl = 'https://www.booking.com/searchresults.html';
        const params = new URLSearchParams({
            ss: searchParams.city || 'Lahore',
            ssne: searchParams.city || 'Lahore',
            ssne_untouched: searchParams.city || 'Lahore',
            dest_id: searchParams.dest_id || '-2767043',
            dest_type: searchParams.dest_type || 'city',
            checkin: searchParams.checkin || '2026-02-02',
            checkout: searchParams.checkout || '2026-02-07',
            group_adults: searchParams.adults || 2,
            no_rooms: searchParams.rooms || 1,
            group_children: searchParams.children || 0,
            lang: 'en-us',
            sb: 1,
            src_elem: 'sb',
            src: 'index',
            nflt: '',
            order: sortOrder
        });

        const url = `${baseUrl}?${params.toString()}`;
        console.error(`  [${index + 1}] Navigating sort="${sortOrder}"...`);

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await randomDelay(1200, 2500);

        // Check for bot detection
        const content = await page.content();
        if (content.includes('unusual traffic') || content.includes('CAPTCHA') || content.includes('challenge-running')) {
            console.error(`  [${index + 1}] ⚠️ Bot detection on sort="${sortOrder}", waiting...`);
            await randomDelay(4000, 6000);
        }

        // Wait for property cards
        try {
            await page.waitForSelector('[data-testid="property-card"]', { timeout: 20000 });
        } catch {
            console.error(`  [${index + 1}] ⚠️ No property cards for sort="${sortOrder}"`);
            await page.close();
            return [];
        }

        const hotels = await extractHotelsFromPage(page);
        console.error(`  [${index + 1}] ✅ sort="${sortOrder}" → ${hotels.length} hotels`);
        
        await page.close();
        return hotels;
    } catch (error) {
        console.error(`  [${index + 1}] ❌ sort="${sortOrder}" failed: ${error.message}`);
        if (page) try { await page.close(); } catch {}
        return [];
    }
}

async function scrapeBookingHotels(searchParams) {
    let browser;
    const startTime = Date.now();
    
    try {
        console.error('🚀 Launching browser...');
        browser = await puppeteer.launch({
            headless: 'new',
            executablePath: process.env.CHROME_PATH || undefined,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1366,768',
                '--disable-blink-features=AutomationControlled',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-web-security',
                '--disable-site-isolation-trials',
                '--lang=en-US,en',
                // Memory savers
                '--disable-extensions',
                '--disable-background-networking',
                '--disable-sync',
                '--disable-translate',
                '--hide-scrollbars',
                '--mute-audio',
                '--no-first-run',
                '--no-default-browser-check',
                '--js-flags=--max-old-space-size=512',
            ],
            ignoreDefaultArgs: ['--enable-automation'],
            timeout: 60000
        });
    } catch (error) {
        console.error('Failed to launch browser:', error.message);
        console.log(JSON.stringify([]));
        process.exit(0);
    }

    try {
        // Determine which sort orders to use (default: all 7)
        const sortOrders = searchParams.sort_orders || SORT_ORDERS;
        const concurrency = searchParams.concurrency || 4; // 4 tabs in parallel for max throughput

        console.error(`\n🔄 MULTI-SORT STRATEGY: Scraping ${sortOrders.length} sort orders (concurrency=${concurrency})...`);

        let allHotels = [];
        const hotelNameSet = new Set();

        // Process sort orders in batches to avoid overwhelming the browser
        for (let batchStart = 0; batchStart < sortOrders.length; batchStart += concurrency) {
            const batch = sortOrders.slice(batchStart, batchStart + concurrency);
            console.error(`\n📦 Batch ${Math.floor(batchStart / concurrency) + 1}: [${batch.join(', ')}]`);

            // Run batch in parallel
            const batchPromises = batch.map((sortOrder, i) =>
                scrapeSortOrder(browser, searchParams, sortOrder, batchStart + i)
            );
            const batchResults = await Promise.all(batchPromises);

            // Merge and deduplicate
            for (let r = 0; r < batchResults.length; r++) {
                const hotels = batchResults[r];
                let newCount = 0;
                for (const hotel of hotels) {
                    const key = hotel.name.toLowerCase().trim();
                    if (!hotelNameSet.has(key)) {
                        hotelNameSet.add(key);
                        allHotels.push(hotel);
                        newCount++;
                    }
                }
                console.error(`  Merged sort="${batch[r]}": ${hotels.length} scraped, ${newCount} new unique`);
            }

            console.error(`  Running total: ${allHotels.length} unique hotels`);

            // Brief pause between batches
            if (batchStart + concurrency < sortOrders.length) {
                await randomDelay(500, 1000);
            }
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        console.error(`\n✅ TOTAL: ${allHotels.length} unique hotels from ${sortOrders.length} sort orders in ${elapsed}s`);
        
        if (allHotels.length === 0) {
            console.error('⚠️ No hotels extracted across any sort order — Booking.com may be blocking');
        }
        
        // Output the results as JSON (stdout)
        console.log(JSON.stringify(allHotels));
        return allHotels;
        
    } catch (error) {
        console.error('❌ Scraping error:', error.message);
        console.log(JSON.stringify([]));
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
        console.log(JSON.stringify([]));
        process.exit(1);
    }
    
    let searchParams;
    try {
        searchParams = JSON.parse(args[0]);
    } catch (e) {
        console.error('Invalid JSON:', e.message);
        console.log(JSON.stringify([]));
        process.exit(1);
    }
    
    scrapeBookingHotels(searchParams).then(() => {
        process.exit(0);
    }).catch(error => {
        console.error('Fatal error:', error.message);
        console.log(JSON.stringify([]));
        process.exit(1);
    });
}

module.exports = { scrapeBookingHotels };
