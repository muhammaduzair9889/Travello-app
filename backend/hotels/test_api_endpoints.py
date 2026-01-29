"""
Test suite for new API endpoints
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from hotels.models import Hotel, RoomType, Booking
from datetime import date, timedelta

User = get_user_model()


class BookingPreviewAPITest(TestCase):
    """Test booking preview endpoint"""
    
    def setUp(self):
        """Set up test data"""
        # Create test hotel
        self.hotel = Hotel.objects.create(
            name="Test Hotel",
            city="Lahore",
            address="Test Address",
            description="Test Description",
            rating=4.5
        )
        
        # Create test room type
        self.room_type = RoomType.objects.create(
            hotel=self.hotel,
            type='deluxe',
            price_per_night=10000.00,
            total_rooms=10,
            max_occupancy=2
        )
        
        self.client = APIClient()
    
    def test_booking_preview_success(self):
        """Test successful booking preview"""
        check_in = date.today() + timedelta(days=1)
        check_out = check_in + timedelta(days=3)
        
        data = {
            'hotel_id': self.hotel.id,
            'room_type_id': self.room_type.id,
            'check_in': check_in.isoformat(),
            'check_out': check_out.isoformat(),
            'rooms_booked': 2
        }
        
        response = self.client.post('/api/bookings/preview/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        
        preview = response.data['preview']
        self.assertEqual(preview['hotel_id'], self.hotel.id)
        self.assertEqual(preview['room_type_id'], self.room_type.id)
        self.assertEqual(preview['nights'], 3)
        self.assertEqual(preview['price_per_night'], 10000.00)
        self.assertEqual(preview['total_price'], 60000.00)
        self.assertTrue(preview['is_available'])
    
    def test_booking_preview_invalid_dates(self):
        """Test preview with invalid dates"""
        check_in = date.today() + timedelta(days=1)
        check_out = check_in  # Same as check-in (invalid)
        
        data = {
            'hotel_id': self.hotel.id,
            'room_type_id': self.room_type.id,
            'check_in': check_in.isoformat(),
            'check_out': check_out.isoformat()
        }
        
        response = self.client.post('/api/bookings/preview/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])


class HotelRoomsAPITest(TestCase):
    """Test hotel rooms endpoint"""
    
    def setUp(self):
        """Set up test data"""
        self.hotel = Hotel.objects.create(
            name="Test Hotel",
            city="Lahore",
            address="Test Address",
            description="Test Description"
        )
        
        self.room_type1 = RoomType.objects.create(
            hotel=self.hotel,
            type='single',
            price_per_night=5000.00,
            total_rooms=20
        )
        
        self.room_type2 = RoomType.objects.create(
            hotel=self.hotel,
            type='deluxe',
            price_per_night=15000.00,
            total_rooms=10
        )
        
        self.client = APIClient()
    
    def test_get_hotel_rooms(self):
        """Test getting hotel rooms with availability"""
        response = self.client.get(f'/api/hotels/{self.hotel.id}/rooms/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['hotel_id'], self.hotel.id)
        self.assertEqual(response.data['hotel_name'], self.hotel.name)
        self.assertEqual(len(response.data['room_types']), 2)
        
        # Check room types have required fields
        room_type = response.data['room_types'][0]
        self.assertIn('total_rooms', room_type)
        self.assertIn('available_rooms', room_type)
        self.assertIn('booked_rooms', room_type)


class BookingCreateAPITest(TestCase):
    """Test booking creation with different payment methods"""
    
    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        
        self.hotel = Hotel.objects.create(
            name="Test Hotel",
            city="Lahore",
            address="Test Address",
            description="Test Description"
        )
        
        self.room_type = RoomType.objects.create(
            hotel=self.hotel,
            type='deluxe',
            price_per_night=10000.00,
            total_rooms=10
        )
        
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
    
    def test_create_booking_arrival_payment(self):
        """Test creating booking with ARRIVAL payment method"""
        check_in = date.today() + timedelta(days=1)
        check_out = check_in + timedelta(days=3)
        
        data = {
            'hotel': self.hotel.id,
            'room_type': self.room_type.id,
            'rooms_booked': 2,
            'check_in': check_in.isoformat(),
            'check_out': check_out.isoformat(),
            'payment_method': 'ARRIVAL',
            'guest_name': 'Test User',
            'guest_email': 'test@example.com'
        }
        
        response = self.client.post('/api/bookings/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['success'])
        self.assertFalse(response.data['payment_required'])
        self.assertEqual(response.data['booking']['status'], 'PENDING')
        self.assertEqual(response.data['booking']['payment_method'], 'ARRIVAL')
    
    def test_create_booking_online_payment(self):
        """Test creating booking with ONLINE payment method"""
        check_in = date.today() + timedelta(days=1)
        check_out = check_in + timedelta(days=3)
        
        data = {
            'hotel': self.hotel.id,
            'room_type': self.room_type.id,
            'rooms_booked': 2,
            'check_in': check_in.isoformat(),
            'check_out': check_out.isoformat(),
            'payment_method': 'ONLINE',
            'guest_name': 'Test User',
            'guest_email': 'test@example.com'
        }
        
        response = self.client.post('/api/bookings/', data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['success'])
        self.assertTrue(response.data['payment_required'])
        self.assertEqual(response.data['booking']['status'], 'PENDING')
        self.assertEqual(response.data['booking']['payment_method'], 'ONLINE')
        self.assertIn('booking_id', response.data)


class AdminBookingAPITest(TestCase):
    """Test admin booking endpoints"""
    
    def setUp(self):
        """Set up test data"""
        self.admin_user = User.objects.create_user(
            username='admin',
            email='admin@example.com',
            password='admin123',
            is_staff=True
        )
        
        self.regular_user = User.objects.create_user(
            username='user',
            email='user@example.com',
            password='user123'
        )
        
        self.hotel = Hotel.objects.create(
            name="Test Hotel",
            city="Lahore",
            address="Test Address",
            description="Test Description"
        )
        
        self.room_type = RoomType.objects.create(
            hotel=self.hotel,
            type='deluxe',
            price_per_night=10000.00,
            total_rooms=10
        )
        
        # Create test booking
        check_in = date.today() + timedelta(days=1)
        check_out = check_in + timedelta(days=3)
        
        self.booking = Booking.objects.create(
            user=self.regular_user,
            hotel=self.hotel,
            room_type=self.room_type,
            rooms_booked=2,
            check_in=check_in,
            check_out=check_out,
            total_price=60000.00,
            payment_method='ONLINE',
            status='PENDING'
        )
        
        self.client = APIClient()
    
    def test_admin_get_all_bookings(self):
        """Test admin can get all bookings"""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/bookings/admin/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['count'], 1)
    
    def test_regular_user_cannot_access_admin_bookings(self):
        """Test regular user cannot access admin endpoint"""
        self.client.force_authenticate(user=self.regular_user)
        response = self.client.get('/api/bookings/admin/')
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_admin_update_booking_status(self):
        """Test admin can update booking status"""
        self.client.force_authenticate(user=self.admin_user)
        
        data = {'status': 'PAID'}
        response = self.client.patch(
            f'/api/bookings/{self.booking.id}/',
            data,
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['booking']['status'], 'PAID')
    
    def test_invalid_status_transition(self):
        """Test invalid status transition is rejected"""
        self.client.force_authenticate(user=self.admin_user)
        
        # Set booking to CANCELLED
        self.booking.status = 'CANCELLED'
        self.booking.save()
        
        # Try to change to CONFIRMED (invalid)
        data = {'status': 'CONFIRMED'}
        response = self.client.patch(
            f'/api/bookings/{self.booking.id}/',
            data,
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
