import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { recommendationService, applicationService } from '../services/api';
import { notificationService } from '../services/notificationService';
import { FaUsers, FaClock, FaCheckCircle, FaTimesCircle, FaExclamationCircle, FaPlus, FaEye, FaTrash, FaUser, FaEnvelope, FaBriefcase, FaPaperPlane } from 'react-icons/fa';
import { motion } from 'framer-motion';
import Loader from '../components/common/Loader';

const EmployeeProfile = () => {
  const { currentUser, isEmployee } = useAuth();
  const [recommendations, setRecommendations] = useState([]);
  const [availableApplications, setAvailableApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [loadingApplication, setLoadingApplication] = useState(false);
  const [showRecommendationForm, setShowRecommendationForm] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [stats, setStats] = useState({
    pendingCount: 0,
    totalCount: 0
  });
  
  const [recommendationForm, setRecommendationForm] = useState({
    applicationId: '',
    recommendationMessage: ''
  });

  useEffect(() => {
    // Check if user is authenticated and is an employee
    if (!currentUser) {
      notificationService.error('Please log in to access employee profile');
      return;
    }
    
    const isStatusEligible = currentUser.status === 'active' || currentUser.status === 'former';
    if (currentUser.role !== 'employee' || !isStatusEligible) {
      notificationService.error('Access denied. Only active or former employees can access this page.');
      return;
    }
    
    fetchData();
  }, [currentUser]);

  const fetchData = useCallback(async () => {
    try {
      const [recommendationsRes, applicationsRes] = await Promise.all([
        recommendationService.getMyRecommendations(),
        applicationService.getApplicationsForRecommendation()
      ]);
      
      console.log('Recommendations response:', recommendationsRes);
      console.log('Applications response:', applicationsRes);
      
      // Handle recommendations response
      const recommendationsData = recommendationsRes?.data?.data || recommendationsRes?.data || {};
      const recommendations = recommendationsData.recommendations || [];
      const pagination = recommendationsData.pagination || {};
      
      setRecommendations(recommendations);
      setStats({
        pendingCount: pagination.pendingCount || 0,
        totalCount: pagination.totalCount || 0
      });
      
      // Handle applications response
      const applicationsData = applicationsRes?.data?.data || applicationsRes?.data || {};
      const applications = Array.isArray(applicationsData) ? applicationsData : [];
      
      setAvailableApplications(applications);
    } catch (error) {
      console.error('Error fetching data:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to load data';
      notificationService.error(errorMessage);
      
      // Set default values on error
      setRecommendations([]);
      setAvailableApplications([]);
      setStats({ pendingCount: 0, totalCount: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setRecommendationForm(prev => ({ ...prev, [name]: value }));
    
    // If application ID is being changed, fetch application details
    if (name === 'applicationId' && value.trim()) {
      fetchApplicationDetails(value.trim());
    } else if (name === 'applicationId' && !value.trim()) {
      setSelectedApplication(null);
    }
  }, []);

  const fetchApplicationDetails = useCallback(async (applicationId) => {
    if (!applicationId.trim()) {
      setSelectedApplication(null);
      return;
    }

    setLoadingApplication(true);
    try {
      const response = await applicationService.getApplicationsForRecommendation();
      console.log('Available applications response:', response);
      
      // Extract the data array from the response
      const applicationsData = response?.data?.data || response?.data || [];
      console.log('Applications data:', applicationsData);
      
      // Search for the application by ID (try both _id and a potential applicationId field)
      const application = applicationsData.find(app => 
        app._id === applicationId.toString() || 
        app._id.toString() === applicationId.toString() ||
        app.applicationId === applicationId.toString()
      );
      
      console.log('Found application:', application);
      
      if (application) {
        setSelectedApplication(application);
      } else {
        setSelectedApplication(null);
        notificationService.error(`Application ID "${applicationId}" not found or not available for recommendation`);
      }
    } catch (error) {
      console.error('Error fetching application details:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to load application details';
      notificationService.error(errorMessage);
      setSelectedApplication(null);
    } finally {
      setLoadingApplication(false);
    }
  }, [availableApplications]);

  const handleSubmitRecommendation = useCallback(async (e) => {
    e.preventDefault();
    
    // Validate form data
    if (!recommendationForm.applicationId.trim() || !recommendationForm.recommendationMessage.trim()) {
      notificationService.error('Please provide application ID and recommendation message');
      return;
    }
    
    if (!selectedApplication) {
      notificationService.error('Please enter a valid application ID first');
      return;
    }
    
    if (stats.pendingCount >= 5) {
      notificationService.maxRecommendationsReached();
      return;
    }

    setFormLoading(true);
    try {
      const submissionData = {
        recommendedUserEmail: selectedApplication.email,
        recommendedUserName: selectedApplication.fullName,
        jobId: selectedApplication.jobId._id,
        recommendationMessage: recommendationForm.recommendationMessage
      };
      
      console.log('Submitting recommendation:', submissionData);
      const response = await recommendationService.createRecommendation(submissionData);
      console.log('Recommendation created:', response);
      
      notificationService.recommendationSubmitted();
      setShowRecommendationForm(false);
      setRecommendationForm({
        applicationId: '',
        recommendationMessage: ''
      });
      setSelectedApplication(null);
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Error creating recommendation:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to submit recommendation';
      notificationService.error(errorMessage);
    } finally {
      setFormLoading(false);
    }
  }, [recommendationForm, selectedApplication, stats.pendingCount, fetchData]);

  const handleDeleteRecommendation = useCallback(async (id) => {
    if (!window.confirm('Are you sure you want to delete this recommendation?')) {
      return;
    }

    try {
      
      await recommendationService.deleteRecommendation(id);
      notificationService.success('Recommendation deleted successfully');
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Error deleting recommendation:', error);
      notificationService.error('Failed to delete recommendation');
    }
  }, [fetchData]);

  const getStatusBadge = useCallback((status) => {
    const statusConfig = {
      pending: {
        bg: 'bg-yellow-900/30',
        text: 'text-yellow-400',
        border: 'border-yellow-500/50',
        icon: FaClock
      },
      reviewed: {
        bg: 'bg-blue-900/30',
        text: 'text-blue-400',
        border: 'border-blue-500/50',
        icon: FaEye
      },
      selected: {
        bg: 'bg-green-900/30',
        text: 'text-green-400',
        border: 'border-green-500/50',
        icon: FaCheckCircle
      },
      rejected: {
        bg: 'bg-red-900/30',
        text: 'text-red-400',
        border: 'border-red-500/50',
        icon: FaTimesCircle
      }
    };
    
    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;
    
    return (
      <span className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full border ${config.bg} ${config.text} ${config.border}`}>
        <Icon className="w-3 h-3 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  }, []);

  // Memoized computed values to avoid recalculation
  const canMakeRecommendation = useMemo(() => {
    return stats.pendingCount < 5;
  }, [stats.pendingCount]);

  const sortedRecommendations = useMemo(() => {
    return [...recommendations].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [recommendations]);

  if (!currentUser) {
    return null;
  }

  // Check if user has proper permissions (Must have 'employee' role)
  if (currentUser.role !== 'employee') {
    return (
      <div className="ui-page">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className=" rounded-lg shadow-xl p-8 text-center border border-gray-700"
          >
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-red-900/20 rounded-full">
                <FaTimesCircle className="w-16 h-16 text-red-500" />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">Access Denied</h2>
            <p className="text-gray-300 text-lg">Only current employees can access this page.</p>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="ui-page">
      {(loading || formLoading || loadingApplication) && (
        <Loader 
          fullPage={true} 
          text={
            loading ? "Loading profile..." : 
            formLoading ? "Submitting recommendation..." : 
            "Fetching application details..."
          } 
        />
      )}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header with Action Button */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-row items-start justify-between mb-6 sm:mb-8 gap-3 sm:gap-6"
        >
          <div className="text-left flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-1 leading-tight">Employee Profile</h1>
            <p className="text-gray-300 text-xs sm:text-sm md:text-base lg:text-lg truncate">
              Welcome, {currentUser?.name} ({currentUser?.employeeId})
            </p>
          </div>
          
          <div className="flex justify-end flex-shrink-0">
            <motion.button
              onClick={() => setShowRecommendationForm(true)}
              disabled={stats.pendingCount >= 5}
              whileHover={stats.pendingCount < 5 ? { scale: 1.02 } : {}}
              whileTap={stats.pendingCount < 5 ? { scale: 0.98 } : {}}
              className={`inline-flex items-center px-3 sm:px-4 md:px-6 lg:px-8 py-2 sm:py-3 md:py-4 rounded-lg font-semibold transition-all duration-200 shadow-lg text-xs sm:text-sm md:text-base whitespace-nowrap ${
                stats.pendingCount >= 5
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900'
              }`}
            >
              <FaPlus className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 mr-1 sm:mr-2 md:mr-3" />
              <span className="hidden md:inline">
                {stats.pendingCount >= 5 
                  ? 'Maximum Recommendations Reached (5/5)'
                  : 'Make New Recommendation'
                }
              </span>
              <span className="hidden sm:inline md:hidden">
                {stats.pendingCount >= 5 
                  ? 'Max Reached'
                  : 'New Rec'
                }
              </span>
              <span className="sm:hidden">
                {stats.pendingCount >= 5 
                  ? 'Max'
                  : 'Add'
                }
              </span>
            </motion.button>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
        >
          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-gray-900 rounded-lg p-6 border border-gray-700 shadow-xl"
          >
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                  <FaClock className="w-6 h-6 text-yellow-400" />
                </div>
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-gray-400 mb-1">Pending Recommendations</p>
                <p className="text-2xl font-bold text-white">
                  {stats.pendingCount}
                </p>
                <p className="text-sm text-gray-500">of 5 allowed</p>
              </div>
            </div>
          </motion.div>

          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-gray-900 rounded-lg p-6 border border-gray-700 shadow-xl"
          >
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <FaUsers className="w-6 h-6 text-blue-400" />
                </div>
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-gray-400 mb-1">Total Recommendations</p>
                <p className="text-2xl font-bold text-white">{stats.totalCount}</p>
                <p className="text-sm text-gray-500">all time</p>
              </div>
            </div>
          </motion.div>

          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-gray-900 rounded-lg p-6 border border-gray-700 shadow-xl"
          >
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <FaCheckCircle className="w-6 h-6 text-green-400" />
                </div>
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-gray-400 mb-1">Selected Recommendations</p>
                <p className="text-2xl font-bold text-white">
                  {recommendations.filter(r => r.status === 'selected').length}
                </p>
                <p className="text-sm text-gray-500">success rate</p>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Recommendation Form Modal */}
        {showRecommendationForm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gray-900 rounded-lg p-8 max-w-2xl w-full mx-4 border border-gray-700 shadow-xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white">Make a Job Recommendation</h3>
                <button
                  onClick={() => setShowRecommendationForm(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <FaTimesCircle className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleSubmitRecommendation} className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-300">
                      <FaEnvelope className="inline w-4 h-4 mr-2" />
                      Application ID
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (availableApplications.length > 0) {
                          const ids = availableApplications.map(app => `${app._id} (${app.fullName})`).join('\n');
                          alert(`Available Application IDs:\n\n${ids}`);
                        } else {
                          alert('No applications available for recommendation at the moment.');
                        }
                      }}
                      className="inline-flex items-center text-xs text-blue-400 hover:text-blue-300 transition-colors px-2 py-1 rounded bg-blue-900/20 hover:bg-blue-900/30"
                    >
                      <FaEye className="w-3 h-3 mr-1" />
                      Show Available IDs
                    </button>
                  </div>
                  <input
                    type="text"
                    name="applicationId"
                    value={recommendationForm.applicationId}
                    onChange={handleInputChange}
                    placeholder="Enter or paste the application ID"
                    required
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  />
                  <p className="text-xs text-gray-400 mt-2">
                    Paste the application ID to automatically load candidate details
                  </p>
                  {availableApplications.length === 0 && (
                    <div className="flex items-center mt-2 p-2 bg-orange-900/20 border border-orange-500/30 rounded-lg">
                      <FaExclamationCircle className="w-4 h-4 text-orange-400 mr-2 flex-shrink-0" />
                      <p className="text-xs text-orange-400">
                        No applications currently available for recommendation
                      </p>
                    </div>
                  )}
                </div>
                {/* Application Preview */}
                {selectedApplication && !loadingApplication && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gray-800 rounded-lg p-6 border border-gray-600 shadow-lg"
                  >
                    <div className="flex items-center mb-4">
                      <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center mr-3">
                        <FaCheckCircle className="w-4 h-4 text-green-400" />
                      </div>
                      <h4 className="font-semibold text-white text-lg">Application Details</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-gray-400">Candidate Name</p>
                        <p className="text-white font-semibold">{selectedApplication.fullName}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-gray-400">Email</p>
                        <p className="text-white">{selectedApplication.email}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-gray-400">Position</p>
                        <p className="text-white font-semibold">{selectedApplication.jobId?.title}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-gray-400">Department</p>
                        <p className="text-white">{selectedApplication.jobId?.department}</p>
                      </div>
                      <div className="md:col-span-2 space-y-1">
                        <p className="text-sm font-medium text-gray-400">Applied Date</p>
                        <p className="text-white">{new Date(selectedApplication.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Recommendation Message */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    <FaBriefcase className="inline w-4 h-4 mr-2" />
                    Your Recommendation
                  </label>
                  <textarea
                    name="recommendationMessage"
                    value={recommendationForm.recommendationMessage}
                    onChange={handleInputChange}
                    rows={4}
                    maxLength={500}
                    required
                    disabled={!selectedApplication}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder={selectedApplication ? "Why do you recommend this candidate? What makes them a good fit for this position?" : "Enter an application ID first to continue"}
                  />
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-xs text-gray-400">
                      Explain why you recommend this candidate for the position
                    </p>
                    <p className="text-xs text-gray-400">
                      {recommendationForm.recommendationMessage.length}/500
                    </p>
                  </div>
                </div>

                <div className="flex space-x-4 pt-6">
                  <motion.button
                    type="submit"
                    disabled={formLoading || !selectedApplication || !recommendationForm.recommendationMessage.trim()}
                    whileHover={!formLoading && selectedApplication && recommendationForm.recommendationMessage.trim() ? { scale: 1.02 } : {}}
                    whileTap={!formLoading && selectedApplication && recommendationForm.recommendationMessage.trim() ? { scale: 0.98 } : {}}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-6 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
                  >
                    {formLoading ? (
                      <span>Submitting...</span>
                    ) : (
                      <>
                        <FaPaperPlane className="w-4 h-4 mr-2 inline" />
                        Submit Recommendation
                      </>
                    )}
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={() => {
                      setShowRecommendationForm(false);
                      setRecommendationForm({
                        applicationId: '',
                        recommendationMessage: ''
                      });
                      setSelectedApplication(null);
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 bg-gray-700 text-white py-3 px-6 rounded-lg font-semibold hover:bg-gray-600 transition-all duration-200 shadow-lg border border-gray-600"
                  >
                    Cancel
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {/* Recommendations List */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gray-900 rounded-lg border border-gray-700 shadow-xl"
        >
          <div className="px-6 py-5 border-b border-gray-700 bg-gray-800/50 rounded-t-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0 mr-3">
                <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <FaUsers className="w-4 h-4 text-blue-400" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-white">My Recommendations</h2>
            </div>
          </div>
          
          <div className="divide-y divide-gray-700">
            {recommendations.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="px-6 py-12 text-center"
              >
                <div className="flex justify-center mb-4">
                  <div className="p-4 bg-gray-800 rounded-full">
                    <FaUsers className="w-12 h-12 text-gray-500" />
                  </div>
                </div>
                <p className="text-gray-400 text-lg font-medium mb-2">No recommendations yet</p>
                <p className="text-sm text-gray-500">
                  Start by recommending qualified candidates for open positions.
                </p>
              </motion.div>
            ) : (
              recommendations.map((recommendation, index) => (
                <motion.div 
                  key={recommendation._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index }}
                  className="px-6 py-6 hover:bg-gray-800/30 transition-colors duration-200"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                            <FaUser className="w-4 h-4 text-blue-400" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-white text-lg">
                            {recommendation.recommendedUserName}
                          </h3>
                          <div className="mt-1">
                            {getStatusBadge(recommendation.status)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="ml-13 space-y-2">
                        <div className="flex items-center text-sm text-gray-400">
                          <FaEnvelope className="w-4 h-4 mr-2 text-gray-500" />
                          {recommendation.recommendedUserEmail}
                        </div>
                        
                        {recommendation.jobId && (
                          <div className="flex items-center text-sm text-gray-400">
                            <FaBriefcase className="w-4 h-4 mr-2 text-gray-500" />
                            {recommendation.jobId.title} - {recommendation.jobId.department}
                          </div>
                        )}
                        
                        {recommendation.recommendationMessage && (
                          <div className="mt-3 p-4 bg-gray-800 rounded-lg border border-gray-600">
                            <p className="text-sm text-gray-300 italic leading-relaxed">
                              "{recommendation.recommendationMessage}"
                            </p>
                          </div>
                        )}
                        
                        <div className="flex items-center space-x-6 text-xs text-gray-500 mt-3 pt-3 border-t border-gray-700">
                          <div className="flex items-center">
                            <FaClock className="w-3 h-3 mr-1" />
                            Created: {new Date(recommendation.createdAt).toLocaleDateString()}
                          </div>
                          {recommendation.reviewedAt && (
                            <div className="flex items-center">
                              <FaCheckCircle className="w-3 h-3 mr-1" />
                              Reviewed: {new Date(recommendation.reviewedAt).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="ml-4 flex-shrink-0">
                      {recommendation.status === 'pending' && (
                        <motion.button
                          onClick={() => handleDeleteRecommendation(recommendation._id)}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="flex items-center text-red-400 hover:text-red-300 text-sm font-medium px-3 py-2 rounded-lg bg-red-900/20 hover:bg-red-900/30 border border-red-800/30 hover:border-red-700/50 transition-all duration-200"
                        >
                          <FaTrash className="w-3 h-3 mr-2" />
                          Delete
                        </motion.button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default EmployeeProfile;