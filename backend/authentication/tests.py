"""
Tests for OTP-based authentication system
Run with: python manage.py test authentication.tests
"""

from django.test import TestCase, Client
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APITestCase
from rest_framework import status

from .models import User, OTP
from .utils import generate_otp, create_otp_for_user, verify_otp, send_otp_email


class OTPUtilsTestCase(TestCase):
    """Test OTP utility functions"""

    def setUp(self):
        """Create test user"""
        self.user = User.objects.create_user(
            email='test@example.com',
            username='testuser',
            password='TestPass123'
        )

    def test_generate_otp(self):
        """Test OTP generation"""
        otp_code = generate_otp()
        
        # Check OTP is 6 digits
        self.assertEqual(len(otp_code), 6)
        # Check OTP is numeric
        self.assertTrue(otp_code.isdigit())

    def test_create_otp_for_user(self):
        """Test OTP creation"""
        otp = create_otp_for_user(self.user, purpose='signup', expires_in_minutes=5)
        
        # Check OTP exists
        self.assertIsNotNone(otp)
        # Check OTP is associated with user
        self.assertEqual(otp.user, self.user)
        # Check OTP purpose
        self.assertEqual(otp.purpose, 'signup')
        # Check OTP code format
        self.assertEqual(len(otp.otp_code), 6)
        self.assertTrue(otp.otp_code.isdigit())

    def test_otp_expiry(self):
        """Test OTP expiry mechanism"""
        # Create OTP that expired in the past
        otp = OTP.objects.create(
            user=self.user,
            otp_code='123456',
            expires_at=timezone.now() - timedelta(minutes=1),
            purpose='signup'
        )
        
        # Check OTP is expired
        self.assertTrue(otp.is_expired())
        self.assertFalse(otp.is_valid())

    def test_verify_otp_max_attempts(self):
        """Test OTP max attempts enforcement"""
        otp = create_otp_for_user(self.user, purpose='password_reset')
        
        # Try 5 times with wrong code
        for i in range(5):
            success, message = verify_otp(self.user, '999999', purpose='password_reset')
            self.assertFalse(success)
        
        # Check OTP is marked as invalid after 5 attempts
        otp.refresh_from_db()
        self.assertEqual(otp.attempts, 5)
        self.assertFalse(otp.is_valid())


class SignupOTPAPITestCase(APITestCase):
    """Test signup with OTP API endpoints"""

    def test_signup_with_otp(self):
        """Test signup with OTP creation"""
        data = {
            'email': 'newuser@example.com',
            'password': 'TestPass123'
        }
        
        response = self.client.post('/auth/api/signup-otp/', data, format='json')
        
        # Check response status
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        # Check user created
        self.assertTrue(User.objects.filter(email='newuser@example.com').exists())
        # Check user is inactive until OTP verified
        user = User.objects.get(email='newuser@example.com')
        self.assertFalse(user.is_active)

    def test_signup_duplicate_email(self):
        """Test signup with duplicate email"""
        # Create existing user
        User.objects.create_user(
            email='existing@example.com',
            username='existing',
            password='TestPass123'
        )
        
        data = {
            'email': 'existing@example.com',
            'password': 'TestPass123'
        }
        
        response = self.client.post('/auth/api/signup-otp/', data, format='json')
        
        # Check response status
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_signup_invalid_password(self):
        """Test signup with invalid password"""
        data = {
            'email': 'user@example.com',
            'password': 'short'
        }
        
        response = self.client.post('/auth/api/signup-otp/', data, format='json')
        
        # Check response status
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class LoginOTPAPITestCase(APITestCase):
    """Test login with OTP API endpoints"""

    def setUp(self):
        """Create test user"""
        self.user = User.objects.create_user(
            email='test@example.com',
            username='testuser',
            password='TestPass123',
            is_active=True,
            is_email_verified=True
        )

    def test_login_with_otp_creates_otp(self):
        """Test login OTP creation"""
        data = {
            'email': 'test@example.com',
            'password': 'TestPass123'
        }
        
        response = self.client.post('/auth/api/login-otp/', data, format='json')
        
        # Check response status
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Check OTP created
        self.assertTrue(OTP.objects.filter(user=self.user, purpose='login').exists())

    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        data = {
            'email': 'test@example.com',
            'password': 'WrongPassword'
        }
        
        response = self.client.post('/auth/api/login-otp/', data, format='json')
        
        # Check response status
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class PasswordResetOTPAPITestCase(APITestCase):
    """Test password reset with OTP API endpoints"""

    def setUp(self):
        """Create test user"""
        self.user = User.objects.create_user(
            email='test@example.com',
            username='testuser',
            password='TestPass123',
            is_active=True,
            is_email_verified=True
        )

    def test_request_otp_for_password_reset(self):
        """Test requesting OTP for password reset"""
        data = {
            'email': 'test@example.com'
        }
        
        response = self.client.post('/auth/api/request-otp/', data, format='json')
        
        # Check response status
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Check OTP created
        self.assertTrue(OTP.objects.filter(user=self.user, purpose='password_reset').exists())

    def test_request_otp_nonexistent_email_security(self):
        """Test requesting OTP with non-existent email (security feature)"""
        data = {
            'email': 'nonexistent@example.com'
        }
        
        response = self.client.post('/auth/api/request-otp/', data, format='json')
        
        # Check response status (doesn't reveal if email exists - security)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Verify no OTP created for non-existent email
        self.assertEqual(OTP.objects.filter(purpose='password_reset').count(), 0)


class TemplateViewsTestCase(TestCase):
    """Test template-based views"""

    def setUp(self):
        """Create test client"""
        self.client = Client()

    def test_signup_page_get(self):
        """Test signup page rendering"""
        response = self.client.get('/auth/signup-page/')
        
        # Check response status
        self.assertEqual(response.status_code, 200)
        # Check template used
        self.assertTemplateUsed(response, 'authentication/signup.html')

    def test_login_page_get(self):
        """Test login page rendering"""
        response = self.client.get('/auth/login-page/')
        
        # Check response status
        self.assertEqual(response.status_code, 200)
        # Check template used
        self.assertTemplateUsed(response, 'authentication/login.html')

    def test_password_reset_page_get(self):
        """Test password reset page rendering"""
        response = self.client.get('/auth/password-reset/')
        
        # Check response status
        self.assertEqual(response.status_code, 200)
        # Check template used
        self.assertTemplateUsed(response, 'authentication/password_reset.html')




