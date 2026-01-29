"""
Standalone script to import hotel data from Booking.com API
Can be run directly without Django management command
Usage: python run_booking_import.py
"""

import os
import sys
import django

# Setup Django environment
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SECRET_KEY', 'temp-key-for-import')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'travello_backend.travello_backend.settings')

try:
    django.setup()
except Exception as e:
    print(f"Error setting up Django: {e}")
    sys.exit(1)

from hotels.booking_data_importer import BookingDataImporter
import argparse


def print_banner():
    """Print script banner"""
    print("=" * 80)
    print("  BOOKING.COM HOTEL DATA IMPORT SCRIPT")
    print("  Fetch and store hotel data from Booking.com API")
    print("=" * 80)
    print()


def print_results(result):
    """Print import results in a formatted way"""
    print("\n" + "=" * 80)
    print("  IMPORT RESULTS")
    print("=" * 80)
    
    if result['success']:
        print("✓ Status: SUCCESS")
    else:
        print("✗ Status: FAILED")
    
    print(f"\nLocation: {result['location']}")
    print(f"Target: {result['max_hotels']} hotels")
    
    # API Stats
    api_stats = result.get('api_stats', {})
    print("\n--- API Statistics ---")
    print(f"Hotels fetched: {api_stats.get('fetched', 0)}")
    
    # Database Stats
    db_stats = result.get('db_stats', {})
    print("\n--- Database Statistics ---")
    print(f"Created:  {db_stats.get('created', 0)}")
    print(f"Updated:  {db_stats.get('updated', 0)}")
    print(f"Failed:   {db_stats.get('failed', 0)}")
    print(f"Total:    {db_stats.get('total', 0)}")
    
    # Errors
    if result.get('errors'):
        print("\n--- Errors ---")
        for error in result['errors']:
            print(f"  ✗ {error}")
    
    if db_stats.get('errors'):
        print("\n--- Database Errors (first 5) ---")
        for error in db_stats['errors'][:5]:
            print(f"  ✗ {error}")
        if len(db_stats['errors']) > 5:
            print(f"  ... and {len(db_stats['errors']) - 5} more errors")
    
    print("\n" + "=" * 80)
    
    if result['success']:
        print("✓ Import completed successfully!")
    else:
        print("✗ Import failed!")
    print("=" * 80)


def main():
    """Main function to run the import"""
    parser = argparse.ArgumentParser(
        description='Import hotel data from Booking.com API'
    )
    parser.add_argument(
        '--location',
        type=str,
        default='Lahore',
        help='Location to search for hotels (default: Lahore)'
    )
    parser.add_argument(
        '--max-hotels',
        type=int,
        default=100,
        help='Maximum number of hotels to import (default: 100)'
    )
    parser.add_argument(
        '--replace',
        action='store_true',
        help='Replace existing hotel data in database'
    )
    parser.add_argument(
        '--api-key',
        type=str,
        help='RapidAPI key (optional, uses environment variable RAPIDAPI_KEY by default)'
    )
    
    args = parser.parse_args()
    
    # Print banner
    print_banner()
    
    # Configuration summary
    print("Configuration:")
    print(f"  Location:         {args.location}")
    print(f"  Max Hotels:       {args.max_hotels}")
    print(f"  Replace Existing: {args.replace}")
    print(f"  API Key:          {'Provided' if args.api_key else 'From environment'}")
    print()
    
    # Confirm if replacing
    if args.replace:
        confirm = input("⚠️  WARNING: This will delete all existing hotels! Continue? (yes/no): ")
        if confirm.lower() != 'yes':
            print("Import cancelled.")
            return
    
    print("\nStarting import...\n")
    
    try:
        # Initialize importer
        importer = BookingDataImporter(api_key=args.api_key)
        
        # Run full import
        result = importer.run_full_import(
            location=args.location,
            max_hotels=args.max_hotels,
            replace_existing=args.replace
        )
        
        # Print results
        print_results(result)
        
        # Exit with appropriate code
        sys.exit(0 if result['success'] else 1)
    
    except KeyboardInterrupt:
        print("\n\n⚠️  Import cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n✗ Fatal Error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
