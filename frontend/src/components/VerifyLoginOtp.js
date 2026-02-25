import React, { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../services/api';

const VerifyLoginOtp = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const params = new URLSearchParams(location.search);
  const emailFromState = location.state?.email;
  const passwordFromState = location.state?.password;
  const emailFromQuery = params.get('email');
  const email = emailFromState || emailFromQuery || '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');

    if (!email) {
      setError('Email is missing. Please go back to login.');
      setLoading(false);
      return;
    }

    if (!otpCode.trim()) {
      setError('Please enter the OTP code.');
      setLoading(false);
      return;
    }

    try {
      const response = await authAPI.verifyLoginOtp({
        email,
        otp_code: otpCode.trim(),
      });
      localStorage.setItem('access_token', response.data.tokens.access);
      localStorage.setItem('refresh_token', response.data.tokens.refresh);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      localStorage.setItem('isAdmin', 'false');
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Failed to verify OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isGoogleLogin = location.state?.isGoogleLogin || false;

  const handleResend = async () => {
    if (!email) {
      setError('Email is missing. Please go back to login.');
      return;
    }

    setLoading(true);
    setError('');
    setInfo('');

    try {
      if (isGoogleLogin || !passwordFromState) {
        // Google login or no password — use resend-only endpoint
        await authAPI.resendLoginOtp({ email });
      } else {
        await authAPI.loginOtp({ email, password: passwordFromState });
      }
      setInfo('OTP resent. Please check your email.');
    } catch (err) {
      setError(err.message || 'Failed to resend OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 via-blue-400 to-indigo-300 py-8 px-2">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 sm:p-10 flex flex-col items-center border border-blue-100">
        <h2 className="text-3xl font-extrabold text-blue-800 mb-2 text-center">Verify login</h2>
        <p className="text-blue-600 text-center mb-6 w-full text-base">
          Enter the OTP sent to {email || 'your email'}
        </p>
        <form className="w-full space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-blue-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full border border-blue-200 rounded-lg px-3 py-2 bg-blue-50 text-gray-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-blue-700 mb-1">OTP Code</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              className="w-full border border-blue-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
              placeholder="Enter 6-digit code"
            />
          </div>
          {error && (
            <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-md">
              {error}
            </div>
          )}
          {info && (
            <div className="bg-green-100 border border-green-200 text-green-800 px-4 py-3 rounded-md">
              {info}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-500 text-white font-bold text-lg shadow-lg hover:from-blue-700 hover:to-indigo-600 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Verifying...' : 'Verify OTP'}
          </button>
        </form>
        <div className="mt-4 text-sm text-blue-700 flex gap-4">
          <button
            type="button"
            onClick={handleResend}
            className="underline"
            disabled={loading}
          >
            Resend OTP
          </button>
          <Link to="/login" className="underline">Back to login</Link>
        </div>
      </div>
    </div>
  );
};

export default VerifyLoginOtp;
