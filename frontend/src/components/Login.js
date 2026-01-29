import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import ReCAPTCHA from 'react-google-recaptcha';
import { authAPI } from '../services/api';

const logoUrl = 'https://cdn-icons-png.flaticon.com/512/854/854878.png'; // Travello logo

const Login = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    remember: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  const [emailError, setEmailError] = useState('');

  // Comprehensive email validation
  const validateEmail = (email) => {
    // Email must start with a letter
    const emailRegex = /^[a-zA-Z]([a-zA-Z0-9._-]{0,63})?@[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;
    
    if (!email) return 'Email is required';
    if (email.length > 254) return 'Email is too long';
    if (/^[0-9]/.test(email)) return 'Email must start with a letter, not a number';
    if (!emailRegex.test(email)) return 'Please enter a valid email address';
    if (email.includes('..')) return 'Email cannot contain consecutive dots';
    
    const [localPart, domain] = email.split('@');
    if (localPart.startsWith('.') || localPart.endsWith('.')) {
      return 'Email cannot start or end with a dot';
    }
    
    const validExtensions = /\.(com|net|org|edu|gov|mil|co|io|ai|app|dev|tech|info|biz)$/i;
    if (!validExtensions.test(email)) {
      return 'Email must have a valid domain extension';
    }
    
    return '';
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    
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

    // Validate email
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

    try {
      const loginMethod = isAdminLogin ? authAPI.adminLogin : authAPI.login;
      const response = await loginMethod({
        email: formData.email,
        password: formData.password,
        recaptcha_token: recaptchaToken,
      });
      localStorage.setItem('access_token', response.data.tokens.access);
      localStorage.setItem('refresh_token', response.data.tokens.refresh);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      localStorage.setItem('isAdmin', isAdminLogin ? 'true' : 'false');
      
      // Navigate to appropriate dashboard based on user type
      if (isAdminLogin) {
        navigate('/admin-dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('Login error:', err);
      
      // Improved error handling
      let errorMessage = 'Login failed. Please try again.';
      
      if (err.status === 'network_error') {
        errorMessage = `Network error: Cannot connect to server at ${err.details?.apiUrl}. Make sure the backend server is running.`;
      } else if (err.status === 404) {
        errorMessage = 'Invalid email or password.';
      } else if (err.status === 400) {
        errorMessage = err.message || 'Invalid credentials. Please check your email and password.';
      } else if (err.status === 500) {
        errorMessage = 'Server error. Please try again later.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const toggleLoginMode = () => {
    setIsAdminLogin(!isAdminLogin);
    setError('');
    setFormData({ email: '', password: '', remember: false });
    setRecaptchaToken('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 via-blue-400 to-indigo-300 py-8 px-2">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 sm:p-10 flex flex-col items-center transition-all duration-300 border border-blue-100">
        <div className="flex flex-col items-center w-full mb-4">
          <img src={logoUrl} alt="Travello Logo" className="w-20 h-20 mb-2 object-contain rounded-full border-2 border-blue-200 bg-white shadow" onError={e => {e.target.onerror=null;e.target.src='https://placehold.co/80x80?text=Logo';}} />
          <h2 className="text-3xl font-extrabold text-blue-800 mb-1 text-center tracking-tight">
            {isAdminLogin ? 'Admin Login' : 'Sign in to Travello'}
          </h2>
          {isAdminLogin && (
            <p className="text-sm text-indigo-600 font-medium">Administrator Access</p>
          )}
        </div>
        {!isAdminLogin && (
          <p className="text-blue-600 text-center mb-6 w-full text-base">
            Don't have an account?{' '}
            <Link to="/signup" className="text-indigo-700 hover:underline font-semibold">Sign up</Link>
          </p>
        )}
        <form className="w-full space-y-4" onSubmit={handleSubmit} autoComplete="off">
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
              placeholder="Email address"
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
              autoComplete="current-password"
              required
              className="pl-10 pr-10 py-2 w-full border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-gray-800 placeholder-blue-300 bg-blue-50 transition"
              placeholder="Password"
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
          <div className="flex items-center justify-between">
            <label className="flex items-center text-sm text-blue-700">
              <input
                type="checkbox"
                name="remember"
                checked={formData.remember}
                onChange={handleChange}
                className="form-checkbox h-4 w-4 text-blue-600 rounded focus:ring-blue-500 border-blue-200"
              />
              <span className="ml-2">Remember me</span>
            </label>
            <Link to="/forgot-password" className="text-sm text-blue-700 hover:underline font-medium">Forgot Password?</Link>
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
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 mt-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-500 text-white font-bold text-lg shadow-lg hover:from-blue-700 hover:to-indigo-600 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center"><svg className="animate-spin h-5 w-5 mr-2 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>Signing in...</span>
            ) : (isAdminLogin ? 'Admin Sign in' : 'Sign in')}
          </button>
        </form>
        <div className="w-full mt-4 pt-4 border-t border-blue-200">
          <button
            type="button"
            onClick={toggleLoginMode}
            className="w-full py-2 px-4 rounded-lg bg-white border-2 border-blue-300 text-blue-700 font-semibold hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all duration-200 flex items-center justify-center"
          >
            {isAdminLogin ? (
              <>
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Back to User Login
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Login as Admin
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;







