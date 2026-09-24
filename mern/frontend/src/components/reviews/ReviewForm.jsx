import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'react-toastify';
import { reviewService } from '../../services/api';
import { FaStar, FaPaperPlane, FaUser, FaCheckCircle, FaTimesCircle, FaExclamationCircle, FaClipboardList, FaEye, FaBriefcase, FaUserTie } from 'react-icons/fa';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import Loader from '../common/Loader';

const ReviewForm = () => {
  const { currentUser } = useAuth();
  const [formData, setFormData] = useState({
    rating: 0,
    title: '',
    content: '',
    department: '',
    position: '',
    workType: '',
    employmentDuration: '',
    pros: '',
    cons: '',
    advice: '',
    isAnonymous: false
  });
  const [eligibility, setEligibility] = useState(null);
  const [existingReview, setExistingReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);

  useEffect(() => {
    checkEligibility();
  }, []);

  const checkEligibility = useCallback(async () => {
    try {
      setLoading(true);
      const response = await reviewService.checkEligibility();
      setEligibility(response.data);
      
      if (response.data.hasExistingReview) {
        const reviewResponse = await reviewService.getUserReview();
        setExistingReview(reviewResponse.data.review);
      }
    } catch (error) {
      console.error('Error checking eligibility:', error);
      toast.error(error.response?.data?.message || 'Failed to check eligibility');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  }, []);

  const handleRatingClick = useCallback((rating) => {
    setFormData(prev => ({ ...prev, rating }));
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    if (formData.rating === 0) {
      toast.warning('Please select a rating');
      return;
    }

    if (!formData.title.trim() || !formData.content.trim()) {
      toast.warning('Title and content are required');
      return;
    }

    try {
      setSubmitting(true);
      await reviewService.submitReview(formData);
      
      toast.success('Review submitted successfully! It will be visible after admin approval.');

      // Check eligibility again to update the state
      setTimeout(() => {
        checkEligibility();
      }, 1000);

    } catch (error) {
      console.error('Error submitting review:', error);
      toast.error(error.response?.data?.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  }, [formData, checkEligibility]);

  const renderStars = useCallback((rating, interactive = false) => {
    return Array.from({ length: 5 }, (_, index) => {
      const starRating = index + 1;
      const isActive = interactive ? (hoverRating || formData.rating) >= starRating : rating >= starRating;
      
      return (
        <FaStar
          key={index}
          className={`w-8 h-8 cursor-pointer transition-colors ${
            isActive ? 'text-yellow-400' : 'text-gray-500 hover:text-yellow-300'
          }`}
          onClick={interactive ? () => handleRatingClick(starRating) : undefined}
          onMouseEnter={interactive ? () => setHoverRating(starRating) : undefined}
          onMouseLeave={interactive ? () => setHoverRating(0) : undefined}
        />
      );
    });
  }, [hoverRating, formData.rating, handleRatingClick]);

  const getStatusIcon = useCallback((status) => {
    switch (status) {
      case 'approved':
        return <FaCheckCircle className="w-5 h-5 text-green-500" />;
      case 'rejected':
        return <FaTimesCircle className="w-5 h-5 text-red-500" />;
      case 'pending':
        return <FaExclamationCircle className="w-5 h-5 text-yellow-500" />;
      default:
        return null;
    }
  }, []);

  if (loading) {
    return <Loader fullPage={true} text="Checking eligibility..." />;
  }

  if (!eligibility?.eligible) {
    return (
      <div className="min-h-screen bg-black py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-900 rounded-lg shadow-xl p-8 text-center border border-gray-700"
          >
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-red-900/20 rounded-full">
                <FaTimesCircle className="w-16 h-16 text-red-500" />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">Not Eligible</h2>
            <p className="text-gray-300 mb-6 text-lg">
              Only employees or offer letter recipients can submit reviews.
            </p>
            <p className="text-sm text-gray-400">
              If you believe this is an error, please contact your administrator.
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  if (existingReview) {
    return (
      <div className="min-h-screen bg-black pt-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-900 rounded-lg shadow-xl p-8 border border-gray-700"
          >
            <div className="text-center mb-8">
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-green-900/20 rounded-full">
                  <FaCheckCircle className="w-12 h-12 text-green-400" />
                </div>
              </div>
              <h2 className="text-4xl font-bold text-white mb-2">Your Review</h2>
              <p className="text-gray-300 text-lg">You have already submitted a review</p>
            </div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="border border-gray-600 rounded-lg p-8 bg-gray-800 space-y-6"
            >
              {/* Status and Rating */}
              <div className="flex items-center justify-between mb-6 pb-6 border-b border-gray-600">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(existingReview.status)}
                  <span className={`font-semibold capitalize text-lg px-3 py-1 rounded-full ${
                    existingReview.status === 'approved' ? 'bg-green-900/20 text-green-400' :
                    existingReview.status === 'rejected' ? 'bg-red-900/20 text-red-400' :
                    'bg-yellow-900/20 text-yellow-400'
                  }`}>
                    {existingReview.status}
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  {renderStars(existingReview.rating)}
                  <span className="ml-2 text-gray-400 font-medium">
                    ({existingReview.rating}/5)
                  </span>
                </div>
              </div>

              {/* Title and Content */}
              <div className="space-y-4">
                <h3 className="text-2xl font-bold text-white">
                  {existingReview.title}
                </h3>
                <p className="text-gray-300 leading-relaxed text-lg">{existingReview.content}</p>
              </div>

              {/* Job Information */}
              {(existingReview.department || existingReview.position) && (
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-white mb-3">Job Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {existingReview.position && (
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Position</label>
                        <p className="text-white font-medium">{existingReview.position}</p>
                      </div>
                    )}
                    {existingReview.department && (
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Department</label>
                        <p className="text-white font-medium">{existingReview.department}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Pros and Cons */}
              {(existingReview.pros || existingReview.cons) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {existingReview.pros && (
                    <div className="bg-green-900/20 rounded-lg p-4 border border-green-600/30">
                      <label className="block text-lg font-semibold text-green-400 mb-2">Pros</label>
                      <p className="text-gray-300 leading-relaxed">{existingReview.pros}</p>
                    </div>
                  )}
                  {existingReview.cons && (
                    <div className="bg-red-900/20 rounded-lg p-4 border border-red-600/30">
                      <label className="block text-lg font-semibold text-red-400 mb-2">Cons</label>
                      <p className="text-gray-300 leading-relaxed">{existingReview.cons}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Advice */}
              {existingReview.advice && (
                <div className="bg-blue-900/20 rounded-lg p-4 border border-blue-600/30">
                  <label className="block text-lg font-semibold text-blue-400 mb-2">Advice to Management</label>
                  <p className="text-gray-300 leading-relaxed">{existingReview.advice}</p>
                </div>
              )}

              {/* Submission Info */}
              <div className="bg-gray-700/30 rounded-lg p-4 border-t border-gray-600">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-400">
                    <strong>Submitted on:</strong> {new Date(existingReview.createdAt).toLocaleDateString()}
                  </p>
                  {existingReview.status === 'rejected' && existingReview.rejectionReason && (
                    <div className="text-sm">
                      <span className="text-red-400 font-medium">Rejection reason:</span>
                      <p className="text-red-300 mt-1">{existingReview.rejectionReason}</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pt-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-900 rounded-lg shadow-xl p-8 border border-gray-700"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-blue-900/20 rounded-full">
                <FaClipboardList className="w-12 h-12 text-blue-400" />
              </div>
            </div>
            <h2 className="text-4xl font-bold text-white mb-2">Submit Your Review</h2>
            <p className="text-gray-300 text-lg">
              Share your experience working at FMPG
            </p>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="mt-6 p-4 bg-gray-800 rounded-lg border border-gray-600"
            >
              <div className="flex items-center justify-center space-x-2">
                <FaUserTie className="w-5 h-5 text-blue-400" />
                <p className="text-sm text-blue-400">
                  <strong>Status:</strong> {eligibility.reviewerType === 'employee' ? 'Employee' : 'Offer Recipient'}
                </p>
              </div>
            </motion.div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Rating Section */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-gray-800 rounded-lg p-6 border border-gray-600"
            >
              <label className="block text-lg font-semibold text-gray-200 mb-4">
                <FaStar className="inline w-5 h-5 mr-2 text-yellow-400" />
                Overall Rating *
              </label>
              <div className="flex items-center space-x-2">
                {renderStars(formData.rating, true)}
                <span className="ml-4 text-sm text-gray-400">
                  {formData.rating > 0 && `${formData.rating} star${formData.rating !== 1 ? 's' : ''}`}
                </span>
              </div>
            </motion.div>

            {/* Title and Content Section */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-gray-800 rounded-lg p-6 border border-gray-600 space-y-6"
            >
              <div>
                <label className="block text-lg font-semibold text-gray-200 mb-3">
                  <FaEye className="inline w-5 h-5 mr-2 text-blue-400" />
                  Review Title *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="Summarize your experience in a few words"
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 transition-all duration-200"
                  maxLength={100}
                  required
                />
                <p className="mt-2 text-sm text-gray-400">{formData.title.length}/100 characters</p>
              </div>

              <div>
                <label className="block text-lg font-semibold text-gray-200 mb-3">
                  Review Content *
                </label>
                <textarea
                  name="content"
                  value={formData.content}
                  onChange={handleInputChange}
                  placeholder="Share your detailed experience working at FMPG..."
                  rows={6}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 transition-all duration-200 resize-none"
                  maxLength={1000}
                  required
                />
                <p className="mt-2 text-sm text-gray-400">{formData.content.length}/1000 characters</p>
              </div>
            </motion.div>

            {/* Job Information Section */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-gray-800 rounded-lg p-6 border border-gray-600"
            >
              <h3 className="text-lg font-semibold text-gray-200 mb-4">
                <FaBriefcase className="inline w-5 h-5 mr-2 text-green-400" />
                Job Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Position
                  </label>
                  <input
                    type="text"
                    name="position"
                    value={formData.position}
                    onChange={handleInputChange}
                    placeholder="Your job title"
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Department
                  </label>
                  <input
                    type="text"
                    name="department"
                    value={formData.department}
                    onChange={handleInputChange}
                    placeholder="Your department"
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 transition-all duration-200"
                  />
                </div>
              </div>
            </motion.div>

            {/* Work Details Section */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-gray-800 rounded-lg p-6 border border-gray-600"
            >
              <h3 className="text-lg font-semibold text-gray-200 mb-4">
                Work Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Work Type
                  </label>
                  <select
                    name="workType"
                    value={formData.workType}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  >
                    <option value="">Select work type</option>
                    <option value="Remote">Remote</option>
                    <option value="On-site">On-site</option>
                    <option value="Hybrid">Hybrid</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Employment Duration
                  </label>
                  <input
                    type="text"
                    name="employmentDuration"
                    value={formData.employmentDuration}
                    onChange={handleInputChange}
                    placeholder="e.g., 6 months, 2 years"
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 transition-all duration-200"
                  />
                </div>
              </div>
            </motion.div>

            {/* Detailed Review Section */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="bg-gray-800 rounded-lg p-6 border border-gray-600 space-y-6"
            >
              <h3 className="text-lg font-semibold text-gray-200 mb-4">
                Detailed Review
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-green-400 mb-2">
                    Pros
                  </label>
                  <textarea
                    name="pros"
                    value={formData.pros}
                    onChange={handleInputChange}
                    placeholder="What did you like about working here?"
                    rows={4}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder-gray-400 transition-all duration-200 resize-none"
                    maxLength={500}
                  />
                  <p className="mt-2 text-sm text-gray-400">{formData.pros.length}/500 characters</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-red-400 mb-2">
                    Cons
                  </label>
                  <textarea
                    name="cons"
                    value={formData.cons}
                    onChange={handleInputChange}
                    placeholder="What could be improved?"
                    rows={4}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent placeholder-gray-400 transition-all duration-200 resize-none"
                    maxLength={500}
                  />
                  <p className="mt-2 text-sm text-gray-400">{formData.cons.length}/500 characters</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-blue-400 mb-2">
                  Advice to Management
                </label>
                <textarea
                  name="advice"
                  value={formData.advice}
                  onChange={handleInputChange}
                  placeholder="Any suggestions for management?"
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 transition-all duration-200 resize-none"
                  maxLength={500}
                />
                <p className="mt-2 text-sm text-gray-400">{formData.advice.length}/500 characters</p>
              </div>
            </motion.div>

            {/* Privacy and Submission Section */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="bg-gray-800 rounded-lg p-6 border border-gray-600 space-y-6"
            >
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  name="isAnonymous"
                  checked={formData.isAnonymous}
                  onChange={handleInputChange}
                  className="h-5 w-5 text-blue-600 focus:ring-blue-500 bg-gray-700 border-gray-600 rounded transition-all duration-200"
                />
                <label className="block text-sm text-gray-300 font-medium">
                  <FaUser className="inline w-4 h-4 mr-2 text-gray-400" />
                  Post this review anonymously
                </label>
              </div>

              <div className="flex justify-end">
                <motion.button
                  type="submit"
                  disabled={submitting}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-semibold shadow-lg"
                >
                  {submitting ? (
                    <>
                      <span className="mr-3">Submitting...</span>
                      Submitting Review...
                    </>
                  ) : (
                    <>
                      <FaPaperPlane className="w-5 h-5 mr-3" />
                      Submit Review
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          </form>

          {/* Important Notice */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="mt-8 p-6 bg-gradient-to-r from-blue-900/20 to-purple-900/20 rounded-lg border border-blue-600/30"
          >
            <div className="flex items-start space-x-3">
              <FaExclamationCircle className="w-6 h-6 text-blue-400 mt-1 flex-shrink-0" />
              <div>
                <h4 className="text-lg font-semibold text-blue-400 mb-2">Important Notice</h4>
                <p className="text-sm text-gray-300 leading-relaxed">
                  Your review will be pending approval and will be visible on the public page only after admin approval. 
                  Please ensure your review is professional, constructive, and follows our community guidelines.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default ReviewForm;
