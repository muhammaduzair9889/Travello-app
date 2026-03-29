import os
import random
import string
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)


def generate_otp():
    """
    Generate a random 6-digit numeric OTP code
    """
    return ''.join(random.choices(string.digits, k=6))


def send_otp_email(user_email, otp_code, purpose='signup'):
    """
    Send OTP via email using Gmail SMTP (synchronous)
    
    Args:
        user_email: Email address to send OTP to
        otp_code: 6-digit OTP code
        purpose: Purpose of OTP ('signup', 'login', 'password_reset')
    
    Returns:
        bool: True if email sent successfully, False otherwise
    """
    try:
        # Verify email configuration
        if not settings.DEFAULT_FROM_EMAIL:
            logger.error("DEFAULT_FROM_EMAIL not configured in settings")
            return False
        
        # Prepare email context based on purpose
        context = {
            'otp_code': otp_code,
            'purpose': purpose,
            'expires_in': '5 minutes',
            'user_email': user_email,
        }
        
        # Set subject and template based on purpose
        if purpose == 'signup':
            subject = 'Verify Your Email - Travello Sign Up'
            template_name = 'authentication/email/otp_signup.html'
            context['action'] = 'Sign Up'
        elif purpose == 'login':
            subject = 'Your Login Code - Travello'
            template_name = 'authentication/email/otp_login.html'
            context['action'] = 'Login'
        elif purpose == 'password_reset':
            subject = 'Password Reset Code - Travello'
            template_name = 'authentication/email/otp_password_reset.html'
            context['action'] = 'Password Reset'
        else:
            subject = f'Your Verification Code - Travello'
            template_name = 'authentication/email/otp_generic.html'
            context['action'] = 'Verify'
        
        # Render HTML email template
        try:
            html_message = render_to_string(template_name, context)
        except Exception as e:
            logger.warning(f"Could not render email template {template_name}: {e}. Using plain text.")
            html_message = f"""
            <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
                        <h2>Travello {context['action']}</h2>
                        <p>Hello {user_email},</p>
                        <p>Your verification code is:</p>
                        <div style="background-color: #f5f5f5; padding: 20px; text-align: center; border-radius: 5px; margin: 20px 0;">
                            <h1 style="margin: 0; letter-spacing: 5px; font-weight: bold;">{otp_code}</h1>
                        </div>
                        <p>This code expires in {context['expires_in']}.</p>
                        <p>If you did not request this code, please ignore this email.</p>
                        <hr style="border: none; border-top: 1px solid #ddd;">
                        <p style="font-size: 12px; color: #999;">This is an automated email from Travello. Please do not reply to this email.</p>
                    </div>
                </body>
            </html>
            """
        
        # Prepare plain text version
        plain_message = f"""
Travello {context['action']}

Hello {user_email},

Your verification code is: {otp_code}

This code expires in {context['expires_in']}.

If you did not request this code, please ignore this email.

This is an automated email from Travello. Please do not reply to this email.
        """
        
        # Log the attempt
        logger.info(f"[OTP] Attempting to send {purpose} OTP to {user_email}")
        logger.info(f"[OTP] Code: {otp_code}")
        logger.info(f"[OTP] From: {settings.DEFAULT_FROM_EMAIL}")
        logger.info(f"[OTP] Subject: {subject}")
        
        # Send email synchronously (most reliable)
        num_sent = send_mail(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user_email],
            html_message=html_message,
            fail_silently=False,  # Let exceptions bubble up for proper logging
        )
        
        if num_sent > 0:
            logger.info(f"[OTP] ✓ Email sent successfully to {user_email} (purpose: {purpose})")
            return True
        else:
            logger.error(f"[OTP] ✗ send_mail returned 0 for {user_email}")
            return False
        
    except Exception as e:
        logger.error(f"[OTP] ✗ Exception sending OTP email to {user_email}: {str(e)}", exc_info=True)
        return False


def create_otp_for_user(user, purpose='signup', expires_in_minutes=5):
    """
    Create and save OTP for user
    
    Args:
        user: User object
        purpose: Purpose of OTP ('signup', 'login', 'password_reset')
        expires_in_minutes: Expiration time in minutes (default: 5)
    
    Returns:
        OTP: Created OTP object or None if failed
    """
    from .models import OTP
    
    try:
        # Remove old OTP if exists
        OTP.objects.filter(user=user).delete()
        
        # Generate OTP
        otp_code = generate_otp()
        
        # Calculate expiration time
        expires_at = timezone.now() + timedelta(minutes=expires_in_minutes)
        
        # Create OTP
        otp = OTP.objects.create(
            user=user,
            otp_code=otp_code,
            expires_at=expires_at,
            purpose=purpose
        )
        
        logger.info(f"OTP created for {user.email} with purpose: {purpose}")
        return otp
        
    except Exception as e:
        logger.error(f"Failed to create OTP for {user.email}: {str(e)}")
        return None


def verify_otp(user, otp_code, purpose='signup'):
    """
    Verify OTP for user
    
    Args:
        user: User object
        otp_code: OTP code to verify
        purpose: Expected purpose of OTP
    
    Returns:
        tuple: (success: bool, message: str)
    """
    from .models import OTP
    
    try:
        otp = OTP.objects.get(user=user, purpose=purpose)
        
        # Check if expired
        if otp.is_expired():
            return False, "OTP has expired. Please request a new one."
        
        # Check if used
        if otp.is_used:
            return False, "OTP has already been used."
        
        # Check attempts
        if otp.attempts >= 5:
            otp.delete()
            return False, "Maximum OTP verification attempts exceeded. Please request a new OTP."
        
        # Check OTP code
        if otp.otp_code != otp_code:
            otp.increment_attempts()
            remaining_attempts = 5 - otp.attempts
            if remaining_attempts > 0:
                return False, f"Invalid OTP. You have {remaining_attempts} attempt(s) remaining."
            else:
                otp.delete()
                return False, "Maximum OTP verification attempts exceeded. Please request a new OTP."
        
        # OTP is valid
        otp.mark_as_used()
        logger.info(f"OTP verified successfully for {user.email}")
        return True, "OTP verified successfully."
        
    except OTP.DoesNotExist:
        return False, "No OTP found for this user. Please request a new one."
    except Exception as e:
        logger.error(f"Error verifying OTP for {user.email}: {str(e)}")
        return False, "Error verifying OTP. Please try again."


def check_otp(user, otp_code, purpose='signup'):
    """
    Check OTP for user without marking it as used

    Args:
        user: User object
        otp_code: OTP code to verify
        purpose: Expected purpose of OTP

    Returns:
        tuple: (success: bool, message: str)
    """
    from .models import OTP

    try:
        otp = OTP.objects.get(user=user, purpose=purpose)

        if otp.is_expired():
            return False, "OTP has expired. Please request a new one."

        if otp.is_used:
            return False, "OTP has already been used."

        if otp.attempts >= 5:
            otp.delete()
            return False, "Maximum OTP verification attempts exceeded. Please request a new OTP."

        if otp.otp_code != otp_code:
            otp.increment_attempts()
            remaining_attempts = 5 - otp.attempts
            if remaining_attempts > 0:
                return False, f"Invalid OTP. You have {remaining_attempts} attempt(s) remaining."
            otp.delete()
            return False, "Maximum OTP verification attempts exceeded. Please request a new OTP."

        return True, "OTP is valid."

    except OTP.DoesNotExist:
        return False, "No OTP found for this user. Please request a new OTP."
    except Exception as e:
        logger.error(f"Error checking OTP for {user.email}: {str(e)}")
        return False, "Error verifying OTP. Please try again."


def send_password_reset_email(user_email, reset_url):
    """
    Send password reset email
    
    Args:
        user_email: Email address to send reset link to
        reset_url: Password reset URL
    
    Returns:
        bool: True if email sent successfully, False otherwise
    """
    try:
        subject = 'Reset Your Password - Travello'
        
        context = {
            'reset_url': reset_url,
            'user_email': user_email,
        }
        
        try:
            html_message = render_to_string('authentication/email/password_reset.html', context)
        except Exception as e:
            logger.warning(f"Could not render password reset template: {e}. Using plain text.")
            html_message = f"""
            <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
                        <h2>Reset Your Password</h2>
                        <p>Hello {user_email},</p>
                        <p>We received a request to reset your password. Click the button below to reset it:</p>
                        <div style="text-align: center; margin: 20px 0;">
                            <a href="{reset_url}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                                Reset Password
                            </a>
                        </div>
                        <p>Or copy and paste this link in your browser:</p>
                        <p style="word-break: break-all;"><a href="{reset_url}">{reset_url}</a></p>
                        <p>This link expires in 24 hours.</p>
                        <p>If you did not request this, please ignore this email.</p>
                        <hr style="border: none; border-top: 1px solid #ddd;">
                        <p style="font-size: 12px; color: #999;">This is an automated email from Travello. Please do not reply to this email.</p>
                    </div>
                </body>
            </html>
            """
        
        plain_message = f"""
Reset Your Password

Hello {user_email},

We received a request to reset your password. Click the link below to reset it:
{reset_url}

This link expires in 24 hours.

If you did not request this, please ignore this email.

This is an automated email from Travello. Please do not reply to this email.
        """
        
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user_email],
            html_message=html_message,
            fail_silently=False,
        )
        
        logger.info(f"Password reset email sent successfully to {user_email}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send password reset email to {user_email}: {str(e)}")
        return False
