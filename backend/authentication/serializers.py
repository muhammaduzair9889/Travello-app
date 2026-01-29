from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.validators import EmailValidator
from django.core.exceptions import ValidationError as DjangoValidationError
import re
from .models import User


class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)
    recaptcha_token = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'password_confirm', 'recaptcha_token')

    def validate_email(self, value):
        """
        Comprehensive email validation following RFC 5322 and Google email standards
        """
        if not value:
            raise serializers.ValidationError("Email is required")
        
        # Length check
        if len(value) > 254:
            raise serializers.ValidationError("Email is too long (max 254 characters)")
        
        # Email must start with a letter (not a number)
        email_regex = r'^[a-zA-Z]([a-zA-Z0-9._-]{0,63})?@[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$'
        
        if not re.match(email_regex, value):
            raise serializers.ValidationError("Please enter a valid email address (e.g., user@example.com)")
        
        # Check for valid domain extensions
        valid_extensions = r'\.(com|net|org|edu|gov|mil|co|io|ai|app|dev|tech|info|biz|me|us|uk|ca|au|de|fr|jp|cn|in|br|ru|mx|es|it|nl|se|no|dk|fi|pl|za|sg|hk|nz|ae|sa|eg|ng|ke|gh|tz|ug|zm|zw|bw|mw|ao|mz|rw|bi|dj|er|et|so|sd|ss|td|cf|cg|cd|ga|gq|st|cm|ne|bf|ml|sn|gm|gn|sl|lr|ci|gh|tg|bj|ng|ne|chad)$'
        
        if not re.search(valid_extensions, value, re.IGNORECASE):
            raise serializers.ValidationError("Email must have a valid domain extension (e.g., .com, .net, .org)")
        
        # Check for consecutive dots
        if '..' in value:
            raise serializers.ValidationError("Email cannot contain consecutive dots")
        
        # Split and validate local and domain parts
        try:
            local_part, domain = value.split('@')
        except ValueError:
            raise serializers.ValidationError("Invalid email format")
        
        # Local part validation
        if len(local_part) < 1 or len(local_part) > 64:
            raise serializers.ValidationError("Email username must be between 1 and 64 characters")
        
        if local_part.startswith('.') or local_part.endswith('.'):
            raise serializers.ValidationError("Email cannot start or end with a dot")
        
        # Prevent number-only emails (123@gmail.com)
        if local_part.isdigit():
            raise serializers.ValidationError("Email username cannot be numbers only (e.g., use john123@gmail.com instead of 123@gmail.com)")
        
        # Must contain at least 2 letters
        letter_count = sum(1 for c in local_part if c.isalpha())
        if letter_count < 2:
            raise serializers.ValidationError("Email username must contain at least 2 letters")
        
        # Domain validation
        if not domain or len(domain) < 4:
            raise serializers.ValidationError("Invalid email domain")
        
        # Use Django's built-in email validator for additional checks
        django_validator = EmailValidator()
        try:
            django_validator(value)
        except DjangoValidationError as e:
            raise serializers.ValidationError(str(e))
        
        # Check if email already exists
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("An account with this email already exists")
        
        return value.lower()  # Normalize to lowercase

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError("Passwords don't match")
        return attrs

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        validated_data.pop('recaptcha_token')
        user = User.objects.create_user(**validated_data)
        return user


class UserLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()
    recaptcha_token = serializers.CharField()

    def validate_email(self, value):
        """Validate email format"""
        if not value:
            raise serializers.ValidationError("Email is required")
        
        email_regex = r'^[a-zA-Z]([a-zA-Z0-9._-]{0,63}[a-zA-Z0-9])?@[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$'
        
        if not re.match(email_regex, value):
            raise serializers.ValidationError("Please enter a valid email address")
        
        return value.lower()

    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')

        if email and password:
            user = authenticate(username=email, password=password)
            if not user:
                raise serializers.ValidationError('Invalid credentials')
            if not user.is_active:
                raise serializers.ValidationError('User account is disabled')
            attrs['user'] = user
            return attrs
        else:
            raise serializers.ValidationError('Must include email and password')


class UserSerializer(serializers.ModelSerializer):
    is_admin = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'date_joined', 'is_staff', 'is_admin')
    
    def get_is_admin(self, obj):
        return obj.is_staff and obj.is_superuser


class AdminLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()
    recaptcha_token = serializers.CharField()

    def validate_email(self, value):
        """Validate email format"""
        if not value:
            raise serializers.ValidationError("Email is required")
        
        email_regex = r'^[a-zA-Z]([a-zA-Z0-9._-]{0,63}[a-zA-Z0-9])?@[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$'
        
        if not re.match(email_regex, value):
            raise serializers.ValidationError("Please enter a valid email address")
        
        return value.lower()

    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')

        if email and password:
            user = authenticate(username=email, password=password)
            if not user:
                raise serializers.ValidationError('Invalid credentials')
            if not user.is_active:
                raise serializers.ValidationError('User account is disabled')
            # Allow any staff user (not only superusers) to access admin login
            if not user.is_staff:
                raise serializers.ValidationError('Access denied. Staff privileges required.')
            attrs['user'] = user
            return attrs
        else:
            raise serializers.ValidationError('Must include email and password')




