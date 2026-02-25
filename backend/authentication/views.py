import requests
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.views.decorators.http import require_http_methods
from django.shortcuts import render, redirect
from django.contrib.auth.views import PasswordResetView, PasswordResetDoneView, PasswordResetConfirmView, PasswordResetCompleteView
from django.urls import reverse_lazy
from .serializers import UserRegistrationSerializer, UserLoginSerializer, UserSerializer, AdminLoginSerializer
from .models import User, OTP
from .forms import SignUpForm, OTPVerificationForm, LoginForm, CustomPasswordResetForm, CustomSetPasswordForm
from .utils import generate_otp, send_otp_email, create_otp_for_user, verify_otp, check_otp
from .chat_service import get_ai_response
from travello_backend.utils import get_safe_error_response
import logging

logger = logging.getLogger(__name__)


def verify_recaptcha(token):
    """Verify reCAPTCHA token with Google's API"""
    # Validate reCAPTCHA key is configured
    if not settings.RECAPTCHA_SECRET_KEY:
        logger.warning('reCAPTCHA secret key not configured')
        return False
    
    try:
        data = {
            'secret': settings.RECAPTCHA_SECRET_KEY,
            'response': token
        }
        response = requests.post('https://www.google.com/recaptcha/api/siteverify', data=data, timeout=5)
        result = response.json()
        success = result.get('success', False)
        
        if not success:
            logger.warning(f"reCAPTCHA verification failed: {result.get('error-codes', [])}")
        
        return success
    except Exception as e:
        logger.error(f"Error verifying reCAPTCHA: {str(e)}")
        return False


@api_view(['POST'])
@permission_classes([AllowAny])
def signup(request):
    """User registration endpoint (OTP required)"""
    try:
        email = request.data.get('email', '').lower()
        password = request.data.get('password', '')

        if not email:
            return get_safe_error_response(
                'Email is required',
                status.HTTP_400_BAD_REQUEST
            )

        existing_user = User.objects.filter(email=email).first()
        if existing_user and existing_user.is_email_verified:
            logger.warning(f"Signup attempt with existing email: {email}")
            return get_safe_error_response(
                'Email already registered',
                status.HTTP_400_BAD_REQUEST
            )

        if len(password) < 8:
            return get_safe_error_response(
                'Password must be at least 8 characters long',
                status.HTTP_400_BAD_REQUEST
            )

        if existing_user:
            otp = create_otp_for_user(existing_user, purpose='signup')
            if not otp:
                return get_safe_error_response(
                    'Failed to create OTP. Please try again.',
                    status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            email_sent = send_otp_email(email, otp.otp_code, purpose='signup')
            if not email_sent:
                return get_safe_error_response(
                    'Failed to send OTP email. Please try again.',
                    status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            return Response({
                'message': 'OTP sent to your email. Please verify to complete signup.',
                'email': email,
                'next_step': 'verify_otp'
            }, status=status.HTTP_200_OK)

        user = User.objects.create_user(
            email=email,
            username=email,
            password=password,
            is_active=False
        )

        otp = create_otp_for_user(user, purpose='signup')
        if not otp:
            return get_safe_error_response(
                'Failed to create OTP. Please try again.',
                status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        email_sent = send_otp_email(email, otp.otp_code, purpose='signup')
        if not email_sent:
            user.delete()
            return get_safe_error_response(
                'Failed to send OTP email. Please try again.',
                status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        logger.info(f"Signup OTP sent to: {email}")

        return Response({
            'message': 'User created successfully. OTP sent to your email.',
            'email': email,
            'next_step': 'verify_otp'
        }, status=status.HTTP_201_CREATED)

    except Exception as e:
        logger.error(f"Error during signup: {str(e)}")
        return get_safe_error_response(
            'Error during signup. Please try again.',
            status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    """User login endpoint"""
    try:
        serializer = UserLoginSerializer(data=request.data)
        
        if serializer.is_valid():
            user = serializer.validated_data['user']
            logger.info(f"User login successful: {user.email}")
            
            # Generate JWT tokens
            refresh = RefreshToken.for_user(user)
            access_token = refresh.access_token
            
            return Response({
                'message': 'Login successful',
                'user': UserSerializer(user).data,
                'tokens': {
                    'access': str(access_token),
                    'refresh': str(refresh)
                }
            }, status=status.HTTP_200_OK)
        
        logger.warning(f"Failed login attempt: {request.data.get('email', 'unknown')}")
        return get_safe_error_response(
            'Invalid credentials',
            status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        logger.error(f"Error during login: {str(e)}")
        return get_safe_error_response(
            'Error processing login',
            status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def google_login(request):
    """Login or signup using Google OAuth ID token"""
    try:
        credential = request.data.get('credential') or request.data.get('id_token')
        if not credential:
            return Response(
                {'error': 'Google credential is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not settings.GOOGLE_OAUTH_CLIENT_ID:
            return Response(
                {'error': 'Google OAuth is not configured'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        try:
            from google.oauth2 import id_token
            from google.auth.transport import requests as google_requests

            idinfo = id_token.verify_oauth2_token(
                credential,
                google_requests.Request(),
                settings.GOOGLE_OAUTH_CLIENT_ID,
                clock_skew_in_seconds=120,  # tolerate up to 2 min clock drift
            )
        except Exception as e:
            logger.warning(f"Invalid Google token: {str(e)}")
            return Response(
                {'error': 'Invalid Google token'},
                status=status.HTTP_400_BAD_REQUEST
            )

        email = (idinfo.get('email') or '').lower()
        if not email:
            return Response(
                {'error': 'Google account email is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                'username': email,
                'is_active': True,
                'is_email_verified': True,
            }
        )

        if created:
            user.set_unusable_password()
        updated = False
        if not user.is_active:
            user.is_active = True
            updated = True
        if not user.is_email_verified:
            user.is_email_verified = True
            updated = True

        first_name = idinfo.get('given_name')
        last_name = idinfo.get('family_name')
        if first_name and not user.first_name:
            user.first_name = first_name
            updated = True
        if last_name and not user.last_name:
            user.last_name = last_name
            updated = True

        if created or updated:
            user.save()

        # --- Send login OTP instead of issuing tokens directly ---
        otp = create_otp_for_user(user, purpose='login')
        if not otp:
            return Response(
                {'error': 'Failed to create OTP. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        email_sent = send_otp_email(email, otp.otp_code, purpose='login')
        if not email_sent:
            return Response(
                {'error': 'Failed to send OTP email. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        logger.info(f"Google login OTP sent to: {email}")

        return Response({
            'message': 'Google identity verified. OTP sent to your email.',
            'email': email,
            'next_step': 'verify_login_otp'
        }, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(f"Error during Google login: {str(e)}")
        return Response(
            {'error': 'Error processing Google login'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# ============================================
# OTP-BASED AUTHENTICATION ENDPOINTS
# ============================================

@api_view(['POST'])
@permission_classes([AllowAny])
def signup_with_otp(request):
    """User signup with OTP verification"""
    try:
        email = request.data.get('email', '').lower()
        password = request.data.get('password', '')
        
        # Validate email
        if not email:
            return Response(
                {'error': 'Email is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if user already exists
        existing_user = User.objects.filter(email=email).first()
        if existing_user:
            if existing_user.is_email_verified:
                return Response(
                    {'error': 'Email already registered'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Re-send OTP for unverified user
            otp = create_otp_for_user(existing_user, purpose='signup')
            if not otp:
                return Response(
                    {'error': 'Failed to create OTP. Please try again.'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            email_sent = send_otp_email(email, otp.otp_code, purpose='signup')
            if not email_sent:
                return Response(
                    {'error': 'Failed to send OTP email. Please try again.'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            logger.info(f"Signup OTP re-sent to: {email}")

            return Response({
                'message': 'OTP sent to your email. Please verify to complete signup.',
                'email': email,
                'next_step': 'verify_otp'
            }, status=status.HTTP_200_OK)
        
        # Validate password
        if len(password) < 8:
            return Response(
                {'error': 'Password must be at least 8 characters long'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create user with is_active=False
        user = User.objects.create_user(
            email=email,
            username=email,
            password=password,
            is_active=False
        )
        
        # Create and send OTP
        otp = create_otp_for_user(user, purpose='signup')
        if not otp:
            return Response(
                {'error': 'Failed to create OTP. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # Send OTP email
        email_sent = send_otp_email(email, otp.otp_code, purpose='signup')
        if not email_sent:
            # Delete user and OTP if email sending fails
            user.delete()
            return Response(
                {'error': 'Failed to send OTP email. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        logger.info(f"Signup OTP sent to: {email}")
        
        return Response({
            'message': 'User created successfully. OTP sent to your email.',
            'email': email,
            'next_step': 'verify_otp'
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        logger.error(f"Error during signup with OTP: {str(e)}")
        return Response(
            {'error': 'Error during signup. Please try again.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_signup_otp(request):
    """Verify OTP during signup"""
    try:
        email = request.data.get('email', '').lower()
        otp_code = request.data.get('otp_code', '').strip()
        
        if not email or not otp_code:
            return Response(
                {'error': 'Email and OTP code are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get user
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Verify OTP
        success, message = verify_otp(user, otp_code, purpose='signup')
        
        if not success:
            return Response(
                {'error': message},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Activate user
        user.is_active = True
        user.is_email_verified = True
        user.save()
        
        logger.info(f"User email verified: {email}")
        
        return Response({
            'message': 'Email verified successfully. You can now login.',
            'email': email,
            'next_step': 'login'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error verifying signup OTP: {str(e)}")
        return Response(
            {'error': 'Error verifying OTP. Please try again.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def login_with_otp(request):
    """User login with email, password, and OTP"""
    try:
        email = request.data.get('email', '').lower()
        password = request.data.get('password', '')
        
        if not email or not password:
            return Response(
                {'error': 'Email and password are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Authenticate user
        user = authenticate(username=email, password=password)
        
        if not user:
            return Response(
                {'error': 'Invalid email or password'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        if not user.is_active or not user.is_email_verified:
            return Response(
                {'error': 'Email not verified. Please verify your email to continue.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Create and send login OTP
        otp = create_otp_for_user(user, purpose='login')
        if not otp:
            return Response(
                {'error': 'Failed to create OTP. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # Send OTP email
        email_sent = send_otp_email(email, otp.otp_code, purpose='login')
        if not email_sent:
            return Response(
                {'error': 'Failed to send OTP email. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        logger.info(f"Login OTP sent to: {email}")
        
        return Response({
            'message': 'Credentials verified. OTP sent to your email.',
            'email': email,
            'next_step': 'verify_login_otp'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error during login with OTP: {str(e)}")
        return Response(
            {'error': 'Error during login. Please try again.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def resend_login_otp(request):
    """Resend login OTP by email only (used after Google login or when password unavailable)"""
    try:
        email = request.data.get('email', '').lower()

        if not email:
            return Response(
                {'error': 'Email is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user = User.objects.get(email=email, is_active=True)
        except User.DoesNotExist:
            # Don't reveal if email exists
            return Response({
                'message': 'If an account exists, a new OTP has been sent.',
                'email': email,
            }, status=status.HTTP_200_OK)

        otp = create_otp_for_user(user, purpose='login')
        if not otp:
            return Response(
                {'error': 'Failed to create OTP. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        email_sent = send_otp_email(email, otp.otp_code, purpose='login')
        if not email_sent:
            return Response(
                {'error': 'Failed to send OTP email. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        logger.info(f"Login OTP resent to: {email}")

        return Response({
            'message': 'OTP resent to your email.',
            'email': email,
        }, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(f"Error resending login OTP: {str(e)}")
        return Response(
            {'error': 'Error resending OTP. Please try again.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_login_otp(request):
    """Verify OTP during login"""
    try:
        email = request.data.get('email', '').lower()
        otp_code = request.data.get('otp_code', '').strip()
        
        if not email or not otp_code:
            return Response(
                {'error': 'Email and OTP code are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get user
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Verify OTP
        success, message = verify_otp(user, otp_code, purpose='login')
        
        if not success:
            return Response(
                {'error': message},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)
        access_token = refresh.access_token
        
        logger.info(f"User logged in with OTP: {email}")
        
        return Response({
            'message': 'Login successful',
            'user': UserSerializer(user).data,
            'tokens': {
                'access': str(access_token),
                'refresh': str(refresh)
            }
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error verifying login OTP: {str(e)}")
        return Response(
            {'error': 'Error verifying OTP. Please try again.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def request_otp(request):
    """Request OTP for forgot password"""
    try:
        email = request.data.get('email', '').lower()
        
        if not email:
            return Response(
                {'error': 'Email is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get user
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            # Don't reveal if email exists
            return Response({
                'message': 'If an account exists with this email, you will receive an OTP.',
                'email': email,
                'next_step': 'verify_otp'
            }, status=status.HTTP_200_OK)
        
        # Create and send password reset OTP
        otp = create_otp_for_user(user, purpose='password_reset')
        if not otp:
            return Response({
                'message': 'If an account exists with this email, you will receive an OTP.',
                'email': email,
                'next_step': 'verify_otp'
            }, status=status.HTTP_200_OK)
        
        # Send OTP email
        email_sent = send_otp_email(email, otp.otp_code, purpose='password_reset')
        if not email_sent:
            return Response({
                'message': 'If an account exists with this email, you will receive an OTP.',
                'email': email,
                'next_step': 'verify_otp'
            }, status=status.HTTP_200_OK)
        
        logger.info(f"Password reset OTP sent to: {email}")
        
        return Response({
            'message': 'If an account exists with this email, you will receive an OTP.',
            'email': email,
            'next_step': 'verify_otp'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error requesting OTP: {str(e)}")
        return Response({
            'message': 'If an account exists with this email, you will receive an OTP.',
            'next_step': 'verify_otp'
        }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_password_reset_otp_only(request):
    """Verify password reset OTP without changing password"""
    try:
        email = request.data.get('email', '').lower()
        otp_code = request.data.get('otp_code', '').strip()

        if not email or not otp_code:
            return Response(
                {'error': 'Email and OTP code are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        success, message = check_otp(user, otp_code, purpose='password_reset')

        if not success:
            return Response(
                {'error': message},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response({
            'message': 'OTP verified. You can now reset your password.',
            'email': email,
            'next_step': 'reset_password'
        }, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(f"Error verifying password reset OTP: {str(e)}")
        return Response(
            {'error': 'Error verifying OTP. Please try again.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_password_reset_otp(request):
    """Verify OTP and reset password"""
    try:
        email = request.data.get('email', '').lower()
        otp_code = request.data.get('otp_code', '').strip()
        new_password = request.data.get('new_password', '')
        confirm_password = request.data.get('confirm_password', '')
        
        if not all([email, otp_code, new_password, confirm_password]):
            return Response(
                {'error': 'All fields are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if new_password != confirm_password:
            return Response(
                {'error': 'Passwords do not match'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if len(new_password) < 8:
            return Response(
                {'error': 'Password must be at least 8 characters long'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get user
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Verify OTP
        success, message = verify_otp(user, otp_code, purpose='password_reset')
        
        if not success:
            return Response(
                {'error': message},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update password
        user.set_password(new_password)
        user.save()
        
        # Delete OTP
        OTP.objects.filter(user=user, purpose='password_reset').delete()
        
        logger.info(f"Password reset successful for: {email}")
        
        return Response({
            'message': 'Password reset successful. You can now login with your new password.',
            'next_step': 'login'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error resetting password: {str(e)}")
        return Response(
            {'error': 'Error resetting password. Please try again.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_captcha(request):
    """Verify reCAPTCHA token endpoint"""
    token = request.data.get('token')
    
    if not token:
        return Response(
            {'error': 'Token is required'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    is_valid = verify_recaptcha(token)
    
    return Response({
        'valid': is_valid
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
def admin_login(request):
    """Admin login endpoint"""
    try:
        serializer = AdminLoginSerializer(data=request.data)
        
        if serializer.is_valid():
            user = serializer.validated_data['user']
            
            # Double check staff status (allow staff; superuser not required)
            if not user.is_staff:
                logger.warning(f"Non-staff user attempted admin login: {user.email}")
                return get_safe_error_response(
                    'Access denied',
                    status.HTTP_403_FORBIDDEN
                )
            
            logger.info(f"Admin login successful: {user.email}")
            
            # Generate JWT tokens
            refresh = RefreshToken.for_user(user)
            access_token = refresh.access_token
            
            # Add custom claim for admin status
            access_token['is_admin'] = True
            
            return Response({
                'message': 'Admin login successful',
                'user': UserSerializer(user).data,
                'is_admin': True,
                'tokens': {
                    'access': str(access_token),
                    'refresh': str(refresh)
                }
            }, status=status.HTTP_200_OK)
        
        logger.warning(f"Failed admin login attempt: {request.data.get('email', 'unknown')}")
        return get_safe_error_response(
            'Invalid credentials',
            status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        logger.error(f"Error during admin login: {str(e)}")
        return get_safe_error_response(
            'Error processing login',
            status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def chat(request):
    """Handle chat messages with AI — no authentication required."""
    message = request.data.get('message', '').strip()

    if not message:
        return Response(
            {'error': 'Message is required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    response = get_ai_response(message)

    if response.get('status') == 'success':
        data = {'reply': response['reply']}
        # Include optional metadata
        if response.get('model'):
            data['model'] = response['model']
        if response.get('emotion_detected'):
            data['emotion'] = response['emotion_detected']
            data['confidence'] = response.get('confidence')
        return Response(data)
    else:
        return Response(
            {'error': response.get('error', 'Something went wrong')},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# ============================================
# DJANGO TEMPLATES-BASED VIEWS (Optional Browser-based Auth)
# ============================================

@require_http_methods(["GET", "POST"])
def signup_page(request):
    """Signup page with OTP verification"""
    if request.method == 'POST':
        form = SignUpForm(request.POST)
        if form.is_valid():
            email = form.cleaned_data.get('email')
            password = form.cleaned_data.get('password')
            
            # Create user
            user = User.objects.create_user(
                email=email,
                username=email,
                password=password,
                is_active=False
            )
            
            # Create and send OTP
            otp = create_otp_for_user(user, purpose='signup')
            if otp:
                send_otp_email(email, otp.otp_code, purpose='signup')
            
            # Redirect to OTP verification page
            return redirect('verify_otp', email=email)
    else:
        form = SignUpForm()
    
    return render(request, 'authentication/signup.html', {'form': form})


@require_http_methods(["GET", "POST"])
def verify_otp_page(request):
    """OTP verification page"""
    email = request.GET.get('email', '')
    purpose = request.GET.get('purpose', 'signup')
    
    if request.method == 'POST':
        form = OTPVerificationForm(request.POST)
        if form.is_valid():
            otp_code = form.cleaned_data.get('otp_code')
            
            try:
                user = User.objects.get(email=email)
                success, message = verify_otp(user, otp_code, purpose=purpose)
                
                if success:
                    if purpose == 'signup':
                        user.is_active = True
                        user.is_email_verified = True
                        user.save()
                        return redirect('login_page')
                    elif purpose == 'password_reset':
                        return redirect('password_reset_confirm', email=email)
                else:
                    form.add_error(None, message)
            except User.DoesNotExist:
                form.add_error(None, 'User not found')
    else:
        form = OTPVerificationForm()
    
    return render(request, 'authentication/verify_otp.html', {
        'form': form,
        'email': email,
        'purpose': purpose
    })


@require_http_methods(["GET", "POST"])
def login_page(request):
    """Login page"""
    if request.method == 'POST':
        form = LoginForm(request.POST)
        if form.is_valid():
            email = form.cleaned_data.get('email')
            password = form.cleaned_data.get('password')
            
            user = authenticate(username=email, password=password)
            
            if user:
                # Create and send login OTP
                otp = create_otp_for_user(user, purpose='login')
                if otp:
                    send_otp_email(email, otp.otp_code, purpose='login')
                
                return redirect('verify_login_otp', email=email)
            else:
                form.add_error(None, 'Invalid email or password')
    else:
        form = LoginForm()
    
    return render(request, 'authentication/login.html', {'form': form})


@require_http_methods(["GET", "POST"])
def verify_login_otp_page(request):
    """Verify login OTP page"""
    email = request.GET.get('email', '')
    
    if request.method == 'POST':
        form = OTPVerificationForm(request.POST)
        if form.is_valid():
            otp_code = form.cleaned_data.get('otp_code')
            
            try:
                user = User.objects.get(email=email)
                success, message = verify_otp(user, otp_code, purpose='login')
                
                if success:
                    login(request, user)
                    return redirect('home')
                else:
                    form.add_error(None, message)
            except User.DoesNotExist:
                form.add_error(None, 'User not found')
    else:
        form = OTPVerificationForm()
    
    return render(request, 'authentication/verify_login_otp.html', {
        'form': form,
        'email': email
    })


# ============================================
# CUSTOM PASSWORD RESET VIEWS
# ============================================

class CustomPasswordResetView(PasswordResetView):
    """Custom password reset view"""
    form_class = CustomPasswordResetForm
    template_name = 'authentication/password_reset.html'
    email_template_name = 'authentication/email/password_reset_email.txt'
    html_email_template_name = 'authentication/email/password_reset_email.html'
    success_url = reverse_lazy('password_reset_done')
    subject_template_name = 'authentication/email/password_reset_subject.txt'


class CustomPasswordResetDoneView(PasswordResetDoneView):
    """Custom password reset done view"""
    template_name = 'authentication/password_reset_done.html'


class CustomPasswordResetConfirmView(PasswordResetConfirmView):
    """Custom password reset confirm view"""
    form_class = CustomSetPasswordForm
    template_name = 'authentication/password_reset_confirm.html'
    success_url = reverse_lazy('password_reset_complete')


class CustomPasswordResetCompleteView(PasswordResetCompleteView):
    """Custom password reset complete view"""
    template_name = 'authentication/password_reset_complete.html'



def verify_recaptcha(token):
    """Verify reCAPTCHA token with Google's API"""
    # Validate reCAPTCHA key is configured
    if not settings.RECAPTCHA_SECRET_KEY:
        logger.warning('reCAPTCHA secret key not configured')
        return False
    
    try:
        data = {
            'secret': settings.RECAPTCHA_SECRET_KEY,
            'response': token
        }
        response = requests.post('https://www.google.com/recaptcha/api/siteverify', data=data, timeout=5)
        result = response.json()
        success = result.get('success', False)
        
        if not success:
            logger.warning(f"reCAPTCHA verification failed: {result.get('error-codes', [])}")
        
        return success
    except Exception as e:
        logger.error(f"Error verifying reCAPTCHA: {str(e)}")
        return False


@api_view(['POST'])
@permission_classes([AllowAny])
def signup(request):
    """User registration endpoint"""
    try:
        serializer = UserRegistrationSerializer(data=request.data)
        
        if serializer.is_valid():
            
            # Check if user already exists
            email = serializer.validated_data.get('email')
            if User.objects.filter(email=email).exists():
                logger.warning(f"Signup attempt with existing email: {email}")
                return get_safe_error_response(
                    'Email already registered',
                    status.HTTP_400_BAD_REQUEST
                )
            
            # Create user
            user = serializer.save()
            logger.info(f"New user created: {user.email}")
            
            # Generate JWT tokens
            refresh = RefreshToken.for_user(user)
            access_token = refresh.access_token
            
            return Response({
                'message': 'User created successfully',
                'user': UserSerializer(user).data,
                'tokens': {
                    'access': str(access_token),
                    'refresh': str(refresh)
                }
            }, status=status.HTTP_201_CREATED)
        
        return get_safe_error_response(
            'Invalid registration data',
            status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        logger.error(f"Error during signup: {str(e)}")
        return get_safe_error_response(
            'Error creating user account',
            status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    """User login endpoint"""
    try:
        serializer = UserLoginSerializer(data=request.data)
        
        if serializer.is_valid():
            user = serializer.validated_data['user']
            logger.info(f"User login successful: {user.email}")
            
            # Generate JWT tokens
            refresh = RefreshToken.for_user(user)
            access_token = refresh.access_token
            
            return Response({
                'message': 'Login successful',
                'user': UserSerializer(user).data,
                'tokens': {
                    'access': str(access_token),
                    'refresh': str(refresh)
                }
            }, status=status.HTTP_200_OK)
        
        logger.warning(f"Failed login attempt: {request.data.get('email', 'unknown')}")
        return get_safe_error_response(
            'Invalid credentials',
            status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        logger.error(f"Error during login: {str(e)}")
        return get_safe_error_response(
            'Error processing login',
            status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_captcha(request):
    """Verify reCAPTCHA token endpoint"""
    token = request.data.get('token')
    
    if not token:
        return Response(
            {'error': 'Token is required'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    is_valid = verify_recaptcha(token)
    
    return Response({
        'valid': is_valid
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
def admin_login(request):
    """Admin login endpoint"""
    try:
        serializer = AdminLoginSerializer(data=request.data)
        
        if serializer.is_valid():
            user = serializer.validated_data['user']
            
            # Double check staff status (allow staff; superuser not required)
            if not user.is_staff:
                logger.warning(f"Non-staff user attempted admin login: {user.email}")
                return get_safe_error_response(
                    'Access denied',
                    status.HTTP_403_FORBIDDEN
                )
            
            logger.info(f"Admin login successful: {user.email}")
            
            # Generate JWT tokens
            refresh = RefreshToken.for_user(user)
            access_token = refresh.access_token
            
            # Add custom claim for admin status
            access_token['is_admin'] = True
            
            return Response({
                'message': 'Admin login successful',
                'user': UserSerializer(user).data,
                'is_admin': True,
                'tokens': {
                    'access': str(access_token),
                    'refresh': str(refresh)
                }
            }, status=status.HTTP_200_OK)
        
        logger.warning(f"Failed admin login attempt: {request.data.get('email', 'unknown')}")
        return get_safe_error_response(
            'Invalid credentials',
            status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        logger.error(f"Error during admin login: {str(e)}")
        return get_safe_error_response(
            'Error processing login',
            status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def chat(request):
    """Handle chat messages with AI — no authentication required."""
    message = request.data.get('message', '').strip()

    if not message:
        return Response(
            {'error': 'Message is required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    response = get_ai_response(message)

    if response.get('status') == 'success':
        data = {'reply': response['reply']}
        # Include optional metadata
        if response.get('model'):
            data['model'] = response['model']
        if response.get('emotion_detected'):
            data['emotion'] = response['emotion_detected']
            data['confidence'] = response.get('confidence')
        return Response(data)
    else:
        return Response(
            {'error': response.get('error', 'Something went wrong')},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

