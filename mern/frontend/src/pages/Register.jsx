import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'react-toastify';
import Loader from '../components/common/Loader';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { register } = useAuth();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      return toast.error('Passwords do not match');
    }

    setLoading(true);

    try {
      const { name, email, password, phoneNumber } = formData;

      // Validate phone number
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      if (cleanPhone.length !== 10) {
        setLoading(false);
        return toast.error('Phone number must be exactly 10 digits');
      }

      const registrationData = { name, email, password, phoneNumber: cleanPhone };
      const response = await register(registrationData);

      // Check if email verification is required
      if (response?.data?.requiresVerification) {
        navigate('/verify-email', { state: { email, password } });
      } else {
        navigate('/login');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'An error occurred during registration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ui-page flex items-center justify-center">
      <div className="ui-card max-w-md w-full space-y-8 p-7 sm:p-10">
        <div className="text-center">
          <span className="fmpg-kicker">Join FMPG</span>
          <h2 className="ui-page-title mt-3">Create an account</h2>
          <p className="mt-2 text-sm text-slate-500">
            Or{' '}
            <Link to="/login" className="font-semibold text-emerald-600 hover:text-emerald-700">
              sign in to your existing account
            </Link>
          </p>
        </div>

        <div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="name" className="ui-label">Full name</label>
              <input
                type="text"
                className="ui-input"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="John Doe"
              />
            </div>

            <div>
              <label htmlFor="email" className="ui-label">Email address</label>
              <input
                type="email"
                className="ui-input"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label htmlFor="phoneNumber" className="ui-label">Phone number</label>
              <input
                type="tel"
                className="ui-input"
                id="phoneNumber"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleChange}
                required
                placeholder="1234567890"
              />
            </div>

            <div>
              <label htmlFor="password" className="ui-label">Password</label>
              <input
                type="password"
                className="ui-input"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="••••••••"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="ui-label">Confirm password</label>
              <input
                type="password"
                className="ui-input"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                placeholder="••••••••"
              />
            </div>

            <div>
              <button
                type="submit"
                className="fmpg-primary-button w-full flex justify-center items-center py-3 px-4 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                disabled={loading}
              >
                {loading ? <Loader inline size="sm" text="Creating account…" /> : 'Create account'}
              </button>
            </div>

            <p className="text-center text-xs text-slate-500 mt-4 leading-5">
              By registering, you agree to our{' '}
              <a href="https://fmpg.vercel.app/TermsAndConditions" className="text-lime-400 hover:text-lime-300">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="https://fmpg.vercel.app/privacypolicy" className="text-lime-400 hover:text-lime-300">
                Privacy Policy
              </a>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Register;