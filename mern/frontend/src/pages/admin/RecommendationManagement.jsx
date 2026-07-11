import React, { useState, useEffect } from 'react';
import { recommendationService } from '../../services/api';
import { notificationService } from '../../services/notificationService';
import { motion } from 'framer-motion';
import { FaSearch, FaFilter, FaEye, FaCheck, FaTimes, FaUser, FaUsers, FaBriefcase, FaClipboardList, FaCog } from 'react-icons/fa';
import Loader from '../../components/common/Loader';

const RecommendationManagement = () => {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [filters, setFilters] = useState({
    status: '',
    search: '',
    page: 1,
    limit: 10
  });
  const [pagination, setPagination] = useState({});
  const [selectedRecommendation, setSelectedRecommendation] = useState(null);
  const [reviewForm, setReviewForm] = useState({
    status: '',
    adminNotes: ''
  });
  const [linkingApplications, setLinkingApplications] = useState(false);

  useEffect(() => {
    fetchRecommendations();
    fetchStats();
  }, [filters]);

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      const response = await recommendationService.getAllRecommendations(filters);
      setRecommendations(response.data.data.recommendations);
      setPagination(response.data.data.pagination);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      notificationService.error('Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await recommendationService.getRecommendationStats();
      setStats(response.data.data.stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value, page: 1 }));
  };

  const handleStatusUpdate = async (recommendationId, status, adminNotes = '') => {
    try {
      await recommendationService.updateRecommendationStatus(recommendationId, {
        status,
        adminNotes
      });
      
      notificationService.success(`Recommendation ${status} successfully`);
      setSelectedRecommendation(null);
      setReviewForm({ status: '', adminNotes: '' });
      fetchRecommendations();
      fetchStats();
    } catch (error) {
      console.error('Error updating recommendation:', error);
      notificationService.error('Failed to update recommendation status');
    }
  };

  const openReviewModal = (recommendation) => {
    setSelectedRecommendation(recommendation);
    setReviewForm({
      status: recommendation.status,
      adminNotes: recommendation.adminNotes || ''
    });
  };

  const handleReviewSubmit = (e) => {
    e.preventDefault();
    handleStatusUpdate(
      selectedRecommendation._id,
      reviewForm.status,
      reviewForm.adminNotes
    );
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      pending: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
      reviewed: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
      selected: 'bg-green-500/20 text-green-400 border border-green-500/30',
      rejected: 'bg-red-500/20 text-red-400 border border-red-500/30'
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status] || 'bg-gray-700 text-gray-300 border border-gray-600'}`}>
        {status?.charAt(0)?.toUpperCase() + status?.slice(1) || 'pending'}
      </span>
    );
  };

  const handleLinkApplications = async () => {
    if (!window.confirm('This will link all selected recommendations with existing applications based on email and job matching. Continue?')) {
      return;
    }

    try {
      setLinkingApplications(true);
      const response = await recommendationService.linkExistingApplications();
      notificationService.success(`Successfully linked ${response.data.data.linkedCount} recommendations with applications`);
      fetchRecommendations();
      fetchStats();
    } catch (error) {
      console.error('Error linking applications:', error);
      notificationService.error('Failed to link applications');
    } finally {
      setLinkingApplications(false);
    }
  };

  return (
    <div className="ui-page">
      <div className="ui-content">
        <header className="ui-page-header flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <span className="fmpg-kicker">Employee referrals</span>
            <div className="mt-3 flex items-start gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <FaClipboardList className="h-5 w-5" />
              </span>
              <div>
                <h1 className="ui-page-title">Recommendation management</h1>
                <p className="ui-page-subtitle">Review referrals, connect recommendations to applications, and record outcomes.</p>
              </div>
            </div>
          </div>
            <div className="flex space-x-4">
              <button
                onClick={handleLinkApplications}
                disabled={linkingApplications}
                className="fmpg-secondary-button inline-flex items-center space-x-2 px-4 py-2.5 transition-colors disabled:opacity-50"
              >
                <FaCog />
                <span>{linkingApplications ? 'Linking…' : 'Link applications'}</span>
              </button>
            </div>
        </header>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className=" rounded-lg p-6 border border-gray-700">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100 bg-opacity-20">
                <FaClipboardList className="h-6 w-6 text-blue-500" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Total Recommendations</p>
                <p className="text-2xl font-bold text-white">{stats.total || 0}</p>
              </div>
            </div>
          </div>
          
          <div className=" rounded-lg p-6 border border-gray-700">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-yellow-100 bg-opacity-20">
                <FaTimes className="h-6 w-6 text-yellow-500" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Pending Review</p>
                <p className="text-2xl font-bold text-white">{stats.pending || 0}</p>
              </div>
            </div>
          </div>
          
          <div className=" rounded-lg p-6 border border-gray-700">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100 bg-opacity-20">
                <FaCheck className="h-6 w-6 text-green-500" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Selected</p>
                <p className="text-2xl font-bold text-white">{stats.selected || 0}</p>
              </div>
            </div>
          </div>
          
          <div className=" rounded-lg p-6 border border-gray-700">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-red-100 bg-opacity-20">
                <FaTimes className="h-6 w-6 text-red-500" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Rejected</p>
                <p className="text-2xl font-bold text-white">{stats.rejected || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-gray-900 rounded-lg shadow-md p-6 mb-6 border border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                name="search"
                placeholder="Search by name, email..."
                className="pl-10 pr-4 h-[42px] w-full bg-gray-800 border border-gray-600 text-white placeholder-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={filters.search}
                onChange={handleFilterChange}
              />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <FaFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
              <select
                name="status"
                className="appearance-none pl-10 pr-10 h-[42px] w-full bg-gray-800 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer relative z-0"
                value={filters.status}
                onChange={handleFilterChange}
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="reviewed">Reviewed</option>
                <option value="selected">Selected</option>
                <option value="rejected">Rejected</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 z-10">
                <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
            </div>

            {/* Items per page */}
            <div className="relative">
              <FaFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
              <select
                name="limit"
                className="appearance-none pl-10 pr-10 h-[42px] w-full bg-gray-800 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer relative z-0"
                value={filters.limit}
                onChange={handleFilterChange}
              >
                <option value="10">10 per page</option>
                <option value="25">25 per page</option>
                <option value="50">50 per page</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 z-10">
                <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
            </div>

            {/* Clear Filters */}
            <button
              onClick={() => setFilters({ status: '', search: '', page: 1, limit: 10 })}
              className="px-4 h-[42px] bg-gray-600/50 text-white rounded-md hover:bg-gray-600 transition-colors border border-gray-600"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Recommendations Table */}
        <div className="bg-gray-900 rounded-lg shadow-md overflow-hidden border border-gray-700">
          <div className="bg-gray-800 px-6 py-4 border-b border-gray-700">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-white flex items-center">
                <FaClipboardList className="mr-2 text-blue-500" />
                Recommendations Directory
                <span className="ml-2 text-sm bg-blue-600 text-white px-2 py-1 rounded-full">
                  {recommendations.length} recommendations
                </span>
              </h2>
              <div className="text-sm text-gray-400">
                Page {pagination.currentPage || 1} of {pagination.totalPages || 1}
              </div>
            </div>
          </div>
          {loading ? (
            <Loader text="Loading recommendations..." />
          ) : recommendations.length === 0 ? (
            <div className="p-8 text-center">
              <FaClipboardList className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-white">No recommendations found</h3>
              <p className="mt-1 text-sm text-gray-400">Try adjusting your search criteria.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700">
                  <thead className="bg-gray-800">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Candidate
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Job Position
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Recommender
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Application
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-gray-900 divide-y divide-gray-700">
                    {recommendations.map((recommendation) => (
                      <motion.tr
                        key={recommendation._id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="hover:bg-gray-800"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                                <span className="text-white font-bold text-sm">
                                  {recommendation.recommendedUserName?.charAt(0)?.toUpperCase() || 'U'}
                                </span>
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-white">
                                {recommendation.recommendedUserName}
                              </div>
                              <div className="text-sm text-gray-400">
                                {recommendation.recommendedUserEmail}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {recommendation.jobId ? (
                            <div className="space-y-1">
                              <div className="flex items-center">
                                <FaBriefcase className="text-blue-500 mr-2" />
                                <span className="text-sm text-white">{recommendation.jobId.title}</span>
                              </div>
                              <div className="text-xs text-gray-400 ml-6">
                                {recommendation.jobId.department}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-500 text-sm">No job specified</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="space-y-1">
                            <div className="flex items-center">
                              <FaUser className="text-purple-500 mr-2" />
                              <span className="text-sm text-white">
                                {recommendation.recommender?.name}
                              </span>
                            </div>
                            <div className="text-xs text-gray-400 ml-6">
                              ID: {recommendation.recommenderId}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(recommendation.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {recommendation.applicationId ? (
                            <div className="space-y-1">
                              <div className="text-sm text-green-400 font-medium flex items-center">
                                <FaCheck className="mr-1" />
                                Application Linked
                              </div>
                              <div className="text-xs text-gray-400">
                                Status: {recommendation.applicationId.status}
                              </div>
                              <div className="text-xs text-gray-400">
                                Applied: {new Date(recommendation.applicationId.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-500 text-sm flex items-center">
                              <FaTimes className="mr-1" />
                              No application
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                          {new Date(recommendation.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => openReviewModal(recommendation)}
                            className="text-blue-600 hover:text-blue-900 mr-4"
                            title="Review Recommendation"
                          >
                            <FaEye />
                          </button>
                          {recommendation.applicationId && (
                            <button
                              onClick={() => window.open(`/applications/${recommendation.applicationId.slug || recommendation.applicationId._id}`, '_blank')}
                              className="text-green-600 hover:text-green-900 mr-4"
                              title="View Application"
                            >
                              <FaBriefcase />
                            </button>
                          )}
                          {recommendation.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleStatusUpdate(recommendation._id, 'selected')}
                                className="text-green-600 hover:text-green-900 mr-4"
                                title="Select Candidate"
                              >
                                <FaCheck />
                              </button>
                              <button
                                onClick={() => handleStatusUpdate(recommendation._id, 'rejected')}
                                className="text-red-600 hover:text-red-900"
                                title="Reject Recommendation"
                              >
                                <FaTimes />
                              </button>
                            </>
                          )}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="bg-gray-900 px-4 py-3 flex items-center justify-between border-t border-gray-700 sm:px-6">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => setFilters(prev => ({ ...prev, page: Math.max(prev.page - 1, 1) }))}
                      disabled={pagination.currentPage === 1}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-md text-white bg-gray-800 hover:bg-gray-700 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setFilters(prev => ({ ...prev, page: Math.min(pagination.totalPages, prev.page + 1) }))}
                      disabled={pagination.currentPage === pagination.totalPages}
                      className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-md text-white bg-gray-800 hover:bg-gray-700 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-400">
                        Showing <span className="font-medium">{((pagination.currentPage - 1) * filters.limit) + 1}</span> to{' '}
                        <span className="font-medium">
                          {Math.min(pagination.currentPage * filters.limit, pagination.totalCount)}
                        </span>{' '}
                        of <span className="font-medium">{pagination.totalCount}</span> results
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                        <button
                          onClick={() => setFilters(prev => ({ ...prev, page: Math.max(prev.page - 1, 1) }))}
                          disabled={pagination.currentPage === 1}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-600 bg-gray-800 text-sm font-medium text-gray-400 hover:bg-gray-700 disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <span className="relative inline-flex items-center px-4 py-2 border border-gray-600 bg-gray-700 text-sm font-medium text-white">
                          Page {pagination.currentPage} of {pagination.totalPages}
                        </span>
                        <button
                          onClick={() => setFilters(prev => ({ ...prev, page: Math.min(pagination.totalPages, prev.page + 1) }))}
                          disabled={pagination.currentPage === pagination.totalPages}
                          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-600 bg-gray-800 text-sm font-medium text-gray-400 hover:bg-gray-700 disabled:opacity-50"
                        >
                          Next
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Review Modal */}
        {selectedRecommendation && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-900 rounded-lg p-6 max-w-2xl w-full mx-4 border border-gray-700 max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white flex items-center">
                  <FaEye className="mr-2 text-blue-500" />
                  Review Recommendation
                </h3>
                <button
                  onClick={() => setSelectedRecommendation(null)}
                  className="text-gray-400 hover:text-white"
                >
                  <FaTimes className="h-6 w-6" />
                </button>
              </div>
              
              <div className="space-y-6 mb-6">
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <label className="text-sm font-medium text-gray-300 flex items-center mb-2">
                    <FaUser className="mr-2 text-blue-500" />
                    Candidate Information
                  </label>
                  <div className="space-y-2">
                    <p className="text-white font-medium">{selectedRecommendation.recommendedUserName}</p>
                    <p className="text-gray-400 text-sm">{selectedRecommendation.recommendedUserEmail}</p>
                  </div>
                </div>
                
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <label className="text-sm font-medium text-gray-300 flex items-center mb-2">
                    <FaBriefcase className="mr-2 text-purple-500" />
                    Job Position
                  </label>
                  <div className="space-y-2">
                    <p className="text-white font-medium">
                      {selectedRecommendation.jobId?.title || 'No job specified'}
                    </p>
                    {selectedRecommendation.jobId?.department && (
                      <p className="text-gray-400 text-sm">{selectedRecommendation.jobId.department}</p>
                    )}
                  </div>
                </div>
                
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <label className="text-sm font-medium text-gray-300 flex items-center mb-2">
                    <FaUsers className="mr-2 text-green-500" />
                    Recommender
                  </label>
                  <div className="space-y-2">
                    <p className="text-white font-medium">{selectedRecommendation.recommender?.name}</p>
                    <p className="text-gray-400 text-sm">Employee ID: {selectedRecommendation.recommenderId}</p>
                  </div>
                </div>
                
                {selectedRecommendation.applicationId && (
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <label className="text-sm font-medium text-gray-300 flex items-center mb-2">
                      <FaCheck className="mr-2 text-green-500" />
                      Linked Application
                    </label>
                    <div className="bg-green-500/10 border border-green-500/30 rounded-md p-3 mt-2">
                      <div className="text-green-400 font-medium flex items-center">
                        <FaCheck className="mr-2" />
                        Application Found
                      </div>
                      <div className="text-sm text-gray-300 mt-2 space-y-1">
                        <div>Status: <span className="text-white font-medium">{selectedRecommendation.applicationId.status}</span></div>
                        <div>Applied: <span className="text-white font-medium">{new Date(selectedRecommendation.applicationId.createdAt).toLocaleDateString()}</span></div>
                      </div>
                      <button
                        onClick={() => window.open(`/applications/${selectedRecommendation.applicationId.slug || selectedRecommendation.applicationId._id}`, '_blank')}
                        className="mt-3 text-blue-400 hover:text-blue-300 text-sm underline flex items-center"
                      >
                        <FaBriefcase className="mr-1" />
                        View Full Application →
                      </button>
                    </div>
                  </div>
                )}
                
                {selectedRecommendation.recommendationMessage && (
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <label className="text-sm font-medium text-gray-300 mb-2 block">Recommendation Message:</label>
                    <div className="text-gray-300 bg-gray-700 rounded-md p-3 border-l-4 border-blue-500 italic">
                      "{selectedRecommendation.recommendationMessage}"
                    </div>
                  </div>
                )}
              </div>
              
              <form onSubmit={handleReviewSubmit} className="space-y-4">
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Update Status</label>
                  <select
                    value={reviewForm.status}
                    onChange={(e) => setReviewForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select status</option>
                    <option value="reviewed">Mark as Reviewed</option>
                    <option value="selected">Select Candidate</option>
                    <option value="rejected">Reject Recommendation</option>
                  </select>
                </div>
                
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Admin Notes</label>
                  <textarea
                    value={reviewForm.adminNotes}
                    onChange={(e) => setReviewForm(prev => ({ ...prev, adminNotes: e.target.value }))}
                    rows={4}
                    maxLength={500}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Add any notes about this recommendation..."
                  />
                  <p className="text-xs text-gray-400 mt-2">
                    {reviewForm.adminNotes.length}/500 characters
                  </p>
                </div>
                
                <div className="flex space-x-4 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium flex items-center justify-center"
                  >
                    <FaCheck className="mr-2" />
                    Update Status
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRecommendation(null)}
                    className="flex-1 bg-gray-600 text-white py-3 px-4 rounded-md hover:bg-gray-500 transition-colors font-medium flex items-center justify-center"
                  >
                    <FaTimes className="mr-2" />
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecommendationManagement;
