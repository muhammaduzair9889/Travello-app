"""
Test suite for room availability logic

Tests the overbooking prevention rule:
A room is unavailable if:
- check_in < selected_check_out
- AND check_out > selected_check_in  
- AND status IN (PENDING, PAID, CONFIRMED)
"""

from django.test import TestCase
from django.utils import timezone
from datetime import date, timedelta
from decimal import Decimal

from authentication.models import User
from .models import Hotel, RoomType, Booking


class RoomAvailabilityTestCase(TestCase):
    """Test room availability logic"""
    
    def setUp(self):
        """Set up test data"""
        # Create test user
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        
        # Create test hotel
        self.hotel = Hotel.objects.create(
            name='Test Hotel',
            city='Test City',
            address='123 Test Street',
            description='A test hotel',
            rating=4.5
        )
        
        # Create room type with 10 total rooms
        self.room_type = RoomType.objects.create(
            hotel=self.hotel,
            type='double',
            price_per_night=Decimal('100.00'),
            total_rooms=10,
            max_occupancy=2
        )
        
        # Define test dates
        self.today = timezone.now().date()
        self.tomorrow = self.today + timedelta(days=1)
        self.day_3 = self.today + timedelta(days=3)
        self.day_5 = self.today + timedelta(days=5)
        self.day_7 = self.today + timedelta(days=7)
        self.day_10 = self.today + timedelta(days=10)
    
    def test_no_bookings_all_available(self):
        """Test that all rooms are available when there are no bookings"""
        available = self.room_type.get_available_rooms(self.today, self.tomorrow)
        self.assertEqual(available, 10)
    
    def test_overlapping_booking_reduces_availability(self):
        """Test that an overlapping booking reduces availability"""
        # Book 3 rooms from day 3 to day 7
        Booking.objects.create(
            user=self.user,
            hotel=self.hotel,
            room_type=self.room_type,
            rooms_booked=3,
            check_in=self.day_3,
            check_out=self.day_7,
            total_price=Decimal('1200.00'),
            status='PAID'
        )
        
        # Check availability for overlapping period (day 5 to day 10)
        available = self.room_type.get_available_rooms(self.day_5, self.day_10)
        self.assertEqual(available, 7)  # 10 - 3 = 7
    
    def test_non_overlapping_booking_no_impact(self):
        """Test that non-overlapping bookings don't affect availability"""
        # Book 5 rooms from today to day 3
        Booking.objects.create(
            user=self.user,
            hotel=self.hotel,
            room_type=self.room_type,
            rooms_booked=5,
            check_in=self.today,
            check_out=self.day_3,
            total_price=Decimal('1500.00'),
            status='PAID'
        )
        
        # Check availability for non-overlapping period (day 7 to day 10)
        available = self.room_type.get_available_rooms(self.day_7, self.day_10)
        self.assertEqual(available, 10)  # No overlap, all available
    
    def test_exact_checkout_checkin_no_overlap(self):
        """Test that checkout day equals checkin day doesn't overlap"""
        # Book from today to day 3 (checkout on day 3)
        Booking.objects.create(
            user=self.user,
            hotel=self.hotel,
            room_type=self.room_type,
            rooms_booked=4,
            check_in=self.today,
            check_out=self.day_3,
            total_price=Decimal('1200.00'),
            status='PAID'
        )
        
        # Check availability starting from day 3 (checkin on day 3)
        available = self.room_type.get_available_rooms(self.day_3, self.day_5)
        self.assertEqual(available, 10)  # No overlap - checkout = checkin allowed
    
    def test_multiple_overlapping_bookings(self):
        """Test multiple overlapping bookings correctly reduce availability"""
        # First booking: 3 rooms from day 3 to day 7
        Booking.objects.create(
            user=self.user,
            hotel=self.hotel,
            room_type=self.room_type,
            rooms_booked=3,
            check_in=self.day_3,
            check_out=self.day_7,
            total_price=Decimal('1200.00'),
            status='PAID'
        )
        
        # Second booking: 2 rooms from day 5 to day 10
        Booking.objects.create(
            user=self.user,
            hotel=self.hotel,
            room_type=self.room_type,
            rooms_booked=2,
            check_in=self.day_5,
            check_out=self.day_10,
            total_price=Decimal('1000.00'),
            status='CONFIRMED'
        )
        
        # Check availability for day 5 to day 7 (both bookings overlap)
        available = self.room_type.get_available_rooms(self.day_5, self.day_7)
        self.assertEqual(available, 5)  # 10 - 3 - 2 = 5
    
    def test_cancelled_bookings_not_counted(self):
        """Test that cancelled bookings don't reduce availability"""
        # Cancelled booking
        Booking.objects.create(
            user=self.user,
            hotel=self.hotel,
            room_type=self.room_type,
            rooms_booked=5,
            check_in=self.day_3,
            check_out=self.day_7,
            total_price=Decimal('2000.00'),
            status='CANCELLED'
        )
        
        # Check availability
        available = self.room_type.get_available_rooms(self.day_3, self.day_7)
        self.assertEqual(available, 10)  # Cancelled booking not counted
    
    def test_completed_bookings_not_counted(self):
        """Test that completed bookings don't reduce availability"""
        # Completed booking
        Booking.objects.create(
            user=self.user,
            hotel=self.hotel,
            room_type=self.room_type,
            rooms_booked=6,
            check_in=self.day_3,
            check_out=self.day_7,
            total_price=Decimal('2400.00'),
            status='COMPLETED'
        )
        
        # Check availability
        available = self.room_type.get_available_rooms(self.day_3, self.day_7)
        self.assertEqual(available, 10)  # Completed booking not counted
    
    def test_pending_paid_confirmed_reduce_availability(self):
        """Test that PENDING, PAID, and CONFIRMED bookings all reduce availability"""
        statuses = ['PENDING', 'PAID', 'CONFIRMED']
        
        for idx, booking_status in enumerate(statuses):
            room_type = RoomType.objects.create(
                hotel=self.hotel,
                type=f'test_{idx}',
                price_per_night=Decimal('100.00'),
                total_rooms=10,
                max_occupancy=2
            )
            
            Booking.objects.create(
                user=self.user,
                hotel=self.hotel,
                room_type=room_type,
                rooms_booked=3,
                check_in=self.day_3,
                check_out=self.day_7,
                total_price=Decimal('1200.00'),
                status=booking_status
            )
            
            available = room_type.get_available_rooms(self.day_3, self.day_7)
            self.assertEqual(available, 7, f"Status {booking_status} should reduce availability")
    
    def test_overbooking_prevention(self):
        """Test that attempting to overbook raises validation error"""
        # Book 8 rooms
        Booking.objects.create(
            user=self.user,
            hotel=self.hotel,
            room_type=self.room_type,
            rooms_booked=8,
            check_in=self.day_3,
            check_out=self.day_7,
            total_price=Decimal('3200.00'),
            status='PAID'
        )
        
        # Try to book 4 more rooms (should only have 2 available)
        from django.core.exceptions import ValidationError
        
        booking = Booking(
            user=self.user,
            hotel=self.hotel,
            room_type=self.room_type,
            rooms_booked=4,
            check_in=self.day_5,
            check_out=self.day_10,
            total_price=Decimal('2000.00'),
            status='PENDING'
        )
        
        # Should raise ValidationError
        with self.assertRaises(ValidationError):
            booking.full_clean()
    
    def test_partial_overlap_calculation(self):
        """Test that partial overlaps are calculated correctly"""
        # Booking 1: day 0 to day 3
        Booking.objects.create(
            user=self.user,
            hotel=self.hotel,
            room_type=self.room_type,
            rooms_booked=2,
            check_in=self.today,
            check_out=self.day_3,
            total_price=Decimal('600.00'),
            status='PAID'
        )
        
        # Booking 2: day 5 to day 7
        Booking.objects.create(
            user=self.user,
            hotel=self.hotel,
            room_type=self.room_type,
            rooms_booked=3,
            check_in=self.day_5,
            check_out=self.day_7,
            total_price=Decimal('600.00'),
            status='PAID'
        )
        
        # Check day 0 to day 5 (overlaps with first booking only)
        available = self.room_type.get_available_rooms(self.today, self.day_5)
        self.assertEqual(available, 8)  # Only first booking overlaps
        
        # Check day 3 to day 7 (overlaps with second booking only)
        available = self.room_type.get_available_rooms(self.day_3, self.day_7)
        self.assertEqual(available, 7)  # Only second booking overlaps
        
        # Check day 0 to day 10 (overlaps with both bookings)
        available = self.room_type.get_available_rooms(self.today, self.day_10)
        self.assertEqual(available, 5)  # Both bookings overlap: 10 - 2 - 3 = 5


class BookingValidationTestCase(TestCase):
    """Test booking validation"""
    
    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        
        self.hotel = Hotel.objects.create(
            name='Test Hotel',
            city='Test City',
            address='123 Test Street',
            description='A test hotel'
        )
        
        self.room_type = RoomType.objects.create(
            hotel=self.hotel,
            type='double',
            price_per_night=Decimal('100.00'),
            total_rooms=5,
            max_occupancy=2
        )
        
        self.today = timezone.now().date()
    
    def test_check_availability_method(self):
        """Test the check_availability method on Booking"""
        booking = Booking(
            user=self.user,
            hotel=self.hotel,
            room_type=self.room_type,
            rooms_booked=2,
            check_in=self.today + timedelta(days=1),
            check_out=self.today + timedelta(days=3),
            total_price=Decimal('400.00'),
            status='PENDING'
        )
        
        is_available, available_rooms, message = booking.check_availability()
        self.assertTrue(is_available)
        self.assertEqual(available_rooms, 5)
        self.assertIn('Available', message)
