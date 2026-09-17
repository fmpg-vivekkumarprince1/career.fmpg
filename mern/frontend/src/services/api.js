import axios from 'axios';
import { isTokenExpired } from '../utils/tokenUtils';

const API_URL = (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://127.0.0.1:4001' : '')).replace(/\/+$/, '');
const buildApiUrl = (endpoint) => `${API_URL}${endpoint}`;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 60000 // 60 second timeout to accommodate PDF generation, email dispatch, and serverless cold starts
});

// Create a separate instance for file uploads with longer timeout
const apiFileUpload = axios.create({
  baseURL: API_URL,
  headers: {},
  timeout: 300000 // Increased to 5 minutes timeout for file uploads
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add interceptors to the file upload instance as well
apiFileUpload.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor to handle common errors
api.interceptors.response.use(
  (response) => {
    console.log('API Response:', response.config.url, response.status, response.data);
    return response;
  },
  (error) => {
    // Gracefully handle request timeouts
    if (error.code === 'ECONNABORTED' || (error.message && error.message.toLowerCase().includes('timeout'))) {
      console.warn('API Timeout Warning:', error.config?.url, error.message);
      const timeoutError = new Error('The request timed out. The server is taking longer than usual to complete the operation. Please try again.');
      timeoutError.code = 'ETIMEDOUT';
      timeoutError.isTimeout = true;
      timeoutError.config = error.config;
      timeoutError.response = {
        status: 408,
        data: {
          message: 'The request timed out on the server. If an email was being dispatched, it may still be processing in the background.'
        }
      };
      return Promise.reject(timeoutError);
    }

    console.error('API Error:', error.config?.url, error.response?.status, error.response?.data);
    
    // Handle session expiry or unauthorized access
    if (error.response && error.response.status === 401) {
      // Only redirect on 401 (Unauthorized), not 403 (Forbidden)
      // 403 can be a legitimate response for resources that don't exist or aren't accessible
      
      // Clear stored authentication data
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Dispatch custom event to notify AuthContext about token expiry
      window.dispatchEvent(new CustomEvent('tokenExpired'));
      
      // Only redirect if not already on login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login?message=Session expired. Please login again.';
      }
    }
    return Promise.reject(error);
  }
);

// Add response interceptor to the file upload instance
apiFileUpload.interceptors.response.use(
  (response) => {
    console.log('File Upload API Response:', response.config.url, response.status, response.data);
    return response;
  },
  (error) => {
    console.error('File Upload API Error:', error.config?.url, error.response?.status, error.response?.data);
    
    // Handle session expiry or unauthorized access
    if (error.response && error.response.status === 401) {
      // Only redirect on 401 (Unauthorized), not 403 (Forbidden)
      
      // Clear stored authentication data
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Dispatch custom event to notify AuthContext about token expiry
      window.dispatchEvent(new CustomEvent('tokenExpired'));
      
      // Only redirect if not already on login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login?message=Session expired. Please login again.';
      }
    }
    return Promise.reject(error);
  }
);

// Contact service
export const contactService = {
  submitContactForm: (formData) => api.post('/api/contact', formData)
};

// Auth services
export const authService = {
  login: (credentials) => api.post('/api/auth/login', credentials),
  register: (userData) => api.post('/api/auth/register', userData),
  verifyEmail: (data) => api.post('/api/auth/verify-email', data),
  resendVerificationOTP: (data) => api.post('/api/auth/resend-verification', data),
  forgotPassword: (data) => api.post('/api/auth/forgot-password', data),
  resetPassword: (data) => api.post('/api/auth/reset-password', data),
  getMe: () => api.get('/api/auth/me'),
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },
  getCurrentUser: () => {
    try {
      const user = localStorage.getItem('user');
      return user ? JSON.parse(user) : null;
    } catch (error) {
      console.error('API: Error parsing user from localStorage:', error);
      localStorage.removeItem('user'); // Clear potentially corrupted data
      return null;
    }
  },
  isTokenExpired: () => {
    const token = localStorage.getItem('token');
    return isTokenExpired(token);
  },
  clearAuthData: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.dispatchEvent(new CustomEvent('tokenExpired'));
  }
};

// Job services
export const jobService = {
  getAllJobs: () => api.get('/api/jobs'),
  getJobById: (id) => api.get(`/api/jobs/${id}`),
  createJob: (jobData, onUploadProgress = null) => {
    // Check if jobData contains an image file
    if (jobData.image && jobData.image instanceof File) {
      const formData = new FormData();
      
      // Append image file
      formData.append('image', jobData.image);
      
      // Append all other job data fields
      Object.keys(jobData).forEach(key => {
        if (key !== 'image' && key !== 'questions' && key !== 'hrContact') {
          formData.append(key, jobData[key]);
        }
      });
      
      // Handle questions array specifically (convert to JSON string)
      if (jobData.questions && Array.isArray(jobData.questions)) {
        formData.append('questions', JSON.stringify(jobData.questions));
      }

      // Handle hrContact object specifically (convert to JSON string)
      if (jobData.hrContact) {
        formData.append('hrContact', JSON.stringify(jobData.hrContact));
      }
      
      return apiFileUpload.post('/api/jobs', formData, {
        onUploadProgress: onUploadProgress
      });
    }
    
    // If no image, proceed with regular JSON request
    return api.post('/api/jobs', jobData);
  },
  updateJob: (id, jobData, onUploadProgress = null) => {
    // Check if jobData contains an image file
    if (jobData.image && jobData.image instanceof File) {
      const formData = new FormData();
      
      // Append image file
      formData.append('image', jobData.image);
      
      // Append all other job data fields
      Object.keys(jobData).forEach(key => {
        if (key !== 'image' && key !== 'questions' && key !== 'hrContact') {
          formData.append(key, jobData[key]);
        }
      });
      
      // Handle questions array specifically (convert to JSON string)
      if (jobData.questions && Array.isArray(jobData.questions)) {
        formData.append('questions', JSON.stringify(jobData.questions));
      }

      // Handle hrContact object specifically (convert to JSON string)
      if (jobData.hrContact) {
        formData.append('hrContact', JSON.stringify(jobData.hrContact));
      }
      
      // Use the file upload instance with progress tracking
      return apiFileUpload.put(`/api/jobs/${id}`, formData, {
        onUploadProgress: onUploadProgress
      });
    }
    
    // If no image, proceed with regular JSON request
    return api.put(`/api/jobs/${id}`, jobData);
  },
  deleteJob: (id) => api.delete(`/api/jobs/${id}`),

  
  // New question-related endpoints
  getJobQuestions: (jobId) => api.get(`/api/jobs/${jobId}/questions`),
  addJobQuestion: (jobId, questionData) => api.post(`/api/jobs/${jobId}/questions`, questionData),
  updateJobQuestion: (jobId, questionId, questionData) => api.put(`/api/jobs/${jobId}/questions/${questionId}`, questionData),
  deleteJobQuestion: (jobId, questionId) => api.delete(`/api/jobs/${jobId}/questions/${questionId}`),
  reorderJobQuestions: (jobId, questionOrder) => api.put(`/api/jobs/${jobId}/questions-reorder`, { questionOrder }),
  
  // Get applications for a specific job - using correct route
  getJobApplications: (jobId) => api.get(`/api/applications/job/${jobId}`),
};

// Application services
export const applicationService = {
  getDashboardStats: (dateRange = 'all') => api.get(`/api/applications/dashboard/stats?dateRange=${dateRange}`),
  getAllApplications: () => api.get('/api/applications'),
  getMyApplications: () => api.get('/api/applications/my'),
  getApplicationsForRecommendation: () => api.get('/api/applications/for-recommendation'),
  getApplicationById: (id) => api.get(`/api/applications/${id}/detail`),
  getResumeAccessUrl: (id) => api.get(`/api/applications/${id}/resume-access`),
  checkApplicationStatus: (jobId) => api.get(`/api/applications/check-status/${jobId}`),
  checkMultipleApplicationStatuses: (jobIds = []) => {
    const ids = Array.isArray(jobIds) ? jobIds.filter(Boolean) : [];
    if (ids.length === 0) {
      return Promise.resolve({ data: { statuses: {} } });
    }
    const query = encodeURIComponent(ids.join(','));
    return api.get(`/api/applications/check-statuses?jobIds=${query}`);
  },
  createApplication: (formData, onUploadProgress = null) => {
    return apiFileUpload.post('/api/applications', formData, {
      onUploadProgress: onUploadProgress
    });
  },
  updateApplication: (id, applicationData) => api.put(`/api/applications/${id}`, applicationData),
  deleteApplication: (id) => api.delete(`/api/applications/${id}`),
  
  // Application status management
  updateApplicationStatus: (id, statusData) => api.put(`/api/applications/${id}/status`, statusData),
  generateOfferLetter: (applicationId, offerDetails) => api.post(`/api/applications/${applicationId}/offer`, offerDetails),
  getApplicationOfferLetter: (applicationId) => api.get(`/api/applications/my/${applicationId}/offer-letter`),
  rejectApplication: (applicationId, rejectionData) => api.post(`/api/applications/${applicationId}/reject`, rejectionData),
  sendWelcomeEmail: (applicationId, welcomeData) => api.post(`/api/applications/${applicationId}/welcome`, welcomeData),
  
  parseResume: (formData) => {
    const config = {
      timeout: 180000, // Increased to 3 minutes timeout for resume parsing
    };
    return apiFileUpload.post('/api/applications/parse-resume', formData, config)
      .then(response => {
        // Process the API response data
        const responseData = response.data || {};
        
        // If the backend already provided formatted data (new optimized flow)
        if (responseData.fullName || responseData.email || responseData.resumeUrl) {
          return {
            data: {
              fullName: responseData.fullName || '',
              email: responseData.email || '',
              phone: responseData.phone || '',
              skills: responseData.skills || '',
              education: responseData.education || '',
              experience: responseData.experience || '',
              address: responseData.address || '',
              resumeUrl: responseData.resumeUrl || '',
              cloudinaryPublicId: responseData.cloudinaryPublicId || ''
            }
          };
        }

        // Fallback for older/nested structure
        // Backend returns nested structure: { data: { parsedData: {...}, extractedInfo: {...} } }
        const extractedInfo = responseData.data?.extractedInfo || {};
        const parsedData = responseData.data?.parsedData || {};
        
        // Format skills array to comma-separated string
        let skillsText = '';
        if (Array.isArray(extractedInfo.skills) && extractedInfo.skills.length > 0) {
          skillsText = extractedInfo.skills.join(', ');
        } else if (Array.isArray(parsedData.skills) && parsedData.skills.length > 0) {
          skillsText = parsedData.skills.join(', ');
        } else if (parsedData.skillsText) {
          skillsText = parsedData.skillsText;
        }
        
        // Format education array to text
        let educationText = '';
        const educationData = extractedInfo.education || parsedData.education;
        if (Array.isArray(educationData) && educationData.length > 0) {
          educationText = educationData.map(edu => {
            const parts = [];
            if (edu.degree) parts.push(edu.degree);
            if (edu.institution) parts.push(edu.institution);
            if (edu.year) parts.push(edu.year);
            if (edu.gpa) parts.push(`GPA: ${edu.gpa}`);
            return parts.join(' - ');
          }).join('\n');
        } else if (parsedData.educationText) {
          educationText = parsedData.educationText;
        }
        
        // Format experience array to text
        let experienceText = '';
        const experienceData = extractedInfo.experience || parsedData.experience;
        if (Array.isArray(experienceData) && experienceData.length > 0) {
          experienceText = experienceData.map(exp => {
            const parts = [];
            if (exp.title) parts.push(exp.title);
            if (exp.company) parts.push(`at ${exp.company}`);
            if (exp.duration) parts.push(`(${exp.duration})`);
            if (exp.description) parts.push(`\n${exp.description}`);
            return parts.join(' ');
          }).join('\n\n');
        } else if (parsedData.experienceText) {
          experienceText = parsedData.experienceText;
        }
        
        // Get personal info
        const personalInfo = extractedInfo.personalInfo || parsedData.personalInfo || {};
        
        // Return standardized data structure for form filling
        return {
          data: {
            fullName: personalInfo.name || '',
            email: personalInfo.email || '',
            phone: personalInfo.phone || parsedData.phoneNumber || '',
            skills: skillsText,
            education: educationText,
            experience: experienceText,
            address: personalInfo.location || '',
            resumeUrl: responseData.resumeUrl || '',
            cloudinaryPublicId: responseData.cloudinaryPublicId || ''
          }
        };
      })
      .catch(error => {
        console.error('Resume parsing error:', error);
        // Return empty data instead of throwing to avoid breaking the form
        return {
          data: {
            fullName: '',
            email: '',
            phone: '',
            skills: '',
            education: '',
            experience: '',
            address: ''
          },
          error: error.response?.data?.message || error.message || 'Resume parsing failed'
        };
      });
  },
  
  // New methods for question handling
  uploadQuestionFile: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/api/applications/upload-question-file', formData);
  },
  updateApplicationAnswers: (applicationId, answers) => 
    api.put(`/api/applications/${applicationId}/answers`, { questionAnswers: answers }),
};

// Certificate services
export const certificateService = {
  getAllCertificates: () => api.get('/api/certification'),
  getCertificateById: (id) => api.get(`/api/certification/${id}`),
  updateCertificate: (id, certificateData) => api.put(`/api/certification/${id}`, certificateData),
  deleteCertificate: (id) => api.delete(`/api/certification/${id}`),
  
  // Download certificate as a blob
  downloadCertificate: (id) => {
    return api.get(`/api/certification/download/${id}`, {
      responseType: 'blob',
      headers: {
        'Accept': 'application/pdf'
      }
    }).then(response => {
      return {
        data: response.data,
        status: response.status,
        headers: {
          'content-type': response.headers['content-type']
        }
      };
    });
  },
  
  // Certificate issuance routes
  issueCertificate: (certData) => api.post('/api/certification/issue', certData),
  verifyCertificate: (id) => api.get(`/api/certification/verify/${encodeURIComponent(String(id).trim())}`),
  // Send certificate via email
  sendCertificateEmail: (id, emailData) => api.post(`/api/certification/${id}/send-email`, emailData),
};

// Offer Letter services
export const offerLetterService = {
  // Get all offer letters from certificate route
  getAllOfferLetters: () => api.get('/api/certification/offer-letters'),
  getOfferLetterById: (id) => api.get(`/api/certification/offer-letters/${id}`),
  // Issue offer letter from certificate route (existing endpoint)
  issueOfferLetter: (offerData) => api.post('/api/certification/issue-offer', offerData),
  // Alternative endpoints from dedicated offer letter routes
  getAllOfferLettersAlt: () => api.get('/api/offer-letters'),
  updateOfferLetterStatus: (id, status) => api.patch(`/api/certification/offer-letters/${id}/status`, { status }),
  verifyOfferLetter: (id) => api.get(`/api/certification/verify-offer/${encodeURIComponent(String(id).trim())}`),
  extendOfferLetter: (id, extensionData) => api.patch(`/api/certification/offer-letters/${id}/extend`, extensionData),
  sendOfferLetterEmail: (id, emailData) => api.post(`/api/certification/offer-letters/${id}/send-email`, emailData, { timeout: 60000 }),
  deleteOfferLetter: (id) => api.delete(`/api/certification/offer-letters/${id}`),
  
  // Download offer letter as a blob
  downloadOfferLetter: (id) => {
    return api.get(`/api/certification/offer-letters/${id}/download`, {
      responseType: 'blob',
      headers: {
        'Accept': 'application/pdf'
      }
    }).then(response => {
      return {
        data: response.data,
        status: response.status,
        headers: {
          'content-type': response.headers['content-type']
        }
      };
    });
  },

  // Bulk offer letter methods
  bulkIssueOfferLetters: (formData) => apiFileUpload.post('/api/certification/bulk-issue-offer', formData),
  downloadOfferSampleCSV: () => {
    return api.get('/api/certification/bulk-sample-csv', {
      responseType: 'blob'
    }).then(response => response.data);
  }
};

// Contract services for offer letter acceptance and contract signing
export const contractService = {
  // Public endpoints for offer acceptance (no auth required)
  getOfferForAcceptance: (token) => {
    return api.get(`/api/contracts/offer/accept/${token}`).then(response => response.data);
  },
  
  acceptOffer: (token, data) => {
    return api.post(`/api/contracts/offer/accept/${token}`, data).then(response => response.data);
  },
  
  rejectOffer: (token, data) => {
    return api.post(`/api/contracts/offer/reject/${token}`, data).then(response => response.data);
  },
  
  submitContract: (token, contractData) => {
    return api.post(`/api/contracts/offer/${token}/contract`, contractData).then(response => response.data);
  },
  
  uploadDocument: (formData) => {
    return apiFileUpload.post('/api/contracts/upload-document', formData).then(response => response.data);
  },
  
  uploadContractDocument: (contractId, file, documentType) => {
    const formData = new FormData();
    formData.append('document', file);
    formData.append('documentType', documentType);
    
    return apiFileUpload.post(`/api/contracts/${contractId}/upload`, formData).then(response => response.data);
  },
  
  // Admin endpoints
  getAllContracts: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`/api/contracts?${queryString}`);
  },
  
  getContractById: (contractId) => api.get(`/api/contracts/${contractId}`),
  
  getContractByApplicationId: (applicationId) => api.get(`/api/contracts/application/${applicationId}`),
  
  updateContractStatus: (contractId, data) => api.put(`/api/contracts/${contractId}/status`, data),
  
  generateContractPDF: (contractId) => {
    return api.get(`/api/contracts/${contractId}/pdf`, {
      responseType: 'blob',
      headers: {
        'Accept': 'application/pdf'
      }
    }).then(response => {
      return {
        data: response.data,
        status: response.status,
        headers: {
          'content-type': response.headers['content-type']
        }
      };
    });
  }
};

// Review service
export const reviewService = {
  // Public endpoints
  getApprovedReviews: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`/api/reviews/approved?${queryString}`);
  },

  // Protected endpoints for eligible users
  checkEligibility: () => api.get('/api/reviews/eligibility'),
  getUserReview: () => api.get('/api/reviews/my-review'),
  submitReview: (reviewData) => api.post('/api/reviews/submit', reviewData),

  // Admin endpoints
  getPendingReviews: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`/api/reviews/pending?${queryString}`);
  },
  getAllReviews: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`/api/reviews/all?${queryString}`);
  },
  approveReview: (reviewId, data = {}) => api.put(`/api/reviews/${reviewId}/approve`, data),
  rejectReview: (reviewId, data) => api.put(`/api/reviews/${reviewId}/reject`, data),
  updateReview: (reviewId, data) => api.put(`/api/reviews/${reviewId}/update`, data)
};

// User Management service (Admin only)
export const userService = {
  getAllUsers: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`/api/users?${queryString}`);
  },
  getUserById: (id) => api.get(`/api/users/${id}`),
  createUser: (userData) => api.post('/api/users', userData),
  createEmployee: (employeeData) => api.post('/api/users/employee', employeeData),
  updateUserStatus: (id, userData) => api.put(`/api/users/${id}/status`, userData),
  terminateEmployee: (id, terminationData = {}) => api.put(`/api/users/${id}/terminate`, terminationData),
  updateUserRole: (id, roleData) => api.put(`/api/users/${id}/role`, roleData),
  deleteUser: (id) => api.delete(`/api/users/${id}`),
  bulkUploadEmployees: (formData) => apiFileUpload.post('/api/users/bulk-upload', formData)
};

// HRMS services. Sensitive data endpoints are permission-protected by the API.
export const hrmsService = {
  employees: (params = {}) => api.get(`/api/employees?${new URLSearchParams(params)}`),
  myProfile: () => api.get('/api/employees/me'),
  attendance: (params = {}) => api.get(`/api/attendance?${new URLSearchParams(params)}`), myAttendance: () => api.get('/api/attendance/me'),
  checkIn: () => api.post('/api/attendance/check-in'), checkOut: () => api.post('/api/attendance/check-out'),
  leaveTypes: () => api.get('/api/leaves/types'), leaveRequests: () => api.get('/api/leaves'), myLeaveRequests: () => api.get('/api/leaves/me'), applyLeave: data => api.post('/api/leaves/requests', data),
  payrollRuns: () => api.get('/api/payroll'), createPayrollRun: data => api.post('/api/payroll', data), calculatePayroll: id => api.post(`/api/payroll/${id}/calculate`),
  payslips: () => api.get('/api/payslips/me'), documents: () => api.get('/api/documents'), myDocuments: () => api.get('/api/documents/me'),
  resign: data => api.post('/api/resignations', data), myResignation: () => api.get('/api/resignations/me'), resignations: () => api.get('/api/resignations'), terminations: () => api.get('/api/terminations'),
  exits: () => api.get('/api/exits'), assets: () => api.get('/api/assets'), verifyDocument: code => api.get(`/api/verify/${code}`),
  interviews: () => api.get('/api/interviews'), scheduleInterview: data => api.post('/api/interviews', data)
};

// HR management service (Super Admin only)
export const hrService = {
  getAllHRs: () => api.get('/api/hr'),
  updateHRPermissions: (hrId, data) => api.put(`/api/hr/${hrId}/permissions`, data),
  createHR: (data) => api.post('/api/hr', data),
  getAuditLogs: () => api.get('/api/hr/audit-logs'),
  getAvailableJobs: () => api.get('/api/hr/jobs'),
  revokeHR: (hrId) => api.delete(`/api/hr/${hrId}`)
};

// Recommendation service
export const recommendationService = {
  // Employee endpoints
  createRecommendation: (recommendationData) => api.post('/api/recommendations', recommendationData),
  getMyRecommendations: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`/api/recommendations/my-recommendations?${queryString}`);
  },
  deleteRecommendation: (id) => api.delete(`/api/recommendations/${id}`),
  
  // Admin endpoints
  getAllRecommendations: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`/api/recommendations/all?${queryString}`);
  },
  updateRecommendationStatus: (id, data) => api.put(`/api/recommendations/${id}/status`, data),
  
  // Statistics
  getRecommendationStats: () => api.get('/api/recommendations/stats'),
  
  // Link existing applications (Admin utility)
  linkExistingApplications: () => api.post('/api/recommendations/link-applications')
};

// Resume parser service
export const resumeParserService = {
  parseResume: (file) => {
    const formData = new FormData();
    formData.append('resume', file);
    return apiFileUpload.post('/api/applications/parse-resume', formData);
  }
};

// Notification service
let unreadCountCache = null;
let unreadCountCachedAt = 0;
let unreadCountInFlight = null;
const UNREAD_COUNT_TTL_MS = 20000;

const invalidateUnreadCountCache = () => {
  unreadCountCache = null;
  unreadCountCachedAt = 0;
};

export const notificationService = {
  // Get user notifications with pagination
  getUserNotifications: (params = {}) => {
    const queryParams = new URLSearchParams(params).toString();
    return api.get(`/api/notifications${queryParams ? '?' + queryParams : ''}`);
  },
  
  // Get unread notification count
  getUnreadCount: (options = {}) => {
    const force = options.force === true;
    const now = Date.now();
    const isFresh = unreadCountCache && (now - unreadCountCachedAt) < UNREAD_COUNT_TTL_MS;

    if (!force && isFresh) {
      return Promise.resolve({ data: unreadCountCache });
    }

    if (!force && unreadCountInFlight) {
      return unreadCountInFlight;
    }

    unreadCountInFlight = api.get('/api/notifications/count')
      .then((response) => {
        unreadCountCache = response.data;
        unreadCountCachedAt = Date.now();
        return response;
      })
      .finally(() => {
        unreadCountInFlight = null;
      });

    return unreadCountInFlight;
  },
  
  // Mark notification as read
  markAsRead: (notificationId) => {
    invalidateUnreadCountCache();
    return api.patch(`/api/notifications/${notificationId}/read`);
  },
  
  // Mark all notifications as read
  markAllAsRead: () => {
    invalidateUnreadCountCache();
    return api.patch('/api/notifications/mark-all-read');
  },
  
  // Delete notification
  deleteNotification: (notificationId) => {
    invalidateUnreadCountCache();
    return api.delete(`/api/notifications/${notificationId}`);
  },
  
  // Admin: Get all notifications
  getAllNotifications: (params = {}) => {
    const queryParams = new URLSearchParams(params).toString();
    return api.get(`/api/notifications/admin/all${queryParams ? '?' + queryParams : ''}`);
  }
};

export const systemService = {
  checkHealth: () => {
    return api.get('/api/health').then(response => response.data);
  }
};

export default api;
