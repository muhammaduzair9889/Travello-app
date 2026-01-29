"""
Test script for web scraping functionality
Run this to verify the scraper is working correctly
"""
import sys
import os
import django

# Setup Django environment
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'travello_backend.travello_backend.settings')
django.setup()

from scraper.booking_scraper import BookingScraper, PAKISTAN_DESTINATIONS


def test_url_builder():
    """Test URL building functionality"""
    print("=" * 60)
    print("TEST 1: URL Builder")
    print("=" * 60)
    
    scraper = BookingScraper()
    params = {
        'city': 'Lahore',
        'dest_id': '-2767043',
        'checkin': '2026-02-02',
        'checkout': '2026-02-07',
        'adults': 3,
        'rooms': 1,
        'children': 0
    }
    
    url = scraper.build_search_url(params)
    print(f"✅ Generated URL:\n{url}\n")
    
    # Verify URL contains key parameters
    assert 'ss=Lahore' in url, "City parameter missing"
    assert 'dest_id=-2767043' in url, "Destination ID missing"
    assert 'checkin=2026-02-02' in url, "Check-in date missing"
    assert 'checkout=2026-02-07' in url, "Check-out date missing"
    
    print("✅ All URL parameters verified!\n")


def test_selenium_availability():
    """Test if Selenium is available"""
    print("=" * 60)
    print("TEST 2: Selenium Availability")
    print("=" * 60)
    
    try:
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options
        print("✅ Selenium is installed")
        
        # Try to initialize Chrome driver
        try:
            options = Options()
            options.add_argument('--headless')
            options.add_argument('--no-sandbox')
            driver = webdriver.Chrome(options=options)
            print("✅ ChromeDriver is available and working")
            driver.quit()
        except Exception as e:
            print(f"⚠️  ChromeDriver issue: {str(e)}")
            print("   Try: pip install webdriver-manager")
            
    except ImportError:
        print("❌ Selenium not installed")
        print("   Install: pip install selenium webdriver-manager")
    
    print()


def test_puppeteer_availability():
    """Test if Puppeteer is available"""
    print("=" * 60)
    print("TEST 3: Puppeteer Availability")
    print("=" * 60)
    
    import subprocess
    
    scraper_dir = os.path.join(os.path.dirname(__file__), 'scraper')
    
    try:
        # Check if package.json exists
        package_json = os.path.join(scraper_dir, 'package.json')
        if os.path.exists(package_json):
            print("✅ package.json found")
            
            # Check if node_modules exists
            node_modules = os.path.join(scraper_dir, 'node_modules')
            if os.path.exists(node_modules):
                print("✅ node_modules found (Puppeteer likely installed)")
            else:
                print("⚠️  node_modules not found")
                print(f"   Run: cd {scraper_dir} && npm install")
        else:
            print("❌ package.json not found")
            
    except Exception as e:
        print(f"⚠️  Error checking Puppeteer: {str(e)}")
    
    print()


def test_destination_ids():
    """Test destination IDs are correctly defined"""
    print("=" * 60)
    print("TEST 4: Pakistani Cities Destination IDs")
    print("=" * 60)
    
    print(f"Number of cities configured: {len(PAKISTAN_DESTINATIONS)}\n")
    
    for key, dest in PAKISTAN_DESTINATIONS.items():
        print(f"✅ {dest['name']:15} → ID: {dest['dest_id']:10} ({dest['country']})")
    
    print()


def test_api_views():
    """Test API views are properly configured"""
    print("=" * 60)
    print("TEST 5: API Configuration")
    print("=" * 60)
    
    try:
        from scraper.views import scrape_hotels, get_destinations, test_scraper
        print("✅ Views imported successfully")
        
        from scraper.urls import urlpatterns
        print(f"✅ {len(urlpatterns)} URL patterns configured:")
        for pattern in urlpatterns:
            print(f"   - {pattern.pattern}")
        
    except ImportError as e:
        print(f"❌ Import error: {str(e)}")
    
    print()


def test_sample_scrape():
    """Test a sample scrape (WARNING: Will actually hit Booking.com)"""
    print("=" * 60)
    print("TEST 6: Sample Scrape (OPTIONAL)")
    print("=" * 60)
    
    response = input("Run actual scraping test? This will access Booking.com. (y/N): ")
    
    if response.lower() == 'y':
        print("\n🔄 Starting scrape test...")
        print("⏱️  This may take 30-60 seconds...\n")
        
        scraper = BookingScraper()
        params = {
            'city': 'Lahore',
            'checkin': '2026-02-10',
            'checkout': '2026-02-15',
            'adults': 2,
            'rooms': 1
        }
        
        try:
            hotels = scraper.scrape_hotels_sync(params)
            
            if hotels:
                print(f"✅ Successfully scraped {len(hotels)} hotels!\n")
                print("Sample hotel:")
                print(f"  Name: {hotels[0].get('name', 'N/A')}")
                print(f"  Price: {hotels[0].get('price', 'N/A')}")
                print(f"  Rating: {hotels[0].get('rating', 'N/A')}")
                print(f"  Location: {hotels[0].get('location', 'N/A')}")
            else:
                print("⚠️  No hotels returned. Possible causes:")
                print("   - AWS WAF bot detection")
                print("   - ChromeDriver not configured")
                print("   - Network issues")
                
        except Exception as e:
            print(f"❌ Scraping failed: {str(e)}")
    else:
        print("⏭️  Skipping actual scrape test")
    
    print()


def main():
    """Run all tests"""
    print("\n" + "=" * 60)
    print("TRAVELLO WEB SCRAPER - TEST SUITE")
    print("=" * 60 + "\n")
    
    test_url_builder()
    test_selenium_availability()
    test_puppeteer_availability()
    test_destination_ids()
    test_api_views()
    test_sample_scrape()
    
    print("=" * 60)
    print("✅ TEST SUITE COMPLETE")
    print("=" * 60)
    print("\nNext Steps:")
    print("1. Install missing dependencies (if any)")
    print("2. Read WEB_SCRAPING_DOCUMENTATION.md for full guide")
    print("3. Test API endpoints with: python manage.py runserver")
    print("4. Test frontend integration")
    print()


if __name__ == '__main__':
    main()
