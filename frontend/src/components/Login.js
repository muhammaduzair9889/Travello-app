import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
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

const Login = () => {
  const navigate = useNavigate();
  const [bgIndex, setBgIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setBgIndex(i => (i + 1) % AUTH_BG_IMAGES.length), 6000);
    return () => clearInterval(timer);
  }, []);
  const location = useLocation();
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
    
    const [localPart] = email.split('@');
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
      const loginMethod = isAdminLogin ? authAPI.adminLogin : authAPI.loginOtp;
      const response = await loginMethod({
        email: formData.email,
        password: formData.password,
        recaptcha_token: recaptchaToken,
      });

      if (isAdminLogin) {
        localStorage.setItem('access_token', response.data.tokens.access);
        localStorage.setItem('refresh_token', response.data.tokens.refresh);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        localStorage.setItem('isAdmin', 'true');
        navigate('/admin-dashboard');
      } else {
        const nextEmail = response?.data?.email || formData.email;
        localStorage.setItem('isAdmin', 'false');
        navigate('/verify-login-otp', { state: { email: nextEmail, password: formData.password } });
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

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    setError('');
    try {
      const response = await authAPI.googleLogin({
        credential: credentialResponse.credential,
      });
      // Google auth returns tokens directly (no OTP needed)
      localStorage.setItem('access_token', response.data.tokens.access);
      localStorage.setItem('refresh_token', response.data.tokens.refresh);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      localStorage.setItem('isAdmin', 'false');
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Google login failed. Please try again.');
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
              {isAdminLogin ? 'Admin Panel Login' : 'Welcome Back'}
            </h1>
            <p className="text-gray-500 text-sm mt-1.5">
              {isAdminLogin ? 'Administrator access only' : 'Sign in to continue your journey'}
            </p>
          </div>

          {!isAdminLogin && (
            <p className="text-center text-sm text-gray-500 mb-6">
              Don't have an account?{' '}
              <Link to="/signup" className="text-primary-600 hover:text-primary-700 font-semibold transition-colors">
                Sign up
              </Link>
            </p>
          )}

          {location.state?.message && (
            <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-success-50 border border-success-200 text-success-700 rounded-xl text-sm animate-slide-up">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {location.state.message}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit} autoComplete="off">
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
                  placeholder="Email address"
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
                autoComplete="current-password"
                required
                className="w-full pl-11 pr-11 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 outline-none"
                placeholder="Password"
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

            {/* Remember + Forgot */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  name="remember"
                  checked={formData.remember}
                  onChange={handleChange}
                  className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500/20 transition"
                />
                Remember me
              </label>
              <Link to="/forgot-password" className="text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors">
                Forgot Password?
              </Link>
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
                {error}
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
                  Signing in...
                </span>
              ) : (isAdminLogin ? 'Sign in as Admin' : 'Sign in')}
            </button>
          </form>

          {/* Google login - user mode only */}
          {!isAdminLogin && (
            <div className="mt-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-px bg-gray-200 flex-1" />
                <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">or</span>
                <div className="h-px bg-gray-200 flex-1" />
              </div>
              <div className="flex justify-center">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError('Google login failed. Please try again.')}
                  useOneTap={false}
                />
              </div>
            </div>
          )}

          {/* Admin toggle */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <button
              type="button"
              onClick={toggleLoginMode}
              className="w-full py-2.5 px-4 rounded-xl bg-gray-50 border border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-100 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-200 transition-all duration-200 flex items-center justify-center gap-2"
            >
              {isAdminLogin ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Back to User Login
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Login as Admin
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;







