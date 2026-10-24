import React, { useState } from 'react';
import { User } from '../types';
import { api, ApiError } from '../services/api';

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'PHONE' | 'OTP'>('PHONE');
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Handle Request OTP via Real API
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    const trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      setError('Phone number is required.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await api.requestOtp(trimmedPhone);
      setIsLoading(false);
      setStep('OTP');
      setInfoMessage(res.message || 'OTP generated successfully.');
    } catch (err: any) {
      setIsLoading(false);
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to request OTP. Please ensure the backend server is running.');
      }
    }
  };

  // Handle Verify OTP via Real API
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedOtp = otp.trim();
    if (!trimmedOtp) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    if (!/^\d{6}$/.test(trimmedOtp)) {
      setError('The verification code must be exactly 6 digits.');
      return;
    }

    setIsLoading(true);

    try {
      const { user } = await api.verifyOtp(phone.trim(), trimmedOtp);
      setIsLoading(false);
      onLoginSuccess(user);
    } catch (err: any) {
      setIsLoading(false);
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Verification failed. Please check your network connection.');
      }
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    setError(null);
    setInfoMessage(null);
    setIsLoading(true);

    try {
      const res = await api.requestOtp(phone.trim());
      setIsLoading(false);
      setInfoMessage(res.message || 'A new OTP has been printed to the server console.');
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || 'Failed to resend OTP.');
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        {/* Branding header */}
        <div className="login-header">
          <div className="login-logo-circle" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <h1 className="login-title">MiniLedger</h1>
          <p className="login-tagline">Track personal loans and manage friend repayments with confidence.</p>
        </div>

        {/* Auth Card */}
        <div className="card login-card">
          <div className="login-card-header">
            <h2>{step === 'PHONE' ? 'Sign In / Register' : 'Enter Verification Code'}</h2>
            <p className="login-card-subtitle">
              {step === 'PHONE'
                ? 'Enter your mobile number to receive a one-time code.'
                : `Enter the 6-digit code for ${phone}.`}
            </p>
          </div>

          {/* Info Banner */}
          {infoMessage && (
            <div className="alert alert-info" role="status">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
              <span>{infoMessage}</span>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="alert alert-danger" role="alert">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>{error}</span>
            </div>
          )}

          {step === 'PHONE' ? (
            /* Phone Number Step */
            <form onSubmit={handleRequestOtp} noValidate>
              <div className="form-group mb-4">
                <label htmlFor="phoneNumber" className="form-label">
                  Mobile Phone Number
                </label>
                <div className="phone-input-wrap">
                  <span className="phone-flag-icon" aria-hidden="true">📱</span>
                  <input
                    id="phoneNumber"
                    type="tel"
                    inputMode="tel"
                    className="form-input pl-phone"
                    placeholder="e.g. +1 555-019-2834"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={isLoading}
                    autoFocus
                  />
                </div>
                <span className="field-help">Include country code for international format (e.g. +1 or +91).</span>
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-block btn-lg"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="spinner-text">Sending OTP...</span>
                ) : (
                  <span>Send One-Time Code →</span>
                )}
              </button>
            </form>
          ) : (
            /* OTP Verification Step */
            <form onSubmit={handleVerifyOtp} noValidate>
              <div className="form-group">
                <label htmlFor="otpCode" className="form-label">
                  6-Digit Verification Code
                </label>
                <input
                  id="otpCode"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  className="form-input otp-input"
                  placeholder="••••••"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  disabled={isLoading}
                  autoFocus
                />
              </div>

              <div className="otp-hint-box">
                <div className="otp-server-note">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="4 17 10 11 4 5"></polyline>
                    <line x1="12" y1="19" x2="20" y2="19"></line>
                  </svg>
                  <span>Check server terminal for logged OTP</span>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-block btn-lg"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="spinner-text">Verifying...</span>
                ) : (
                  <span>Verify & Open Dashboard</span>
                )}
              </button>

              <div className="otp-footer-actions">
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => {
                    setStep('PHONE');
                    setOtp('');
                    setError(null);
                    setInfoMessage(null);
                  }}
                  disabled={isLoading}
                >
                  ← Change Phone Number
                </button>
                <button
                  type="button"
                  className="btn-link text-muted"
                  onClick={handleResendOtp}
                  disabled={isLoading}
                >
                  Resend Code
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
