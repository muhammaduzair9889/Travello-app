from django.urls import path
from . import views

urlpatterns = [
    # ============================================
    # EXISTING ENDPOINTS
    # ============================================
    path('signup/', views.signup, name='signup'),
    path('login/', views.login, name='login'),
    path('admin/login/', views.admin_login, name='admin_login'),
    path('google/login/', views.google_login, name='google_login'),
    path('verify-captcha/', views.verify_captcha, name='verify_captcha'),
    path('chat/', views.chat, name='chat'),
    
    # ============================================
    # OTP-BASED AUTHENTICATION API ENDPOINTS
    # ============================================
    # Signup with OTP
    path('api/signup-otp/', views.signup_with_otp, name='signup_with_otp'),
    path('api/verify-signup-otp/', views.verify_signup_otp, name='verify_signup_otp'),
    
    # Login with OTP
    path('api/login-otp/', views.login_with_otp, name='login_with_otp'),
    path('api/resend-login-otp/', views.resend_login_otp, name='resend_login_otp'),
    path('api/verify-login-otp/', views.verify_login_otp, name='verify_login_otp'),
    
    # Password Reset with OTP
    path('api/request-otp/', views.request_otp, name='request_otp'),
    path('api/verify-password-reset-otp-only/', views.verify_password_reset_otp_only, name='verify_password_reset_otp_only'),
    path('api/verify-password-reset-otp/', views.verify_password_reset_otp, name='verify_password_reset_otp'),
    
    # ============================================
    # DJANGO TEMPLATE-BASED VIEWS (OPTIONAL)
    # ============================================
    path('signup-page/', views.signup_page, name='signup_page'),
    path('verify-otp/', views.verify_otp_page, name='verify_otp'),
    path('login-page/', views.login_page, name='login_page'),
    path('verify-login-otp-page/', views.verify_login_otp_page, name='verify_login_otp_page'),
    
    # ============================================
    # PASSWORD RESET VIEWS
    # ============================================
    path('password-reset/', views.CustomPasswordResetView.as_view(), name='password_reset'),
    path('password-reset/done/', views.CustomPasswordResetDoneView.as_view(), name='password_reset_done'),
    path('password-reset/<uidb64>/<token>/', views.CustomPasswordResetConfirmView.as_view(), name='password_reset_confirm'),
    path('password-reset/complete/', views.CustomPasswordResetCompleteView.as_view(), name='password_reset_complete'),
]




