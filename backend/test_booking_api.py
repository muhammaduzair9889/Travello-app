"""
Quick test script to verify Booking.com API integration
Tests API connectivity without importing to database
"""

import os
import sys
import django

# Setup Django
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'travello_backend.travello_backend.settings')
django.setup()

from hotels.booking_data_importer import BookingDataImporter
import json


def test_api_connection():
    """Test basic API connectivity"""
    print("=" * 70)
    print("Testing Booking.com API Connection")
    print("=" * 70)
    print()
    
    try:
        # Initialize importer
        print("1. Initializing importer...")
        importer = BookingDataImporter()
        print("   ✓ Importer initialized with API key")
        print()
        
        # Test destination search
        print("2. Testing destination search for 'Lahore'...")
        dest_id = importer._get_destination_id('Lahore')
        
        if dest_id:
            print(f"   ✓ Found destination ID: {dest_id}")
        else:
            print("   ✗ Could not find destination ID")
            return False
        print()
        
        # Test hotel search (just 1 page = ~25 hotels)
        print("3. Testing hotel search (fetching 1 page)...")
        print("   This will fetch ~25 hotels from Lahore...")
        hotels = importer.search_hotels_by_location('Lahore', max_results=25)
        
        if hotels:
            print(f"   ✓ Successfully fetched {len(hotels)} hotels")
            print()
            
            # Show sample of first hotel
            if len(hotels) > 0:
                print("4. Sample hotel data (first hotel):")
                print("   " + "-" * 66)
                sample = hotels[0]
                print(f"   Name:     {sample.get('hotel_name', 'N/A')}")
                print(f"   City:     {sample.get('city', 'N/A')}")
                print(f"   Location: {sample.get('location', 'N/A')[:50]}...")
                print(f"   Rating:   {sample.get('rating', 'N/A')}/10")
                print(f"   Price:    PKR {sample.get('single_bed_price_per_day', 'N/A')}/night")
                print(f"   WiFi:     {sample.get('wifi_available', False)}")
                print(f"   Parking:  {sample.get('parking_available', False)}")
                print(f"   Image:    {sample.get('image', 'No image')[:50]}...")
                print("   " + "-" * 66)
                print()
            
            # Show statistics
            print("5. Data Statistics:")
            print(f"   Total hotels fetched: {len(hotels)}")
            
            with_images = sum(1 for h in hotels if h.get('image'))
            with_wifi = sum(1 for h in hotels if h.get('wifi_available'))
            with_parking = sum(1 for h in hotels if h.get('parking_available'))
            avg_rating = sum(h.get('rating', 0) for h in hotels) / len(hotels)
            
            print(f"   Hotels with images:   {with_images} ({with_images*100//len(hotels)}%)")
            print(f"   Hotels with WiFi:     {with_wifi} ({with_wifi*100//len(hotels)}%)")
            print(f"   Hotels with parking:  {with_parking} ({with_parking*100//len(hotels)}%)")
            print(f"   Average rating:       {avg_rating:.1f}/10")
            print()
            
            print("=" * 70)
            print("✓ API Connection Test PASSED")
            print("=" * 70)
            print()
            print("The API is working correctly!")
            print("You can now run the full import:")
            print()
            print("  python manage.py import_booking_hotels --max-hotels 100")
            print("  OR")
            print("  python run_booking_import.py --max-hotels 100")
            print()
            return True
        else:
            print("   ✗ No hotels returned from API")
            print()
            print("Possible issues:")
            print("  - API key invalid or expired")
            print("  - No API quota remaining")
            print("  - API endpoint changed")
            print("  - Network connectivity issues")
            return False
    
    except Exception as e:
        print(f"\n✗ Test FAILED with error:")
        print(f"  {str(e)}")
        print()
        import traceback
        traceback.print_exc()
        return False


if __name__ == '__main__':
    success = test_api_connection()
    sys.exit(0 if success else 1)
