import React, { useState, useEffect } from 'react';
import { reviewService } from '../../services/api';
import { motion } from 'framer-motion';
import { 
  FaStar, 
  FaChevronLeft, 
  FaChevronRight, 
  FaFilter, 
  FaUser, 
  FaCalendarAlt, 
  FaBriefcase,
  FaCheck,
  FaTimes,
  FaExclamationTriangle,
  FaEye,
  FaEdit,
  FaCommentDots,
  FaSearch,
  FaClipboardList,
  FaTimesCircle
} from 'react-icons/fa';
import Loader from '../../components/common/Loader';

const AdminReviewManagement = () => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({});
  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    status: 'all',
    rating: 'all',
    reviewerType: 'all',
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });
  const [selectedReview, setSelectedReview] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [actionType, setActionType] = useState(null);
  const [actionData, setActionData] = useState({
    moderatorNotes: '',
    rejectionReason: ''
  });
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchReviews();
  }, [filters]);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const response = await reviewService.getAllReviews(filters);
      setReviews(response.data.reviews);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      setError('Failed to load reviews');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: key !== 'page' ? 1 : value
    }));
  };

  const openModal = (review, action) => {
    setSelectedReview(review);
    setActionType(action);
    setActionData({
      moderatorNotes: '',
      rejectionReason: ''
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedReview(null);
    setActionType(null);
    setActionData({
      moderatorNotes: '',
      rejectionReason: ''
    });
  };

  const handleAction = async () => {
    if (!selectedReview || !actionType) return;

    try {
      setActionLoading(true);
      
      if (actionType === 'approve') {
        await reviewService.approveReview(selectedReview._id, {
          moderatorNotes: actionData.moderatorNotes
        });
      } else if (actionType === 'reject') {
        if (!actionData.rejectionReason.trim()) {
          alert('Rejection reason is required');
          return;
        }
        await reviewService.rejectReview(selectedReview._id, {
          rejectionReason: actionData.rejectionReason,
          moderatorNotes: actionData.moderatorNotes
        });
      }

      // Refresh the reviews list
      await fetchReviews();
      closeModal();
      
    } catch (error) {
      console.error('Error performing action:', error);
      alert(error.response?.data?.message || 'Failed to perform action');
    } finally {
      setActionLoading(false);
    }
  };

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, index) => (
      <FaStar
        key={index}
        className={`w-4 h-4 ${
          index < rating ? 'text-yellow-400' : 'text-gray-500'
        }`}
      />
    ));
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return 'bg-green-500/20 text-green-400 border border-green-500/30';
      case 'rejected':
        return 'bg-red-500/20 text-red-400 border border-red-500/30';
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
      default:
        return 'bg-gray-700 text-gray-300 border border-gray-600';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved':
        return <FaCheck className="w-3 h-3" />;
      case 'rejected':
        return <FaTimes className="w-3 h-3" />;
      case 'pending':
        return <FaExclamationTriangle className="w-3 h-3" />;
      default:
        return null;
    }
  };

  if (loading) {
    return <Loader fullPage={true} text="Fetching community feedback..." />;
  }

  return (
    <div className="ui-page">
      <div className="ui-content">
        <header className="ui-page-header">
          <span className="fmpg-kicker">Community feedback</span>
          <div className="mt-3 flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <FaCommentDots className="h-5 w-5" />
            </span>
            <div>
              <h1 className="ui-page-title">Review management</h1>
              <p className="ui-page-subtitle">Moderate employee and candidate reviews before they appear publicly.</p>
            </div>
          </div>
        </header>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100 bg-opacity-20">
                <FaCommentDots className="h-6 w-6 text-blue-500" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Total Reviews</p>
                <p className="text-2xl font-bold text-white">{pagination.total || 0}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-yellow-100 bg-opacity-20">
                <FaExclamationTriangle className="h-6 w-6 text-yellow-500" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Pending</p>
                <p className="text-2xl font-bold text-white">
                  {reviews.filter(review => review.status === 'pending').length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100 bg-opacity-20">
                <FaCheck className="h-6 w-6 text-green-500" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Approved</p>
                <p className="text-2xl font-bold text-white">
                  {reviews.filter(review => review.status === 'approved').length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-red-100 bg-opacity-20">
                <FaTimes className="h-6 w-6 text-red-500" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Rejected</p>
                <p className="text-2xl font-bold text-white">
                  {reviews.filter(review => review.status === 'rejected').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-gray-900 rounded-lg shadow-md p-6 mb-6 border border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Status Filter */}
            <div className="relative">
              <FaFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="appearance-none pl-10 pr-10 h-[42px] w-full bg-gray-800 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer relative z-0"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 z-10">
                <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
            </div>

            {/* Rating Filter */}
            <div className="relative">
              <FaStar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
              <select
                value={filters.rating}
                onChange={(e) => handleFilterChange('rating', e.target.value)}
                className="appearance-none pl-10 pr-10 h-[42px] w-full bg-gray-800 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer relative z-0"
              >
                <option value="all">All Ratings</option>
                <option value="5">5 Stars</option>
                <option value="4">4 Stars</option>
                <option value="3">3 Stars</option>
                <option value="2">2 Stars</option>
                <option value="1">1 Star</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 z-10">
                <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
            </div>

            {/* Reviewer Type Filter */}
            <div className="relative">
              <FaUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
              <select
                value={filters.reviewerType}
                onChange={(e) => handleFilterChange('reviewerType', e.target.value)}
                className="appearance-none pl-10 pr-10 h-[42px] w-full bg-gray-800 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer relative z-0"
              >
                <option value="all">All Types</option>
                <option value="employee">Employee</option>
                <option value="offer_recipient">Offer Recipient</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 z-10">
                <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
            </div>

            {/* Sort By */}
            <div className="relative">
              <FaFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
              <select
                value={`${filters.sortBy}-${filters.sortOrder}`}
                onChange={(e) => {
                  const [sortBy, sortOrder] = e.target.value.split('-');
                  handleFilterChange('sortBy', sortBy);
                  handleFilterChange('sortOrder', sortOrder);
                }}
                className="appearance-none pl-10 pr-10 h-[42px] w-full bg-gray-800 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer relative z-0"
              >
                <option value="createdAt-desc">Newest First</option>
                <option value="createdAt-asc">Oldest First</option>
                <option value="rating-desc">Highest Rated</option>
                <option value="rating-asc">Lowest Rated</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 z-10">
                <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
        </div>
        {/* Reviews Table */}
        {error ? (
          <div className="bg-gray-900 rounded-lg shadow-md p-8 border border-gray-700">
            <div className="text-center">
              <FaExclamationTriangle className="mx-auto h-12 w-12 text-red-400 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Error</h3>
              <p className="text-gray-300 mb-4">{error}</p>
              <button
                onClick={fetchReviews}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : reviews.length === 0 ? (
          <div className="bg-gray-900 rounded-lg shadow-md p-8 border border-gray-700">
            <div className="text-center">
              <FaCommentDots className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No reviews found</h3>
              <p className="text-gray-300">Try adjusting your search criteria.</p>
            </div>
          </div>
        ) : (
          <div className="bg-gray-900 rounded-lg shadow-md overflow-hidden border border-gray-700">
            <div className="bg-gray-800 px-6 py-4 border-b border-gray-700">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-white flex items-center">
                  <FaCommentDots className="mr-2 text-blue-500" />
                  Reviews Directory
                  <span className="ml-2 text-sm bg-blue-600 text-white px-2 py-1 rounded-full">
                    {reviews.length} reviews
                  </span>
                </h2>
                <div className="text-sm text-gray-400">
                  Page {pagination.page || 1} of {pagination.totalPages || 1}
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Reviewer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Title & Rating
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Submitted
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-gray-900 divide-y divide-gray-700">
                  {reviews.map((review) => (
                    <motion.tr
                      key={review._id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-gray-800"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                              <span className="text-white font-bold text-sm">
                                {review.userName?.charAt(0)?.toUpperCase() || 'U'}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-white">
                              {review.userName}
                            </div>
                            <div className="text-sm text-gray-400">{review.userEmail}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-white">
                            {review.title}
                          </p>
                          <div className="flex items-center">
                            {renderStars(review.rating)}
                            <span className="ml-2 text-sm text-gray-400">
                              ({review.rating})
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(review.status)}`}>
                          {getStatusIcon(review.status)}
                          <span className="ml-1 capitalize">{review.status}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <FaUser className="text-purple-500 mr-2" />
                          <span className="text-sm text-white capitalize">
                            {review.reviewerType.replace('_', ' ')}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        {formatDate(review.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => openModal(review, 'view')}
                            className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/20 rounded-lg transition-all duration-200"
                            title="View Details"
                          >
                            <FaEye className="w-4 h-4" />
                          </button>
                          {review.status === 'pending' && (
                            <>
                              <button
                                onClick={() => openModal(review, 'approve')}
                                className="p-2 text-green-400 hover:text-green-300 hover:bg-green-500/20 rounded-lg transition-all duration-200"
                                title="Approve"
                              >
                                <FaCheck className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => openModal(review, 'reject')}
                                className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-all duration-200"
                                title="Reject"
                              >
                                <FaTimes className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="bg-gray-900 px-4 py-3 border-t border-gray-700 sm:px-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-300">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                  {pagination.total} results
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleFilterChange('page', Math.max(1, filters.page - 1))}
                    disabled={filters.page === 1}
                    className="p-2 border border-gray-700 rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
                  >
                    <FaChevronLeft className="w-5 h-5" />
                  </button>
                  
                  {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
                    let page;
                    if (pagination.totalPages <= 5) {
                      page = i + 1;
                    } else if (filters.page <= 3) {
                      page = i + 1;
                    } else if (filters.page >= pagination.totalPages - 2) {
                      page = pagination.totalPages - 4 + i;
                    } else {
                      page = filters.page - 2 + i;
                    }
                    
                    return (
                      <button
                        key={page}
                        onClick={() => handleFilterChange('page', page)}
                        className={`px-3 py-2 border rounded-md transition-colors ${
                          page === filters.page
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'border-gray-700 hover:bg-gray-800 text-white'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                  
                  <button
                    onClick={() => handleFilterChange('page', Math.min(pagination.totalPages, filters.page + 1))}
                    disabled={filters.page === pagination.totalPages}
                    className="p-2 border border-gray-700 rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
                  >
                    <FaChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          )}
          </div>
        )}

      {/* Modal */}
      {showModal && selectedReview && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-900 opacity-75" onClick={closeModal}></div>
            </div>

            <div className="inline-block w-full max-w-4xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-gray-900 shadow-xl rounded-lg border border-gray-700">
              {/* Modal Header */}
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-700">
                <div className="flex items-center">
                  <div className="p-2 rounded-lg bg-blue-500/20 mr-3">
                    <FaCommentDots className="h-5 w-5 text-blue-500" />
                  </div>
                  <h3 className="text-xl font-semibold text-white">
                    {actionType === 'view' && 'Review Details'}
                    {actionType === 'approve' && 'Approve Review'}
                    {actionType === 'reject' && 'Reject Review'}
                  </h3>
                </div>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-300 transition-colors"
                >
                  <FaTimesCircle className="w-6 h-6" />
                </button>
              </div>

              {/* Review Content */}
              <div className="space-y-6">
                {/* Basic Info Card */}
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <h4 className="text-lg font-medium text-white mb-4 flex items-center">
                    <FaUser className="mr-2 text-blue-500" />
                    Reviewer Information
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300">Name</label>
                      <p className="text-sm text-white font-medium">{selectedReview.userName}</p>
                      <p className="text-xs text-gray-400">{selectedReview.userEmail}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300">Rating</label>
                      <div className="flex items-center">
                        {renderStars(selectedReview.rating)}
                        <span className="ml-2 text-sm text-gray-400">
                          ({selectedReview.rating} stars)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Review Content Card */}
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <h4 className="text-lg font-medium text-white mb-4 flex items-center">
                    <FaCommentDots className="mr-2 text-blue-500" />
                    Review Content
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Title</label>
                      <p className="text-white font-medium bg-gray-700 p-3 rounded">{selectedReview.title}</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Content</label>
                      <p className="text-gray-300 whitespace-pre-wrap bg-gray-700 p-3 rounded">{selectedReview.content}</p>
                    </div>
                  </div>
                </div>

                {/* Additional Info Card */}
                {(selectedReview.position || selectedReview.department || selectedReview.workType) && (
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <h4 className="text-lg font-medium text-white mb-4 flex items-center">
                      <FaBriefcase className="mr-2 text-blue-500" />
                      Work Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {selectedReview.position && (
                        <div>
                          <label className="block text-sm font-medium text-gray-300">Position</label>
                          <p className="text-sm text-white bg-gray-700 p-2 rounded">{selectedReview.position}</p>
                        </div>
                      )}
                      {selectedReview.department && (
                        <div>
                          <label className="block text-sm font-medium text-gray-300">Department</label>
                          <p className="text-sm text-white bg-gray-700 p-2 rounded">{selectedReview.department}</p>
                        </div>
                      )}
                      {selectedReview.workType && (
                        <div>
                          <label className="block text-sm font-medium text-gray-300">Work Type</label>
                          <p className="text-sm text-white bg-gray-700 p-2 rounded">{selectedReview.workType}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Pros and Cons Card */}
                {(selectedReview.pros || selectedReview.cons) && (
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <h4 className="text-lg font-medium text-white mb-4 flex items-center">
                      <FaClipboardList className="mr-2 text-blue-500" />
                      Detailed Feedback
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedReview.pros && (
                        <div>
                          <label className="flex items-center text-sm font-medium text-green-400 mb-2">
                            <FaCheck className="mr-1" />
                            Pros
                          </label>
                          <p className="text-sm text-gray-300 whitespace-pre-wrap bg-gray-700 p-3 rounded border-l-4 border-green-500">{selectedReview.pros}</p>
                        </div>
                      )}
                      {selectedReview.cons && (
                        <div>
                          <label className="flex items-center text-sm font-medium text-red-400 mb-2">
                            <FaTimes className="mr-1" />
                            Cons
                          </label>
                          <p className="text-sm text-gray-300 whitespace-pre-wrap bg-gray-700 p-3 rounded border-l-4 border-red-500">{selectedReview.cons}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Advice Card */}
                {selectedReview.advice && (
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <h4 className="text-lg font-medium text-white mb-4 flex items-center">
                      <FaCommentDots className="mr-2 text-blue-500" />
                      Advice to Management
                    </h4>
                    <p className="text-sm text-gray-300 whitespace-pre-wrap bg-gray-700 p-3 rounded border-l-4 border-blue-500">{selectedReview.advice}</p>
                  </div>
                )}

                {/* Action Forms */}
                {(actionType === 'approve' || actionType === 'reject') && (
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <h4 className="text-lg font-medium text-white mb-4 flex items-center">
                      {actionType === 'approve' ? (
                        <>
                          <FaCheck className="mr-2 text-green-500" />
                          Approval Details
                        </>
                      ) : (
                        <>
                          <FaTimes className="mr-2 text-red-500" />
                          Rejection Details
                        </>
                      )}
                    </h4>
                    {actionType === 'reject' && (
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Rejection Reason *
                        </label>
                        <textarea
                          value={actionData.rejectionReason}
                          onChange={(e) => setActionData(prev => ({
                            ...prev,
                            rejectionReason: e.target.value
                          }))}
                          placeholder="Please provide a reason for rejection..."
                          rows={3}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                          required
                        />
                      </div>
                    )}

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Moderator Notes (Optional)
                      </label>
                      <textarea
                        value={actionData.moderatorNotes}
                        onChange={(e) => setActionData(prev => ({
                          ...prev,
                          moderatorNotes: e.target.value
                        }))}
                        placeholder="Add any internal notes..."
                        rows={2}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-700">
                <button
                  onClick={closeModal}
                  className="px-6 py-2 text-sm font-medium text-gray-300 bg-gray-800 border border-gray-600 rounded-lg hover:bg-gray-700 hover:text-white transition-all duration-200"
                >
                  Cancel
                </button>
                {actionType === 'approve' && (
                  <button
                    onClick={handleAction}
                    disabled={actionLoading}
                    className="px-6 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center"
                  >
                    <FaCheck className="mr-2" />
                    {actionLoading ? 'Approving...' : 'Approve Review'}
                  </button>
                )}
                {actionType === 'reject' && (
                  <button
                    onClick={handleAction}
                    disabled={actionLoading || !actionData.rejectionReason.trim()}
                    className="px-6 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center"
                  >
                    <FaTimes className="mr-2" />
                    {actionLoading ? 'Rejecting...' : 'Reject Review'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
};

export default AdminReviewManagement;
