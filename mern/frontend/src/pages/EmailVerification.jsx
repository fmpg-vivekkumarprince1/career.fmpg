import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { authService } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import Loader from '../components/common/Loader';

const EmailVerification = () => {
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [otp, setOtp] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  useEffect(() => {
    // Get email and password from location state (from registration or login)
    const stateEmail = location.state?.email;
    const statePassword = location.state?.password;
    if (stateEmail) {
      setEmail(stateEmail);
      if (statePassword) {
        setPassword(statePassword);
      }
    } else {
      // Redirect to login if no email provided
      navigate('/login');
    }
  }, [location.state, navigate]);

  const handleChange = (e) => {
    const value = e.target.value.replace(/\D/g, ''); // Only allow digits
    if (value.length <= 6) {
      setOtp(value);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!otp.trim()) {
      return toast.error('OTP is required');
    }
    if (otp.length !== 6) {
      return toast.error('OTP must be 6 digits');
    }

    setLoading(true);
    try {
      await authService.verifyEmail({ email, otp });
      
      // If password is available, automatically log in the user
      if (password) {
        try {
          await login({ email, password });
          toast.success('Email verified successfully! You are now logged in.');
          navigate('/dashboard');
        } catch (loginError) {
          // If auto-login fails, redirect to login page
          toast.success('Email verified successfully! Please log in with your credentials.');
          navigate('/login');
        }
      } else {
        toast.success('Email verified successfully! You can now login.');
        navigate('/login');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setResendLoading(true);
    try {
      const res = await authService.resendVerificationOTP({ email });
      if (res.data?.devOtp) {
        toast.success(res.data.message || 'OTP resent (dev mode)');
        setOtp(res.data.devOtp);
      } else {
        toast.success(res.data?.message || 'Verification code sent to your email');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to resend OTP');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="ui-page flex items-center justify-center">
      <div className="max-w-md w-full">
        <div className="ui-card p-7 sm:p-9">
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-emerald-50 text-emerald-700 rounded-2xl flex items-center justify-center mb-5">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.945L21 8m-18 0l7.89 4.945L21 8M3 8v10a2 2 0 002 2h14a2 2 0 002-2V8" />
              </svg>
            </div>
            <h2 className="ui-page-title mb-2">Verify your email</h2>
            <p className="text-slate-600 mb-4">
              We've sent a verification code to
            </p>
            <p className="text-emerald-700 font-semibold break-all">
              {email}
            </p>
          </div>

          <form onSubmit={handleVerify} className="space-y-6">
            <div>
              <label htmlFor="otp" className="ui-label text-center">
                Enter 6-digit verification code
              </label>
              <input
                type="text"
                id="otp"
                value={otp}
                onChange={handleChange}
                maxLength={6}
                className="ui-input py-4 text-center text-2xl tracking-[0.5em] font-mono"
                placeholder="000000"
                autoComplete="one-time-code"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="fmpg-primary-button w-full py-3 px-4 transition disabled:opacity-60"
            >
              {loading ? 'Verifying…' : 'Verify email'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-slate-500 text-sm mb-3">
              Didn't receive the code?
            </p>
            <button
              type="button"
              onClick={handleResendOTP}
              disabled={resendLoading}
              className="text-lime-400 hover:text-lime-300 text-sm font-medium underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resendLoading ? 'Sending...' : 'Resend verification code'}
            </button>
          </div>

          <div className="mt-8 text-center">
            <p className="text-gray-300 text-sm">
              Need help?{' '}
              <Link to="/contact" className="text-lime-400 hover:text-lime-300 underline">
                Contact support
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailVerification;
