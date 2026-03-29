import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import ReCAPTCHA from 'react-google-recaptcha';
import { GoogleLogin } from '@react-oauth/google';
import { authAPI } from '../services/api';

const logoUrl = 'https://cdn-icons-png.flaticon.com/512/854/854878.png';

const AUTH_BG_IMAGES = [
  'https://images.pexels.com/photos/12912453/pexels-photo-12912453.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&fit=crop',
  'https://images.pexels.com/photos/5258953/pexels-photo-5258953.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&fit=crop',
  'https://images.pexels.com/photos/13659051/pexels-photo-13659051.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&fit=crop',
  'https://images.pexels.com/photos/28319618/pexels-photo-28319618.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&fit=crop',
  'https://images.pexels.com/photos/13239874/pexels-photo-13239874.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&fit=crop',
];

const Signup = () => {
  const navigate = useNavigate();
  const [bgIndex, setBgIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setBgIndex(i => (i + 1) % AUTH_BG_IMAGES.length), 6000);
    return () => clearInterval(timer);
  }, []);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    password_confirm: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');

  // Comprehensive email validation following Google's email standards
  const validateEmail = (email) => {
    // Email must start with a letter (not a number)
    const emailRegex = /^[a-zA-Z]([a-zA-Z0-9._-]{0,63})?@[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;
    
    if (!email) {
      return 'Email is required';
    }
    
    if (email.length > 254) {
      return 'Email is too long (max 254 characters)';
    }
    
    // Check if email starts with a number
    if (/^[0-9]/.test(email)) {
      return 'Email must start with a letter, not a number (e.g., user123@example.com, not 123user@example.com)';
    }
    
    if (!emailRegex.test(email)) {
      return 'Please enter a valid email address (e.g., user@example.com)';
    }
    
    // Check for valid domain extensions
    const validExtensions = /\.(com|net|org|edu|gov|mil|co|io|ai|app|dev|tech|info|biz|me|us|uk|ca|au|de|fr|jp|cn|in|br|ru|mx|es|it|nl|se|no|dk|fi|pl|za|sg|hk|nz|ae|sa|eg|ng|ke|gh|tz|ug|zm|zw|bw|mw|ao|mz|rw|bi|dj|er|et|so|sd|ss|td|cf|cg|cd|ga|gq|st|cm|ne|bf|ml|sn|gm|gn|sl|lr|ci|gh|tg|bj|ng|ne|chad)$/i;
    
    if (!validExtensions.test(email)) {
      return 'Email must have a valid domain extension (e.g., .com, .net, .org)';
    }
    
    // Check for consecutive dots
    if (email.includes('..')) {
      return 'Email cannot contain consecutive dots';
    }
    
    // Check local part (before @)
    const [localPart, domain] = email.split('@');
    
    // Prevent number-only emails (123@gmail.com)
    if (/^[0-9]+$/.test(localPart)) {
      return 'Email username cannot be numbers only (e.g., use john123@gmail.com instead of 123@gmail.com)';
    }
    
    // Must contain at least 2 letters
    const letterCount = (localPart.match(/[a-zA-Z]/g) || []).length;
    if (letterCount < 2) {
      return 'Email username must contain at least 2 letters';
    }
    
    if (localPart.length < 1 || localPart.length > 64) {
      return 'Email username must be between 1 and 64 characters';
    }
    
    if (localPart.startsWith('.') || localPart.endsWith('.')) {
      return 'Email cannot start or end with a dot';
    }
    
    // Check domain part
    if (!domain || domain.length < 4) {
      return 'Invalid email domain';
    }
    
    return '';
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    setFormData({
      ...formData,
      [name]: value,
    });
    
    // Real-time email validation
    if (name === 'email') {
      const validationError = validateEmail(value);
      setEmailError(validationError);
    }
  };

  const handleRecaptchaChange = (token) => {
    setRecaptchaToken(token);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validate email before submission
    const emailValidationError = validateEmail(formData.email);
    if (emailValidationError) {
      setEmailError(emailValidationError);
      setError('Please fix the email validation errors');
      setLoading(false);
      return;
    }

    if (!recaptchaToken) {
      setError('Please complete the reCAPTCHA verification');
      setLoading(false);
      return;
    }

    if (formData.password !== formData.password_confirm) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const response = await authAPI.signupOtp({
        email: formData.email,
        password: formData.password,
        recaptcha_token: recaptchaToken,
      });
      const nextEmail = response?.data?.email || formData.email;
      navigate('/verify-signup-otp', { state: { email: nextEmail } });
    } catch (error) {
      console.error('Signup error:', error);
      
      // Improved error handling
      let errorMsg = 'Signup failed. Please try again.';
      
      if (error.status === 'network_error') {
        errorMsg = `Network error: Cannot connect to server. Make sure the backend server is running at ${error.details?.apiUrl}`;
      } else if (error.status === 400) {
        errorMsg = error.message || 'Invalid data. Please check your information.';
      } else if (error.status === 500) {
        errorMsg = 'Server error. Please try again later.';
      } else if (error.response) {
        if (typeof error.response.data === 'object') {
          errorMsg = error.response.data.error || JSON.stringify(error.response.data);
        } else if (typeof error.response.data === 'string' && error.response.data.startsWith('<!DOCTYPE html')) {
          errorMsg = 'Server error. Please try again later or contact support.';
        } else {
          errorMsg = error.response.data;
        }
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    setError('');
    try {
      const response = await authAPI.googleLogin({
        credential: credentialResponse.credential,
      });
      // Google auth returns tokens directly
      localStorage.setItem('access_token', response.data.tokens.access);
      localStorage.setItem('refresh_token', response.data.tokens.refresh);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      localStorage.setItem('isAdmin', 'false');
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Google signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4 py-8">
      {/* Background image slider */}
      <div className="absolute inset-0">
        {AUTH_BG_IMAGES.map((src, i) => (
          <img
            key={i}
            src={src}
            alt=""
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-[2000ms] ${i === bgIndex ? 'opacity-100' : 'opacity-0'}`}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-blue-950/50 to-black/70" />
        <div className="absolute inset-0 bg-gradient-to-r from-sky-900/20 via-transparent to-indigo-900/20" />
      </div>

      {/* Card */}
      <div className="relative w-full max-w-md z-10 animate-fade-in">
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-soft-xl p-8 sm:p-10 border border-white/20">
          {/* Header */}
          <div className="flex flex-col items-center mb-6">
            <div className="relative mb-4">
              <div className="absolute inset-0 bg-primary-400/20 rounded-full blur-xl scale-150" />
              <img
                src={logoUrl}
                alt="Travello Logo"
                className="relative w-16 h-16 rounded-full border-2 border-primary-100 bg-white shadow-soft object-contain"
                onError={e => { e.target.onerror = null; e.target.src = 'https://placehold.co/64x64?text=Logo'; }}
              />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 font-display tracking-tight text-center">
              Create Your Account
            </h1>
            <p className="text-gray-500 text-sm mt-1.5">
              Start your travel adventure today
            </p>
          </div>

          <p className="text-center text-sm text-gray-500 mb-6">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 hover:text-primary-700 font-semibold transition-colors">
              Sign in
            </Link>
          </p>

          <form className="space-y-4" onSubmit={handleSubmit} autoComplete="off">
            {/* Username */}
            <div className="relative group">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-500 transition-colors duration-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </span>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 outline-none"
                placeholder="Choose a username"
                value={formData.username}
                onChange={handleChange}
              />
            </div>

            {/* Email */}
            <div>
              <div className="relative group">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-500 transition-colors duration-200">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </span>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className={`w-full pl-11 pr-4 py-3 bg-gray-50 border ${emailError ? 'border-danger-300 focus:border-danger-500 focus:ring-danger-500/20' : 'border-gray-200 focus:border-primary-500 focus:ring-primary-500/20'} rounded-xl text-gray-900 placeholder-gray-400 focus:bg-white focus:ring-2 transition-all duration-200 outline-none`}
                  placeholder="Enter your email (e.g., user@example.com)"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
              {emailError && (
                <p className="mt-1.5 text-xs text-danger-600 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {emailError}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="relative group">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-500 transition-colors duration-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </span>
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                className="w-full pl-11 pr-11 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 outline-none"
                placeholder="Create a password"
                value={formData.password}
                onChange={handleChange}
              />
              <button
                type="button"
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
                onClick={() => setShowPassword((prev) => !prev)}
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                )}
              </button>
            </div>

            {/* Confirm Password */}
            <div className="relative group">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-500 transition-colors duration-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </span>
              <input
                id="password_confirm"
                name="password_confirm"
                type={showPasswordConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                required
                className="w-full pl-11 pr-11 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 outline-none"
                placeholder="Confirm your password"
                value={formData.password_confirm}
                onChange={handleChange}
              />
              <button
                type="button"
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
                onClick={() => setShowPasswordConfirm((prev) => !prev)}
                tabIndex={-1}
              >
                {showPasswordConfirm ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                )}
              </button>
            </div>

            {/* reCAPTCHA */}
            <div className="flex flex-col items-center space-y-2 py-1">
              <ReCAPTCHA
                sitekey="6Lc1nd0rAAAAAEGQ49HpLRq8kFj1CVPoC1-leNOd"
                onChange={handleRecaptchaChange}
              />
              <p className="text-xs text-gray-400 text-center">
                Protected by reCAPTCHA.{' '}
                <a href="https://policies.google.com/privacy" className="underline hover:text-gray-500 transition-colors" target="_blank" rel="noopener noreferrer">Privacy</a>
                {' & '}
                <a href="https://policies.google.com/terms" className="underline hover:text-gray-500 transition-colors" target="_blank" rel="noopener noreferrer">Terms</a>
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 px-4 py-3 bg-danger-50 border border-danger-200 text-danger-700 rounded-xl text-sm animate-slide-up">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                {typeof error === 'string' ? error : JSON.stringify(error)}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 text-white font-semibold text-base shadow-soft hover:shadow-glow hover:from-primary-700 hover:to-primary-600 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-soft disabled:active:scale-100"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Creating account...
                </span>
              ) : 'Create account'}
            </button>
          </form>

          {/* Google signup */}
          <div className="mt-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-px bg-gray-200 flex-1" />
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">or</span>
              <div className="h-px bg-gray-200 flex-1" />
            </div>
            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError('Google signup failed. Please try again.')}
                useOneTap={false}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;



