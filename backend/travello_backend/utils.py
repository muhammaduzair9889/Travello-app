"""
Utilities and exception handlers for Travello Backend
"""
import re
import time
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
import logging
import requests as _requests
from django.conf import settings as _settings

logger = logging.getLogger(__name__)

# ── Gemini model fallback chain ─────────────────────────────────────────────
GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
GEMINI_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
]
_MAX_RETRIES = 2          # retry rounds across all models
_INITIAL_BACKOFF = 2      # seconds
_MAX_WAIT = 15            # max seconds to wait between rounds

# Circuit breaker: skip retries if recently rate-limited
_circuit_open_until = 0.0  # timestamp when circuit breaker resets


def call_gemini(system_instruction: str, contents: list,
                temperature: float = 0.7, max_tokens: int = 1024) -> str:
    """
    Call Gemini API with model fallback and retry on rate-limit/server errors.

    Strategy:
    1. If circuit breaker is open (recently rate-limited), fail fast.
    2. Try each model in GEMINI_MODELS order.
    3. On 429 (rate-limit), immediately try the NEXT model (separate quota).
    4. If ALL models are 429, wait and retry once more.
    5. On total failure, open circuit breaker for 30s to avoid slow retries.
    """
    global _circuit_open_until

    api_key = getattr(_settings, 'GEMINI_API_KEY', '')
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not configured. Set it in your .env file.")

    # Circuit breaker: if we recently exhausted all models, fail fast
    now = time.time()
    if now < _circuit_open_until:
        remaining = int(_circuit_open_until - now)
        raise Exception(f"Rate limited — circuit breaker open for {remaining}s more")

    payload = {
        "system_instruction": {"parts": [{"text": system_instruction}]},
        "contents": contents,
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": max_tokens,
        },
    }

    last_error = None

    for round_num in range(_MAX_RETRIES):
        min_retry_delay = None  # Track shortest suggested delay per round

        for model in GEMINI_MODELS:
            url = f"{GEMINI_BASE}/{model}:generateContent?key={api_key}"
            try:
                resp = _requests.post(
                    url,
                    headers={'Content-Type': 'application/json'},
                    json=payload,
                    timeout=60,
                )

                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get('candidates', [])
                    if candidates:
                        return candidates[0]['content']['parts'][0]['text'].strip()
                    logger.warning(f"Gemini {model}: empty candidates")
                    continue  # try next model

                if resp.status_code == 429:
                    wait = _parse_retry_delay(resp.text, default=_INITIAL_BACKOFF)
                    if min_retry_delay is None or wait < min_retry_delay:
                        min_retry_delay = wait
                    logger.warning(
                        f"Gemini {model} rate-limited (429), round {round_num+1}/{_MAX_RETRIES}, "
                        f"trying next model"
                    )
                    last_error = f"Rate limited on {model} (retry in {wait:.0f}s)"
                    continue  # try next model immediately

                if resp.status_code >= 500:
                    logger.warning(f"Gemini {model} server error {resp.status_code}")
                    last_error = f"Server error {resp.status_code} on {model}"
                    continue  # try next model

                # 4xx other than 429 → skip model
                logger.error(f"Gemini {model} error {resp.status_code}: {resp.text[:300]}")
                last_error = f"API error {resp.status_code} on {model}"
                continue

            except _requests.exceptions.Timeout:
                logger.warning(f"Gemini {model} timeout")
                last_error = f"Timeout on {model}"
                continue
            except _requests.exceptions.ConnectionError as e:
                logger.warning(f"Gemini {model} connection error: {e}")
                last_error = f"Connection error on {model}"
                continue

        # All models failed in this round — wait before retrying the chain
        if round_num < _MAX_RETRIES - 1:
            # Use API-suggested delay (capped) or exponential fallback
            wait = min(min_retry_delay or _INITIAL_BACKOFF * (2 ** round_num), _MAX_WAIT)
            logger.warning(f"All models failed round {round_num+1}, waiting {wait:.0f}s before retry")
            time.sleep(wait)

    # Open circuit breaker so subsequent calls fail fast
    _circuit_open_until = time.time() + 30
    logger.warning("Gemini circuit breaker opened for 30s")
    raise Exception(f"All Gemini models exhausted after {_MAX_RETRIES} rounds. Last: {last_error}")


def _parse_retry_delay(body: str, default: float = 2.0) -> float:
    """Extract retry delay from Gemini 429 error body."""
    match = re.search(r'retry\s+in\s+([\d.]+)s', body, re.IGNORECASE)
    if match:
        delay = float(match.group(1))
        return min(delay, 60)  # cap at 60s
    return default


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
