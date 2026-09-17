import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import Loader from './components/common/Loader';
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';
import EmployeeRoute from './components/EmployeeRoute';
import ErrorBoundary from './components/common/ErrorBoundary';

// Lazy load pages
const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const EmailVerification = lazy(() => import('./pages/EmailVerification'));
const Jobs = lazy(() => import('./pages/JobsList'));
const JobForm = lazy(() => import('./pages/JobDashboard'));
const Apply = lazy(() => import('./pages/Apply'));
const MyApplications = lazy(() => import('./pages/MyApplications'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Certificates = lazy(() => import('./pages/Certificates'));
const OfferLetters = lazy(() => import('./pages/OfferLetters'));
const VerifyCertificate = lazy(() => import('./pages/VerifyCertificate'));
const VerifyOfferLetter = lazy(() => import('./pages/VerifyOfferLetter'));
const Contact = lazy(() => import('./pages/Contact'));
const SubmitReview = lazy(() => import('./pages/SubmitReview'));
const AdminReviewManagement = lazy(() => import('./components/reviews/AdminReviewManagement'));
const EmployeeManagement = lazy(() => import('./pages/admin/EmployeeManagement'));
const UserManagement = lazy(() => import('./pages/admin/UserManagement'));
const RecommendationManagement = lazy(() => import('./pages/admin/RecommendationManagement'));
const EmployeeProfile = lazy(() => import('./pages/EmployeeProfile'));
const ApplicationDetail = lazy(() => import('./pages/ApplicationDetail'));
const OfferAcceptance = lazy(() => import('./pages/OfferAcceptance'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const ManageHR = lazy(() => import('./pages/admin/ManageHR'));
const AuditLogs = lazy(() => import('./pages/admin/AuditLogs'));
const HrmsWorkspace = lazy(() => import('./pages/HrmsWorkspace'));
const VerifyDocument = lazy(() => import('./pages/VerifyDocument'));

import './index.css';

const AppContent = () => {
  console.log('App: Rendering AppContent');
  const location = useLocation();

  // Prefetch key pages for instant navigation
  useEffect(() => {
    const prefetch = () => {
      import('./pages/Home').catch(() => {});
      import('./pages/JobsList').catch(() => {});
      import('./pages/Apply').catch(() => {});
    };
    // Use requestIdleCallback if available, otherwise setTimeout
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(prefetch);
    } else {
      setTimeout(prefetch, 2000);
    }
  }, []);

  // List of routes where the footer should be hidden
  const hideFooterRoutes = ['/login', '/register', '/apply'];

  // Check if current path matches any of the hideFooterRoutes
  const shouldHideFooter = hideFooterRoutes.some(path =>
    location.pathname === path || location.pathname.startsWith(`${path}/`)
  );

  return (
    <div className="app-container flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow">
        <Suspense fallback={<Loader fullPage />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/verify-email" element={<EmailVerification />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/jobs/create" element={
              <AdminRoute>
                <JobForm />
              </AdminRoute>
            } />
            <Route path="/jobs/edit/:id" element={
              <AdminRoute>
                <JobForm />
              </AdminRoute>
            } />
            <Route
              path="/applications/:id"
              element={
                <PrivateRoute>
                  <ApplicationDetail />
                </PrivateRoute>
              }
            />
            <Route
              path="/apply/:slug"
              element={<Apply />}
            />
            <Route
              path="/my-applications"
              element={
                <PrivateRoute>
                  <MyApplications />
                </PrivateRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <PrivateRoute>
                  <NotificationsPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <AdminRoute>
                  <Dashboard />
                </AdminRoute>
              }
            />
            <Route
              path="/certificates"
              element={
                <AdminRoute>
                  <Certificates />
                </AdminRoute>
              }
            />
            <Route
              path="/offer-letters"
              element={
                <AdminRoute>
                  <OfferLetters />
                </AdminRoute>
              }
            />
            {/* Public certificate verification routes */}
            <Route path="/verify" element={<VerifyCertificate />} />
            <Route path="/verify/:id" element={<VerifyCertificate />} />
            <Route path="/verify-document/:verificationCode" element={<VerifyDocument />} />

            {/* Public offer letter verification routes */}
            <Route path="/verify-offer" element={<VerifyOfferLetter />} />
            <Route path="/verify-offer/:id" element={<VerifyOfferLetter />} />

            {/* Contact page */}
            <Route path="/contact" element={<Contact />} />

            {/* Review routes */}
            <Route
              path="/reviews/submit"
              element={
                <EmployeeRoute>
                  <SubmitReview />
                </EmployeeRoute>
              }
            />
            <Route
              path="/admin/reviews"
              element={
                <AdminRoute>
                  <AdminReviewManagement />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <AdminRoute>
                  <UserManagement />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/employees"
              element={
                <AdminRoute>
                  <EmployeeManagement />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/recommendations"
              element={
                <AdminRoute>
                  <RecommendationManagement />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/manage-hr"
              element={
                <AdminRoute>
                  <ManageHR />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/audit-logs"
              element={
                <AdminRoute>
                  <AuditLogs />
                </AdminRoute>
              }
            />
            <Route
              path="/employee/profile"
              element={
                <EmployeeRoute>
                  <EmployeeProfile />
                </EmployeeRoute>
              }
            />
            {['attendance', 'leaves', 'payslips', 'documents'].map(kind => <Route key={kind} path={`/employee/${kind}`} element={<EmployeeRoute><HrmsWorkspace kind={kind} /></EmployeeRoute>} />)}
            <Route path="/employee/resignation" element={<EmployeeRoute><HrmsWorkspace kind="my-resignation" /></EmployeeRoute>} />
            {['payroll', 'attendance', 'leaves', 'documents', 'resignations', 'terminations', 'exits', 'assets'].map(kind => <Route key={kind} path={`/admin/${kind}`} element={<AdminRoute><HrmsWorkspace kind={['attendance', 'documents', 'leaves'].includes(kind) ? `admin-${kind}` : kind} /></AdminRoute>} />)}
            <Route path="/admin/payroll/:runId" element={<AdminRoute><HrmsWorkspace kind="payroll" /></AdminRoute>} />

            {/* Public offer acceptance route */}
            <Route path="/offer/accept/:jobSlug/:slug" element={<OfferAcceptance />} />

            {/* Default redirect to home */}
            <Route path="*" element={<Home />} />
          </Routes>
        </Suspense>
      </main>

      {!shouldHideFooter && <Footer />}
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </div>
  );
};

function App() {
  return (
    <Router>
      <ErrorBoundary>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ErrorBoundary>
    </Router>
  );
}

export default App;
