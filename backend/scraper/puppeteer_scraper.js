/**
 * Real-time Booking.com Scraper (Deep Pagination)
 *
 * Goal: fetch as close as possible to Booking.com's visible property count by
 * paging through results (offset-based), with lazy-load scrolling.
 *
 * Output (stdout): JSON
 *   { hotels: [...], meta: {...} }
 *
 * Note: Booking.com may throttle/block automated traffic; this is best-effort.
 *
 * Requirements:
 *   npm install puppeteer puppeteer-extra puppeteer-extra-plugin-stealth
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

// Utility to add random delay (human-like behaviour)
const randomDelay = (min, max) => new Promise(resolve =>
    setTimeout(resolve, Math.floor(Math.random() * (max - min + 1) + min))
);

const DEFAULT_SORT_ORDER = 'popularity';

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
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        window.chrome = { runtime: {} };
    });

    // ── Block images, fonts, media, analytics ──────────────────────────────
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        const type = req.resourceType();
        const url = req.url();

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

function getNights(checkin, checkout) {
    try {
        const inD = new Date(checkin);
        const outD = new Date(checkout);
        const diff = Math.ceil((outD - inD) / (1000 * 60 * 60 * 24));
        return Math.max(1, diff || 1);
    } catch {
        return 1;
    }
}

function parseAmount(text) {
    if (!text) return null;
    const cleaned = String(text).replace(/,/g, '');
    const m = cleaned.match(/(\d+(?:\.\d+)?)/);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
}

function buildSearchUrl(searchParams, { offset = 0, sortOrder = DEFAULT_SORT_ORDER } = {}) {
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
        sb_price_type: 'total',
        order: sortOrder,
        offset: String(offset),
    });
    return `${baseUrl}?${params.toString()}`;
}

async function getReportedPropertyCount(page) {
    try {
        const count = await page.evaluate(() => {
            const textCandidates = [];
            const srTitle = document.querySelector('[data-testid="sr-header-title"]');
            if (srTitle?.textContent) textCandidates.push(srTitle.textContent);
            const h1 = document.querySelector('h1');
            if (h1?.textContent) textCandidates.push(h1.textContent);
            textCandidates.push(document.body?.innerText || '');

            const combined = textCandidates.join('\n');
            const m = combined.match(/(\d[\d,]*)\s+(?:properties|property)\s+found/i);
            if (!m) return null;
            const n = parseInt(m[1].replace(/,/g, ''), 10);
            return Number.isFinite(n) ? n : null;
        });
        return count ?? null;
    } catch {
        return null;
    }
}

/**
 * Extract hotel data from all property cards on a page.
 * Images are blocked, so fewer scroll pauses are needed.
 */
async function extractHotelsFromPage(page, { scrollPasses = 6, scrollDelayMin = 120, scrollDelayMax = 240 } = {}) {
    // Scroll to trigger lazy-loaded card text (images are already blocked)
    let lastCount = 0;
    for (let i = 0; i < scrollPasses; i++) {
        await page.evaluate(() => window.scrollBy(0, Math.max(600, window.innerHeight)));
        await randomDelay(scrollDelayMin, scrollDelayMax);
        const count = await page.evaluate(() => document.querySelectorAll('[data-testid="property-card"]').length);
        if (count === lastCount && i >= 2) break;
        lastCount = count;
    }
    await randomDelay(220, 420);

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
                hotel.location_area = hotel.location ? hotel.location.split(',')[0].trim() : null;

                // Distance from center
                const distanceElem = card.querySelector('[data-testid="distance"]');
                hotel.distance = distanceElem ? distanceElem.textContent.trim() : null; // backward compat
                hotel.distance_from_center = hotel.distance;

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
                hotel.room_type = hotel.room_info || null;

                // Property type (best-effort heuristic from card text)
                const cardText = (card.innerText || '').toLowerCase();
                const knownTypes = [
                    'hotel', 'apartment', 'guest house', 'hostel', 'resort', 'villa',
                    'homestay', 'motel', 'inn', 'bed and breakfast', 'b&b', 'apartments'
                ];
                const matchType = knownTypes.find(t => cardText.includes(t));
                hotel.property_type = matchType || null;

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
                hotel.availability_status = hotel.availability;
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
 * Scrape one sort order across multiple pages (offset-based deep pagination).
 */
async function scrapeSortOrder(browser, searchParams, sortOrder, index, opts = {}) {
    let page;
    let allHotelsForSort = [];
    try {
        page = await browser.newPage();
        await configurePage(page);
        const overallStart = Date.now();
        const maxSeconds = opts.maxSeconds ?? 85;
        const slowMode = Boolean(opts.slowMode);
        const nights = getNights(searchParams.checkin, searchParams.checkout);

        const firstUrl = buildSearchUrl(searchParams, { offset: 0, sortOrder });
        console.error(`  [${index + 1}] Navigating sort="${sortOrder}"...`);
        await page.goto(firstUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await randomDelay(slowMode ? 2200 : 1000, slowMode ? 3400 : 1800);

        // Check for bot detection
        try {
            const content = await page.content();
            if (content.includes('unusual traffic') || content.includes('CAPTCHA') || content.includes('challenge-running')) {
                console.error(`  [${index + 1}] Bot detection hint on sort="${sortOrder}", slowing down...`);
                await randomDelay(3500, 5500);
            }
        } catch { }

        const reportedCount = await getReportedPropertyCount(page);
        const expectedPages = reportedCount ? Math.min(70, Math.ceil(reportedCount / 25) + 2) : 50;
        const maxPages = opts.maxPages ?? expectedPages;

        let consecutiveNoNew = 0;
        const seen = new Set();

        for (let currentPage = 1; currentPage <= maxPages; currentPage++) {
            const offset = (currentPage - 1) * 25;
            if (reportedCount && offset >= reportedCount) break;

            const elapsedSec = (Date.now() - overallStart) / 1000;
            if (elapsedSec > maxSeconds) {
                console.error(`  [${index + 1}] Time guard hit (${elapsedSec.toFixed(1)}s) - aborting to avoid partial save`);
                break;
            }

            const url = buildSearchUrl(searchParams, { offset, sortOrder });
            console.error(`  [${index + 1}] sort="${sortOrder}" | Page ${currentPage}/${maxPages} (offset=${offset})...`);

            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
            await randomDelay(slowMode ? 1400 : 700, slowMode ? 2200 : 1200);

            try {
                await page.waitForSelector('[data-testid="property-card"]', { timeout: 20000 });
            } catch {
                console.error(`  [${index + 1}] No property cards (offset=${offset}). Stopping.`);
                break;
            }

            const hotels = await extractHotelsFromPage(page, { scrollPasses: slowMode ? 10 : 6 });
            let newOnThisPage = 0;

            for (const h of hotels) {
                let key = (h.url || '').toLowerCase();
                if (key) {
                    // Normalise to avoid duplicates with different tracking query params
                    key = key.split('?')[0];
                } else {
                    key = (h.name || '').toLowerCase().trim();
                }
                if (!key) continue;
                if (seen.has(key)) continue;
                seen.add(key);

                const totalStay = parseAmount(h.price);
                const perNight = totalStay ? Math.round(totalStay / nights) : null;

                allHotelsForSort.push({
                    ...h,
                    total_stay_price: totalStay,
                    price_per_night: perNight,
                    review_rating: h.rating ? parseAmount(h.rating) : null,
                    review_count_num: h.review_count ? parseAmount(h.review_count) : null,
                });
                newOnThisPage++;
            }

            console.error(`  [${index + 1}] offset=${offset} -> ${hotels.length} scraped, ${newOnThisPage} new unique`);

            if (newOnThisPage === 0) {
                consecutiveNoNew++;
                if (consecutiveNoNew >= 3) break;
            } else {
                consecutiveNoNew = 0;
            }

            if (reportedCount && allHotelsForSort.length >= Math.floor(reportedCount * 0.98)) {
                console.error(`  [${index + 1}] Reached ~98% of reported count (${allHotelsForSort.length}/${reportedCount})`);
                break;
            }
        }

        await page.close();
        return { hotels: allHotelsForSort, reportedCount };
    } catch (error) {
        console.error(`  [${index + 1}] ❌ sort="${sortOrder}" failed: ${error.message}`);
        if (page) try { await page.close(); } catch { }
        return { hotels: [], reportedCount: null };
    }
}

async function scrapeBookingHotels(searchParams) {
    let browser;
    const startTime = Date.now();

    try {
        console.error('Launching browser...');
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
        console.log(JSON.stringify({ hotels: [], meta: { error: `Failed to launch browser: ${error.message}` } }));
        process.exit(0);
    }

    try {
        const sortOrder = searchParams.order || DEFAULT_SORT_ORDER;
        const maxSeconds = searchParams.max_seconds ?? 85;
        const maxPages = searchParams.max_pages;

        console.error(`\nDeep pagination: sort="${sortOrder}"`);

        // Attempt 1 (fast)
        const r1 = await scrapeSortOrder(browser, searchParams, sortOrder, 0, {
            slowMode: false,
            maxSeconds,
            maxPages,
        });

        let best = r1;
        let retries = 0;

        // Validation: if Booking reported count exists and we're under 80%, retry in slower mode
        if (r1.reportedCount && r1.hotels.length < Math.floor(r1.reportedCount * 0.8)) {
            retries = 1;
            console.error(`\nValidation retry: scraped ${r1.hotels.length} vs reported ${r1.reportedCount} (diff > 20%)`);
            const r2 = await scrapeSortOrder(browser, searchParams, sortOrder, 0, {
                slowMode: true,
                maxSeconds,
                maxPages,
            });
            best = (r2.hotels.length > r1.hotels.length) ? r2 : r1;
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        console.error(`\nTOTAL: ${best.hotels.length} unique hotels in ${elapsed}s`);

        if (best.hotels.length === 0) {
            console.error('No hotels extracted - Booking.com may be blocking');
        }

        const meta = {
            sort_order: sortOrder,
            reported_count: best.reportedCount ?? null,
            scraped_count: best.hotels.length,
            retries,
            elapsed_seconds: Number(elapsed),
        };

        console.log(JSON.stringify({ hotels: best.hotels, meta }));
        return best.hotels;

    } catch (error) {
        console.error('❌ Scraping error:', error.message);
        console.log(JSON.stringify({ hotels: [], meta: { error: error.message } }));
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
        console.log(JSON.stringify({ hotels: [], meta: { error: 'Missing arguments' } }));
        process.exit(1);
    }

    let searchParams;
    try {
        searchParams = JSON.parse(args[0]);
    } catch (e) {
        console.error('Invalid JSON:', e.message);
        console.log(JSON.stringify({ hotels: [], meta: { error: `Invalid JSON: ${e.message}` } }));
        process.exit(1);
    }

    scrapeBookingHotels(searchParams).then(() => {
        process.exit(0);
    }).catch(error => {
        console.error('Fatal error:', error.message);
        console.log(JSON.stringify({ hotels: [], meta: { error: error.message } }));
        process.exit(1);
    });
}

module.exports = { scrapeBookingHotels };
