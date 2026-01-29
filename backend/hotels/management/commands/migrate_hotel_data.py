"""
Data Migration Helper Script
Run this after migrations to set up RoomTypes for existing hotels
"""

from django.core.management.base import BaseCommand
from hotels.models import Hotel, RoomType, Booking


class Command(BaseCommand):
    help = 'Migrate existing hotel data to new schema with RoomTypes'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Starting data migration...'))
        
        # Step 1: Create default RoomTypes for hotels that don't have any
        hotels_without_rooms = Hotel.objects.filter(room_types__isnull=True).distinct()
        
        for hotel in hotels_without_rooms:
            self.stdout.write(f'Creating room types for: {hotel.name}')
            
            # Create Single room type
            RoomType.objects.get_or_create(
                hotel=hotel,
                type='single',
                defaults={
                    'price_per_night': 50.00,
                    'total_rooms': 5,
                    'max_occupancy': 1,
                    'description': 'Standard single room',
                    'amenities': 'WiFi, TV, Air Conditioning'
                }
            )
            
            # Create Double room type
            RoomType.objects.get_or_create(
                hotel=hotel,
                type='double',
                defaults={
                    'price_per_night': 75.00,
                    'total_rooms': 8,
                    'max_occupancy': 2,
                    'description': 'Standard double room',
                    'amenities': 'WiFi, TV, Air Conditioning, Mini Bar'
                }
            )
            
            # Create Family room type
            RoomType.objects.get_or_create(
                hotel=hotel,
                type='family',
                defaults={
                    'price_per_night': 120.00,
                    'total_rooms': 3,
                    'max_occupancy': 4,
                    'description': 'Spacious family room',
                    'amenities': 'WiFi, TV, Air Conditioning, Mini Bar, Kitchen'
                }
            )
        
        self.stdout.write(self.style.SUCCESS(
            f'Created room types for {hotels_without_rooms.count()} hotels'
        ))
        
        # Step 2: Fix bookings that might have issues
        total_bookings = Booking.objects.count()
        self.stdout.write(f'Total bookings: {total_bookings}')
        
        # Set default status for bookings
        pending_bookings = Booking.objects.filter(status='PENDING').update(
            payment_method='ONLINE'
        )
        
        self.stdout.write(self.style.SUCCESS(
            f'Migration complete! Check admin panel to verify.'
        ))
