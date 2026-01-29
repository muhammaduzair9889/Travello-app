import requests
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.conf import settings
from django.contrib.auth import authenticate
from .serializers import UserRegistrationSerializer, UserLoginSerializer, UserSerializer, AdminLoginSerializer
from .models import User
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
    """Handle chat messages with AI - No authentication required"""
    message = request.data.get('message')
    
    if not message:
        return Response(
            {'error': 'Message is required'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    response = get_ai_response(message)
    
    if response['status'] == 'success':
        return Response({'reply': response['reply']})
    else:
        return Response(
            {'error': response['error']}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

