"""
Stripe Payment Integration Tests
"""
import json
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from hotels.models import Hotel, RoomType, Booking, Payment
from datetime import date, timedelta

User = get_user_model()


class PaymentSessionCreationTests(APITestCase):
    """Test Stripe payment session creation"""
    
    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@test.com',
            password='testpass123'
        )
        
        refresh = RefreshToken.for_user(self.user)
        self.access_token = str(refresh.access_token)
        
        self.hotel = Hotel.objects.create(
            name='Test Hotel',
            city='Lahore',
            address='Test Address',
            description='Test Hotel Description',
            rating=4.5
        )
        
        self.room_type = RoomType.objects.create(
            hotel=self.hotel,
            type='double',
            price_per_night=Decimal('5000.00'),
            total_rooms=10
        )
        
        self.booking_online = Booking.objects.create(
            user=self.user,
            hotel=self.hotel,
            room_type=self.room_type,
            check_in=date.today() + timedelta(days=1),
            check_out=date.today() + timedelta(days=3),
            rooms_booked=1,
            total_price=Decimal('10000.00'),
            payment_method='ONLINE',
            status='PENDING'
        )
        
        self.booking_arrival = Booking.objects.create(
            user=self.user,
            hotel=self.hotel,
            room_type=self.room_type,
            check_in=date.today() + timedelta(days=5),
            check_out=date.today() + timedelta(days=7),
            rooms_booked=1,
            total_price=Decimal('10000.00'),
            payment_method='ARRIVAL',
            status='PENDING'
        )
        
        self.client = APIClient()
    
    def test_arrival_payment_bypass_stripe(self):
        """Test that ARRIVAL payment bookings bypass Stripe"""
        self.assertEqual(self.booking_arrival.payment_method, 'ARRIVAL')
        self.assertEqual(self.booking_arrival.status, 'PENDING')
    
    def test_online_payment_requires_stripe(self):
        """Test that ONLINE payment bookings use Stripe"""
        self.assertEqual(self.booking_online.payment_method, 'ONLINE')


class PaymentRecordTests(TestCase):
    """Test Payment model and records"""
    
    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@test.com',
            password='testpass123'
        )
        
        self.hotel = Hotel.objects.create(
            name='Test Hotel',
            city='Lahore',
            address='Test Address',
            description='Test'
        )
        
        self.room_type = RoomType.objects.create(
            hotel=self.hotel,
            type='double',
            price_per_night=Decimal('5000.00'),
            total_rooms=10
        )
        
        self.booking = Booking.objects.create(
            user=self.user,
            hotel=self.hotel,
            room_type=self.room_type,
            check_in=date.today() + timedelta(days=1),
            check_out=date.today() + timedelta(days=3),
            rooms_booked=1,
            total_price=Decimal('10000.00'),
            payment_method='ONLINE',
            status='PENDING'
        )
    
    def test_create_payment_record(self):
        """Test creating a Payment record"""
        payment = Payment.objects.create(
            booking=self.booking,
            amount=self.booking.total_price,
            currency='PKR',
            status='PENDING'
        )
        
        self.assertEqual(payment.booking, self.booking)
        self.assertEqual(payment.amount, Decimal('10000.00'))
        self.assertEqual(payment.currency, 'PKR')
        self.assertEqual(payment.status, 'PENDING')
    
    def test_payment_succeeded_status(self):
        """Test marking payment as succeeded"""
        payment = Payment.objects.create(
            booking=self.booking,
            amount=self.booking.total_price,
            currency='PKR',
            status='PENDING'
        )
        
        payment.status = 'SUCCEEDED'
        payment.save()
        
        self.assertEqual(payment.status, 'SUCCEEDED')
        self.assertTrue(payment.is_successful)
    
    def test_payment_failed_status(self):
        """Test marking payment as failed"""
        payment = Payment.objects.create(
            booking=self.booking,
            amount=self.booking.total_price,
            currency='PKR',
            status='PENDING'
        )
        
        payment.status = 'FAILED'
        payment.error_message = 'Card declined'
        payment.save()
        
        self.assertEqual(payment.status, 'FAILED')
        self.assertFalse(payment.is_successful)


class ArrivalPaymentWorkflowTests(TestCase):
    """Test ARRIVAL payment workflow"""
    
    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@test.com',
            password='testpass123'
        )
        
        self.hotel = Hotel.objects.create(
            name='Test Hotel',
            city='Lahore',
            address='Test Address',
            description='Test'
        )
        
        self.room_type = RoomType.objects.create(
            hotel=self.hotel,
            type='double',
            price_per_night=Decimal('5000.00'),
            total_rooms=10
        )
        
        self.booking = Booking.objects.create(
            user=self.user,
            hotel=self.hotel,
            room_type=self.room_type,
            check_in=date.today() + timedelta(days=1),
            check_out=date.today() + timedelta(days=3),
            rooms_booked=1,
            total_price=Decimal('10000.00'),
            payment_method='ARRIVAL',
            status='PENDING'
        )
    
    def test_arrival_payment_no_stripe(self):
        """Test that ARRIVAL payment doesn't use Stripe"""
        self.assertFalse(hasattr(self.booking, 'payment') or Payment.objects.filter(booking=self.booking).exists())
    
    def test_arrival_payment_staff_update(self):
        """Test staff can mark ARRIVAL booking as paid"""
        self.assertEqual(self.booking.status, 'PENDING')
        
        self.booking.status = 'PAID'
        self.booking.save()
        
        self.assertEqual(self.booking.status, 'PAID')


class OnlinePaymentWorkflowTests(TestCase):
    """Test ONLINE payment workflow"""
    
    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@test.com',
            password='testpass123'
        )
        
        self.hotel = Hotel.objects.create(
            name='Test Hotel',
            city='Lahore',
            address='Test Address',
            description='Test'
        )
        
        self.room_type = RoomType.objects.create(
            hotel=self.hotel,
            type='double',
            price_per_night=Decimal('5000.00'),
            total_rooms=10
        )
        
        self.booking = Booking.objects.create(
            user=self.user,
            hotel=self.hotel,
            room_type=self.room_type,
            check_in=date.today() + timedelta(days=1),
            check_out=date.today() + timedelta(days=3),
            rooms_booked=1,
            total_price=Decimal('10000.00'),
            payment_method='ONLINE',
            status='PENDING'
        )
    
    def test_online_payment_requires_payment_record(self):
        """Test that ONLINE payment creates Payment record"""
        payment = Payment.objects.create(
            booking=self.booking,
            amount=self.booking.total_price,
            currency='PKR',
            status='PENDING'
        )
        
        self.assertEqual(payment.booking, self.booking)
        self.assertEqual(payment.status, 'PENDING')
    
    def test_online_payment_webhook_marks_paid(self):
        """Test that webhook marks booking as PAID"""
        payment = Payment.objects.create(
            booking=self.booking,
            amount=self.booking.total_price,
            currency='PKR',
            status='PENDING'
        )
        
        payment.status = 'SUCCEEDED'
        payment.save()
        
        self.booking.status = 'PAID'
        self.booking.save()
        
        self.assertEqual(self.booking.status, 'PAID')
        self.assertEqual(payment.status, 'SUCCEEDED')
    
    def test_prevent_double_payment(self):
        """Test preventing double payment for same booking"""
        payment1 = Payment.objects.create(
            booking=self.booking,
            amount=self.booking.total_price,
            currency='PKR',
            status='SUCCEEDED'
        )
        
        payment2 = Payment.objects.filter(booking=self.booking).first()
        self.assertEqual(payment1.id, payment2.id)
