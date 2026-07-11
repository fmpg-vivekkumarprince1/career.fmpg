import { createContext, useState, useEffect, useContext } from 'react';
import { authService } from '../services/api';
import { trackedFetch } from '../utils/loadingTracker';
import { getTokenCheckInterval } from '../config/authConfig';
import { setCache, getCache } from '../utils/cache';
import Loader from '../components/common/Loader';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      const cachedUser = getCache('user') || authService.getCurrentUser();

      if (token && !authService.isTokenExpired()) {
        if (cachedUser) {
          setCurrentUser(cachedUser);
        }
        
        try {
          // Fetch fresh user data to ensure permissions are up to date
          const response = await authService.getMe();
          const freshUser = response.data.user;
          setCurrentUser(freshUser);
          localStorage.setItem('user', JSON.stringify(freshUser));
          console.log('AuthContext: User synced with backend:', freshUser.email);
        } catch (error) {
          console.error('AuthContext: Sync failed:', error);
          if (error.response?.status === 401) {
            authService.clearAuthData();
            setCurrentUser(null);
          }
        }
      } else {
        authService.clearAuthData();
        setCurrentUser(null);
      }
      setLoading(false);
    };

    initAuth();

    const handleTokenChange = () => {
      const user = authService.getCurrentUser();
      const token = localStorage.getItem('token');

      if (user && token && !authService.isTokenExpired()) {
        setCurrentUser(user);
      } else {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setCurrentUser(null);
      }
    };

    window.addEventListener('storage', handleTokenChange);
    window.addEventListener('tokenExpired', handleTokenChange);

    const interval = setInterval(handleTokenChange, getTokenCheckInterval());

    return () => {
      window.removeEventListener('storage', handleTokenChange);
      window.removeEventListener('tokenExpired', handleTokenChange);
      clearInterval(interval);
    };
  }, []);

  const login = async (credentials) => {
    try {
      const response = await authService.login(credentials);
      const { token, user } = response.data;
      
      console.log('AuthContext: Login response received:', { token: !!token, user: user });
      
      // Store token and user data
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      // Update current user state and wait for it to be set
      setCurrentUser(user);
      
      console.log('AuthContext: User state updated to:', user);
      
      // Return the response data for navigation logic
      return { ...response.data, user };
    } catch (error) {
      console.error('AuthContext: Login error:', error);
      throw error;
    }
  };



  const register = async (userData) => {
    try {
      const response = await authService.register(userData);
      return response; // Return the full response to check for requiresVerification
    } catch (error) {
      throw error;
    }
  };



  const logout = () => {
    authService.clearAuthData();
    setCurrentUser(null);
  };



  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super-admin';
  const isSuperAdmin = currentUser?.role === 'super-admin';
  const isEmployee = currentUser?.role === 'employee';
  
  // HR is defined as anyone in the HR department or an admin
  const isHR = currentUser?.department?.toUpperCase() === 'HR' || 
               currentUser?.department === 'General Management/Administration' || 
               isAdmin;

  // Dashboard access is for admins OR HR with explicit permission
  const hasDashboardAccess = isAdmin || (isHR && currentUser?.permissions?.canAccessDashboard);

  const value = {
    currentUser,
    login,
    register,
    logout,
    loading,
    isAdmin,
    isSuperAdmin,
    isEmployee,
    isHR,
    hasDashboardAccess
  };



  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <Loader fullPage={true} text="Restoring session..." />
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};

// Custom hook to use the AuthContext
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};