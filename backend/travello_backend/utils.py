"""
Utilities and exception handlers for Travello Backend
"""
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
import logging

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """
    Custom exception handler that returns clean error responses
    without leaking sensitive information
    """
    # Call DRF's default exception handler to get standard error response
    response = exception_handler(exc, context)
    
    if response is not None:
        # Log the error for debugging
        logger.error(f"API Error: {exc.__class__.__name__} - {str(exc)}", extra={
            'view': context.get('view'),
            'request': context.get('request'),
        })
        
        # Customize error response
        if response.status_code >= 500:
            # Server errors: Don't expose detailed error messages
            response.data = {
                'error': 'An error occurred processing your request',
                'status': response.status_code
            }
        else:
            # Client errors: Can provide more detail
            if 'detail' in response.data:
                response.data = {
                    'error': response.data['detail'],
                    'status': response.status_code
                }
            elif isinstance(response.data, dict) and 'error' not in response.data:
                # Wrap other error formats
                response.data = {
                    'error': response.data,
                    'status': response.status_code
                }
            elif isinstance(response.data, str):
                response.data = {
                    'error': response.data,
                    'status': response.status_code
                }
    
    return response


class APIError(Exception):
    """
    Custom API exception with status code and message
    """
    def __init__(self, message, status_code=status.HTTP_400_BAD_REQUEST):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


def validate_api_key(api_key, key_name):
    """
    Validate that an API key is configured
    
    Args:
        api_key: The API key value
        key_name: Name of the API key (for logging)
    
    Returns:
        bool: True if valid, False otherwise
    """
    if not api_key or api_key == '':
        logger.warning(f"Missing API key: {key_name}")
        return False
    return True


def get_safe_error_response(error_msg, status_code=status.HTTP_400_BAD_REQUEST):
    """
    Create a safe error response that doesn't leak sensitive information
    
    Args:
        error_msg: The error message
        status_code: HTTP status code
    
    Returns:
        Response: DRF Response object
    """
    return Response(
        {'error': error_msg, 'status': status_code},
        status=status_code
    )
