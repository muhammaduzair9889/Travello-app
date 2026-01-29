"""
Helper script with common Booking.com import commands
Run this to see all available options
"""

import os


def print_header(text):
    """Print a formatted header"""
    print("\n" + "=" * 80)
    print(f"  {text}")
    print("=" * 80)


def print_commands():
    """Display all available commands"""
    
    print_header("BOOKING.COM HOTEL IMPORT - COMMAND REFERENCE")
    
    print("\n📋 STEP 1: TEST API CONNECTION")
    print("-" * 80)
    print("Before importing, test that the API works:")
    print("\n  python test_booking_api.py")
    print("\nThis will fetch 25 hotels to verify everything is configured correctly.")
    
    print("\n\n🚀 STEP 2: IMPORT HOTELS")
    print("-" * 80)
    print("Choose one of these methods:\n")
    
    print("METHOD A: Django Management Command (Recommended)")
    print("  python manage.py import_booking_hotels --max-hotels 100")
    print("  python manage.py import_booking_hotels --location \"Islamabad\" --max-hotels 50")
    print("  python manage.py import_booking_hotels --replace --max-hotels 200")
    
    print("\nMETHOD B: Standalone Script")
    print("  python run_booking_import.py --max-hotels 100")
    print("  python run_booking_import.py --location \"Karachi\" --max-hotels 50")
    print("  python run_booking_import.py --replace --max-hotels 200")
    
    print("\nMETHOD C: Python Code (in Django shell or script)")
    print("  from hotels.booking_data_importer import quick_import")
    print("  result = quick_import('Lahore', max_hotels=100)")
    
    print("\n\n⚙️  AVAILABLE OPTIONS")
    print("-" * 80)
    print("  --location TEXT        City to search (default: Lahore)")
    print("  --max-hotels NUMBER    Maximum hotels to import (default: 100)")
    print("  --replace              Delete existing hotels before import")
    print("  --api-key TEXT         Use custom RapidAPI key")
    
    print("\n\n💡 COMMON USE CASES")
    print("-" * 80)
    
    cases = [
        ("Test with 25 hotels", "python manage.py import_booking_hotels --max-hotels 25"),
        ("Import 100 Lahore hotels", "python manage.py import_booking_hotels --max-hotels 100"),
        ("Import from Islamabad", "python manage.py import_booking_hotels --location \"Islamabad\""),
        ("Replace all with 200 hotels", "python manage.py import_booking_hotels --replace --max-hotels 200"),
        ("Maximum import (250+)", "python manage.py import_booking_hotels --max-hotels 250"),
    ]
    
    for description, command in cases:
        print(f"\n  {description}:")
        print(f"    {command}")
    
    print("\n\n🔍 VERIFY IMPORTED DATA")
    print("-" * 80)
    print("Check your database:")
    print("\n  python manage.py shell")
    print("\n  Then run:")
    print("  >>> from hotels.models import Hotel")
    print("  >>> print(f'Total hotels: {Hotel.objects.count()}')")
    print("  >>> Hotel.objects.first().__dict__")
    
    print("\n\n📊 API CALL ESTIMATES")
    print("-" * 80)
    print("  25 hotels   = ~2 API calls")
    print("  50 hotels   = ~3 API calls")
    print("  100 hotels  = ~5 API calls")
    print("  200 hotels  = ~9 API calls")
    print("  250 hotels  = ~11 API calls")
    
    print("\n\n🎯 RECOMMENDED WORKFLOW")
    print("-" * 80)
    print("  1. Test connection:  python test_booking_api.py")
    print("  2. Small test:       python manage.py import_booking_hotels --max-hotels 25")
    print("  3. Verify data:      Check in Django admin or database")
    print("  4. Full import:      python manage.py import_booking_hotels --max-hotels 100")
    print("  5. Scale up:         Increase --max-hotels as needed")
    
    print("\n\n⚠️  IMPORTANT NOTES")
    print("-" * 80)
    print("  • API Key: Already configured in .env (RAPIDAPI_KEY)")
    print("  • Rate Limit: 1.5 second delay between API calls")
    print("  • Duplicates: System checks and updates existing hotels")
    print("  • API: booking-com15 (DataCrawler provider on RapidAPI)")
    print("  • Cost: ~5-10 API calls per 100 hotels")
    
    print("\n\n📚 DOCUMENTATION")
    print("-" * 80)
    print("  Quick Start:  QUICK_START_IMPORT.md")
    print("  Full Guide:   BOOKING_IMPORT_README.md")
    
    print("\n" + "=" * 80)
    print("Ready to start? Run: python test_booking_api.py")
    print("=" * 80 + "\n")


if __name__ == '__main__':
    print_commands()
