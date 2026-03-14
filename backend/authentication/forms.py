from django import forms
from django.contrib.auth.forms import PasswordResetForm, SetPasswordForm
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.validators import EmailValidator
import re
from .models import User


class SignUpForm(forms.ModelForm):
    """Form for user signup with OTP"""
    email = forms.EmailField(
        max_length=254,
        widget=forms.EmailInput(attrs={
            'class': 'form-control',
            'placeholder': 'Enter your email',
            'type': 'email'
        })
    )
    password = forms.CharField(
        widget=forms.PasswordInput(attrs={
            'class': 'form-control',
            'placeholder': 'Enter password',
            'type': 'password'
        }),
        validators=[validate_password]
    )
    password_confirm = forms.CharField(
        widget=forms.PasswordInput(attrs={
            'class': 'form-control',
            'placeholder': 'Confirm password',
            'type': 'password'
        })
    )
    terms_accepted = forms.BooleanField(
        required=True,
        widget=forms.CheckboxInput(attrs={
            'class': 'form-check-input'
        }),
        label='I accept the terms and conditions'
    )
    
    class Meta:
        model = User
        fields = ('email', 'password')
    
    def clean_email(self):
        """Validate email format and uniqueness"""
        email = self.cleaned_data.get('email', '').lower()
        
        if not email:
            raise ValidationError("Email is required")
        
        # Length check
        if len(email) > 254:
            raise ValidationError("Email is too long (max 254 characters)")
        
        # Email regex validation
        email_regex = r'^[a-zA-Z]([a-zA-Z0-9._-]{0,63})?@[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$'
        
        if not re.match(email_regex, email):
            raise ValidationError("Please enter a valid email address")
        
        # Check for consecutive dots
        if '..' in email:
            raise ValidationError("Email cannot contain consecutive dots")
        
        # Check if email already exists
        if User.objects.filter(email=email).exists():
            raise ValidationError("An account with this email already exists")
        
        return email
    
    def clean_password(self):
        """Validate password"""
        password = self.cleaned_data.get('password', '')
        
        if len(password) < 8:
            raise ValidationError("Password must be at least 8 characters long")
        
        # Check password complexity
        has_upper = any(c.isupper() for c in password)
        has_lower = any(c.islower() for c in password)
        has_digit = any(c.isdigit() for c in password)
        
        if not (has_upper and has_lower and has_digit):
            raise ValidationError(
                "Password must contain at least one uppercase letter, one lowercase letter, and one number"
            )
        
        return password
    
    def clean(self):
        """Validate form data"""
        cleaned_data = super().clean()
        password = cleaned_data.get('password')
        password_confirm = cleaned_data.get('password_confirm')
        
        if password and password_confirm:
            if password != password_confirm:
                raise ValidationError("Passwords do not match")
        
        return cleaned_data


class OTPVerificationForm(forms.Form):
    """Form for OTP verification"""
    otp_code = forms.CharField(
        max_length=6,
        min_length=6,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Enter 6-digit OTP',
            'type': 'text',
            'inputmode': 'numeric',
            'maxlength': '6'
        }),
        label='OTP Code'
    )
    
    def clean_otp_code(self):
        """Validate OTP code"""
        otp_code = self.cleaned_data.get('otp_code', '').strip()
        
        if not otp_code:
            raise ValidationError("OTP code is required")
        
        if not otp_code.isdigit():
            raise ValidationError("OTP code must contain only numbers")
        
        if len(otp_code) != 6:
            raise ValidationError("OTP code must be exactly 6 digits")
        
        return otp_code


class LoginForm(forms.Form):
    """Form for user login with OTP"""
    email = forms.EmailField(
        widget=forms.EmailInput(attrs={
            'class': 'form-control',
            'placeholder': 'Enter your email',
            'type': 'email'
        })
    )
    password = forms.CharField(
        widget=forms.PasswordInput(attrs={
            'class': 'form-control',
            'placeholder': 'Enter password',
            'type': 'password'
        })
    )
    
    def clean_email(self):
        """Validate email"""
        email = self.cleaned_data.get('email', '').lower()
        
        if not email:
            raise ValidationError("Email is required")
        
        return email


class CustomPasswordResetForm(PasswordResetForm):
    """Custom password reset form with enhanced validation"""
    email = forms.EmailField(
        max_length=254,
        widget=forms.EmailInput(attrs={
            'class': 'form-control',
            'placeholder': 'Enter your email',
            'type': 'email',
            'autocomplete': 'email'
        })
    )
    
    def clean_email(self):
        """Validate that email exists in system"""
        email = self.cleaned_data.get('email', '').lower()
        
        if not email:
            raise ValidationError("Email is required")
        
        # Check if user exists
        if not User.objects.filter(email=email).exists():
            raise ValidationError("No account found with this email address")
        
        return email


class CustomSetPasswordForm(SetPasswordForm):
    """Custom set password form with enhanced validation"""
    new_password1 = forms.CharField(
        label="New password",
        widget=forms.PasswordInput(attrs={
            'class': 'form-control',
            'type': 'password',
            'placeholder': 'Enter new password'
        }),
        validators=[validate_password]
    )
    new_password2 = forms.CharField(
        label="Confirm new password",
        widget=forms.PasswordInput(attrs={
            'class': 'form-control',
            'type': 'password',
            'placeholder': 'Confirm new password'
        })
    )
    
    def clean_new_password1(self):
        """Validate new password"""
        password = self.cleaned_data.get('new_password1', '')
        
        if len(password) < 8:
            raise ValidationError("Password must be at least 8 characters long")
        
        # Check password complexity
        has_upper = any(c.isupper() for c in password)
        has_lower = any(c.islower() for c in password)
        has_digit = any(c.isdigit() for c in password)
        
        if not (has_upper and has_lower and has_digit):
            raise ValidationError(
                "Password must contain at least one uppercase letter, one lowercase letter, and one number"
            )
        
        return password
