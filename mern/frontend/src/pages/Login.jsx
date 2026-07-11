import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'react-toastify';
import Loader from '../components/common/Loader';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const from = location.state?.from || '/';

  useEffect(() => {
    // Check for session expiry message in URL params
    const urlParams = new URLSearchParams(location.search);
    const message = urlParams.get('message');
    if (location.state?.message) {
      toast.info(location.state.message);
    }
  }, [location]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await login(formData);

      console.log('Login response:', response);
      console.log('User role:', response.user?.role);
      console.log('From path:', from);

      // Check if user is admin and redirect accordingly
      if (response.user && response.user.role === 'admin') {
        console.log('Navigating to dashboard for admin');
        navigate('/dashboard', { replace: true });
      } else {
        // For regular users, navigate to home page or the intended page
        // But avoid redirecting to admin-only routes
        let targetPath = from;

        // List of admin-only routes
        const adminOnlyRoutes = [
          '/dashboard',
          '/certificates',
          '/offer-letters',
          '/jobs/create',
          '/admin/'
        ];

        // Check if the target path is admin-only
        const isAdminRoute = adminOnlyRoutes.some(route =>
          from === route || from.startsWith(route) || from.startsWith('/jobs/edit/')
        );

        if (isAdminRoute) {
          targetPath = '/';
        }

        console.log('Navigating to:', targetPath);
        navigate(targetPath, { replace: true });
      }

    } catch (err) {
      const errorData = err.response?.data;
      if (errorData?.requiresVerification) {
        // Redirect to email verification if email is not verified
        navigate('/verify-email', { state: { email: formData.email, password: formData.password } });
      } else {
        toast.error(errorData?.message || 'Invalid login credentials');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 flex items-center justify-center py-28 px-4 sm:px-6 lg:px-8">
      <div className="absolute -left-24 top-24 h-80 w-80 rounded-full bg-emerald-100/70 blur-3xl" />
      <div className="absolute -right-20 bottom-10 h-72 w-72 rounded-full bg-amber-50 blur-3xl" />
      {loading && <Loader fullPage={true} text="Authenticating..." />}
      <div className="relative max-w-md w-full space-y-8 rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_24px_60px_-30px_rgba(15,23,42,0.3)] sm:p-10">
        <div className="text-center">
          {/* <Link to="/" className="inline-block mb-6">
            <img src="/logo.png" alt="FMPG Logo" className="h-16 mx-auto" />
          </Link> */}
          <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-widest text-emerald-700">Welcome back</span>
          <h2 className="mt-4 font-heading text-3xl font-extrabold text-slate-950">Sign in to your account</h2>
          <p className="mt-2 text-sm text-slate-500">
            Or{' '}
            <Link to="/register" className="font-semibold text-emerald-600 hover:text-emerald-700">
              create a new account
            </Link>
          </p>
        </div>

        <div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-2">Email address</label>
              <input
                type="email"
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-slate-900"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="your@email.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="password" className="block text-sm font-semibold text-slate-700">Password</label>
                <Link to="/forgot-password" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">
                  Forgot your password?
                </Link>
              </div>
              <input
                type="password"
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-slate-900"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="••••••••"
              />
            </div>

            <div>
              <button
                type="submit"
                className="w-full min-h-12 flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-[0_12px_26px_-14px_rgba(5,150,105,0.8)] text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors duration-300 disabled:opacity-70"
                disabled={loading}
              >
                Sign in
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;