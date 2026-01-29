"""
Django management command to import hotel data from Booking.com API
Usage: python manage.py import_booking_hotels [options]
"""

from django.core.management.base import BaseCommand, CommandError
from hotels.booking_data_importer import BookingDataImporter
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Import hotel data from Booking.com API (RapidAPI DataCrawler)'
    
    def add_arguments(self, parser):
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
            help='RapidAPI key (optional, uses settings.RAPIDAPI_KEY by default)'
        )
    
    def handle(self, *args, **options):
        location = options['location']
        max_hotels = options['max_hotels']
        replace_existing = options['replace']
        api_key = options.get('api_key')
        
        self.stdout.write(self.style.SUCCESS('=' * 70))
        self.stdout.write(self.style.SUCCESS('Booking.com Hotel Data Import'))
        self.stdout.write(self.style.SUCCESS('=' * 70))
        self.stdout.write(f'\nLocation: {location}')
        self.stdout.write(f'Max Hotels: {max_hotels}')
        self.stdout.write(f'Replace Existing: {replace_existing}')
        self.stdout.write('\n' + '=' * 70 + '\n')
        
        try:
            # Initialize importer
            importer = BookingDataImporter(api_key=api_key)
            
            # Run import
            self.stdout.write('Starting import process...\n')
            result = importer.run_full_import(
                location=location,
                max_hotels=max_hotels,
                replace_existing=replace_existing
            )
            
            # Display results
            self.stdout.write('\n' + '=' * 70)
            self.stdout.write(self.style.SUCCESS('IMPORT RESULTS'))
            self.stdout.write('=' * 70 + '\n')
            
            if result['success']:
                self.stdout.write(self.style.SUCCESS('✓ Import completed successfully!\n'))
            else:
                self.stdout.write(self.style.ERROR('✗ Import failed!\n'))
            
            # API Statistics
            api_stats = result.get('api_stats', {})
            self.stdout.write(self.style.HTTP_INFO('API Statistics:'))
            self.stdout.write(f"  Hotels fetched from API: {api_stats.get('fetched', 0)}\n")
            
            # Database Statistics
            db_stats = result.get('db_stats', {})
            self.stdout.write(self.style.HTTP_INFO('Database Statistics:'))
            self.stdout.write(f"  Hotels created: {db_stats.get('created', 0)}")
            self.stdout.write(f"  Hotels updated: {db_stats.get('updated', 0)}")
            self.stdout.write(f"  Failed imports: {db_stats.get('failed', 0)}")
            self.stdout.write(f"  Total processed: {db_stats.get('total', 0)}\n")
            
            # Errors
            if result.get('errors'):
                self.stdout.write(self.style.ERROR('Errors:'))
                for error in result['errors']:
                    self.stdout.write(self.style.ERROR(f"  - {error}"))
            
            if db_stats.get('errors'):
                self.stdout.write(self.style.ERROR('\nDatabase Errors:'))
                for error in db_stats['errors'][:5]:  # Show first 5 errors
                    self.stdout.write(self.style.ERROR(f"  - {error}"))
                if len(db_stats['errors']) > 5:
                    self.stdout.write(self.style.WARNING(f"  ... and {len(db_stats['errors']) - 5} more errors"))
            
            self.stdout.write('\n' + '=' * 70)
            
            if result['success']:
                self.stdout.write(self.style.SUCCESS('\n✓ Import completed successfully!'))
            else:
                raise CommandError('Import failed. Check errors above.')
        
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'\n✗ Error: {str(e)}\n'))
            raise CommandError(f'Import failed: {str(e)}')
