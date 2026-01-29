import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import ReCAPTCHA from 'react-google-recaptcha';
import { authAPI } from '../services/api';

const logoUrl = 'https://cdn-icons-png.flaticon.com/512/854/854878.png'; // Travello logo

const Signup = () => {
  const navigate = useNavigate();
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
      const response = await authAPI.signup({
        ...formData,
        recaptcha_token: recaptchaToken,
      });
      localStorage.setItem('access_token', response.data.tokens.access);
      localStorage.setItem('refresh_token', response.data.tokens.refresh);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      navigate('/dashboard');
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 via-blue-400 to-indigo-300 py-8 px-2">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 sm:p-10 flex flex-col items-center transition-all duration-300 border border-blue-100">
        <div className="flex flex-col items-center w-full mb-4">
          <img src={logoUrl} alt="Travello Logo" className="w-20 h-20 mb-2 object-contain rounded-full border-2 border-blue-200 bg-white shadow" onError={e => {e.target.onerror=null;e.target.src='https://placehold.co/80x80?text=Logo';}} />
          <h2 className="text-3xl font-extrabold text-blue-800 mb-1 text-center tracking-tight">Create your Travello account</h2>
        </div>
        <p className="text-blue-600 text-center mb-6 w-full text-base">
          Already have an account?{' '}
          <Link to="/login" className="text-indigo-700 hover:underline font-semibold">Sign in</Link>
        </p>
        <form className="w-full space-y-4" onSubmit={handleSubmit} autoComplete="off">
          <div className="relative">
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 12A4 4 0 1 0 8 12a4 4 0 0 0 8 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 14v7m0 0H9m3 0h3" /></svg>
            </span>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              className="pl-10 pr-4 py-2 w-full border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-gray-800 placeholder-blue-300 bg-blue-50 transition"
              placeholder="Choose a username"
              value={formData.username}
              onChange={handleChange}
            />
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 12A4 4 0 1 0 8 12a4 4 0 0 0 8 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 14v7m0 0H9m3 0h3" /></svg>
            </span>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className={`pl-10 pr-4 py-2 w-full border ${emailError ? 'border-red-500 focus:ring-red-400' : 'border-blue-200 focus:ring-blue-400'} rounded-lg focus:ring-2 focus:border-blue-400 text-gray-800 placeholder-blue-300 bg-blue-50 transition`}
              placeholder="Enter your email (e.g., user@example.com)"
              value={formData.email}
              onChange={handleChange}
            />
            {emailError && (
              <p className="mt-1 text-xs text-red-600 flex items-center">
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                </svg>
                {emailError}
              </p>
            )}
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 11c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm0 2c-2.21 0-4 1.79-4 4v1h8v-1c0-2.21-1.79-4-4-4z" /></svg>
            </span>
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              className="pl-10 pr-10 py-2 w-full border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-gray-800 placeholder-blue-300 bg-blue-50 transition"
              placeholder="Create a password"
              value={formData.password}
              onChange={handleChange}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-400 hover:text-blue-600 focus:outline-none"
              onClick={() => setShowPassword((prev) => !prev)}
              tabIndex={-1}
            >
              {showPassword ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.956 9.956 0 012.293-3.95M6.7 6.7A9.956 9.956 0 0112 5c4.477 0 8.268 2.943 9.542 7a9.956 9.956 0 01-4.043 5.132M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" /></svg>
              )}
            </button>
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 11c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm0 2c-2.21 0-4 1.79-4 4v1h8v-1c0-2.21-1.79-4-4-4z" /></svg>
            </span>
            <input
              id="password_confirm"
              name="password_confirm"
              type={showPasswordConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              required
              className="pl-10 pr-10 py-2 w-full border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-gray-800 placeholder-blue-300 bg-blue-50 transition"
              placeholder="Confirm your password"
              value={formData.password_confirm}
              onChange={handleChange}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-400 hover:text-blue-600 focus:outline-none"
              onClick={() => setShowPasswordConfirm((prev) => !prev)}
              tabIndex={-1}
            >
              {showPasswordConfirm ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.956 9.956 0 012.293-3.95M6.7 6.7A9.956 9.956 0 0112 5c4.477 0 8.268 2.943 9.542 7a9.956 9.956 0 01-4.043 5.132M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" /></svg>
              )}
            </button>
          </div>
          <div className="flex flex-col items-center justify-center space-y-2">
            <ReCAPTCHA
              sitekey="6Lc1nd0rAAAAAEGQ49HpLRq8kFj1CVPoC1-leNOd"
              onChange={handleRecaptchaChange}
            />
            <span className="text-xs text-blue-500">This site is protected by reCAPTCHA and the Google <a href="https://policies.google.com/privacy" className="underline" target="_blank" rel="noopener noreferrer">Privacy Policy</a> and <a href="https://policies.google.com/terms" className="underline" target="_blank" rel="noopener noreferrer">Terms of Service</a> apply.</span>
          </div>
          {error && (
            <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-md mt-2 animate-pulse flex items-center">
              <svg className="inline w-4 h-4 mr-2 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              {typeof error === 'string' ? error : JSON.stringify(error)}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 mt-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-500 text-white font-bold text-lg shadow-lg hover:from-blue-700 hover:to-indigo-600 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center"><svg className="animate-spin h-5 w-5 mr-2 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>Creating account...</span>
            ) : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Signup;



