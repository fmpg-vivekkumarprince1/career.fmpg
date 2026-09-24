import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useParams, useNavigate } from 'react-router-dom';
import { applicationService, jobService, offerLetterService, contractService } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import ApplicationOfferForm from '../components/ApplicationOfferForm';
import { formatCurrencyValue } from '../utils/currencyUtils';
import { getResumeViewUrl } from '../utils/urlUtils';
import Loader from '../components/common/Loader';

const ApplicationDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, isAdmin, isHR } = useAuth();
  const [application, setApplication] = useState(null);
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusUpdateLoading, setStatusUpdateLoading] = useState(false);
  const [offerDetails, setOfferDetails] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [jobDetailsExpanded, setJobDetailsExpanded] = useState(true);
  const [offerLetter, setOfferLetter] = useState(null);
  const [offerLetterLoading, setOfferLetterLoading] = useState(false);
  const [contract, setContract] = useState(null);
  const [contractLoading, setContractLoading] = useState(false);

  // Helper function to check if a property exists and has content
  const hasContent = (prop) => {
    if (Array.isArray(prop)) {
      return prop.length > 0;
    }
    return prop && prop.trim && prop.trim() !== '';
  };

  const formatArrayData = (data) => {
    if (!data) return null;
    if (typeof data === 'string') return data;
    if (Array.isArray(data)) {
      return data.join(', ');
    }
    return String(data);
  };

  useEffect(() => {
    loadApplicationDetail();
  }, [id]);

  const loadApplicationDetail = async () => {
    try {
      setLoading(true);
      const appResponse = await applicationService.getApplicationById(id);
      const appData = appResponse.data;
      setApplication(appData);
      
      // Set job details from the jobId object in application data
      if (appData.jobId) {
        setJob(appData.jobId);
      }

      // Reuse already populated offer letter object or fetch if only ID was returned
      const targetAppId = appData._id || id;
      if (appData.offerLetterId) {
        if (typeof appData.offerLetterId === 'object' && appData.offerLetterId._id) {
          setOfferLetter(appData.offerLetterId);
        } else {
          applicationService.getApplicationOfferLetter(targetAppId)
            .then(res => setOfferLetter(res.data))
            .catch(err => {
              console.error('Error loading offer letter:', err);
              setOfferLetter(appData.offerLetterId);
            });
        }
      }
      
      // Load contract details if application has been offered or hired in parallel
      if (appData.status === 'offered' || appData.status === 'hired') {
        loadContractDetails(targetAppId);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || `Error loading application details for ID: ${id}`);
    } finally {
      setLoading(false);
    }
  };

  const loadContractDetails = async (applicationId) => {
    try {
      setContractLoading(true);
      console.log('Loading contract details for application:', applicationId);
      const response = await contractService.getContractByApplicationId(applicationId);
      console.log('Contract response:', response);
      
      if (response.data && response.data.contract) {
        setContract(response.data.contract);
        console.log('Contract loaded:', response.data.contract);
      } else {
        setContract(null);
        console.log('No contract found, offer status:', response.data?.offerLetter?.status);
      }
      
      // Always update offer letter details if available (this ensures latest status is shown)
      if (response.data && response.data.offerLetter) {
        console.log('Updating offer letter from contract response:', response.data.offerLetter);
        setOfferLetter(response.data.offerLetter);
      } else {
        // If no offer letter in contract response, try to reload it directly
        console.log('No offer letter in contract response, trying direct load...');
        try {
          const offerLetterResponse = await applicationService.getApplicationOfferLetter(applicationId);
          setOfferLetter(offerLetterResponse.data);
          console.log('Offer letter reloaded directly:', offerLetterResponse.data);
        } catch (offerErr) {
          console.log('Could not reload offer letter:', offerErr.message);
        }
      }
    } catch (err) {
      console.error('Error loading contract details:', err.response?.data || err.message);
      // If contract endpoint returned offerLetter in error response data (e.g. legacy 404 response)
      if (err.response?.data?.offerLetter) {
        setOfferLetter(err.response.data.offerLetter);
      } else {
        // If contract loading fails, still try to load offer letter directly
        console.log('Contract loading failed, trying to load offer letter directly...');
        try {
          const offerLetterResponse = await applicationService.getApplicationOfferLetter(applicationId);
          setOfferLetter(offerLetterResponse.data);
          console.log('Offer letter loaded after contract error:', offerLetterResponse.data);
        } catch (offerErr) {
          console.log('Could not load offer letter after contract error:', offerErr.message);
        }
      }
    } finally {
      setContractLoading(false);
    }
  };

  const loadOfferLetter = async (applicationId) => {
    try {
      setOfferLetterLoading(true);
      console.log('Loading offer letter for application:', applicationId);
      const response = await applicationService.getApplicationOfferLetter(applicationId);
      console.log('Offer letter response:', response.data);
      setOfferLetter(response.data);
    } catch (err) {
      console.error('Error loading offer letter:', err);
      // Don't set error state for missing offer letters
    } finally {
      setOfferLetterLoading(false);
    }
  };

  const handleViewResume = async () => {
    if (!application?._id || !application?.resumeUrl) return;

    try {
      const response = await applicationService.getResumeAccessUrl(application._id);
      const secureUrl = response?.data?.url;
      if (secureUrl) {
        window.open(secureUrl, '_blank', 'noopener,noreferrer');
        return;
      }
    } catch (resumeError) {
      console.error('Error fetching secure resume URL:', resumeError);
    }

    window.open(getResumeViewUrl(application.resumeUrl), '_blank', 'noopener,noreferrer');
  };

  // New function to manually refresh offer letter data
  const refreshOfferLetter = async () => {
    if (!application?._id) return;
    
    console.log('Manually refreshing offer letter data...');
    try {
      setOfferLetterLoading(true);
      
      // Try multiple approaches to get the latest offer letter data
      if (application.status === 'offered' || application.status === 'hired') {
        // First try to get it from contract details
        await loadContractDetails(application._id);
      }
      
      // Also try direct offer letter loading
      await loadOfferLetter(application._id);
      
      toast.success('Offer letter data refreshed successfully');
    } catch (err) {
      console.error('Error refreshing offer letter:', err);
      toast.error('Failed to refresh offer letter data');
    }
  };

  const handleBackToJobApplications = () => {
    if (job) {
      navigate(`/jobs/edit/${job.slug || job._id}`);
    } else {
      navigate('/applications');
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (!currentUser || (!isAdmin && !isHR)) return;

    if (newStatus === 'rejected') {
      setShowRejectForm(true);
      return;
    }

    try {
      setStatusUpdateLoading(true);
      await applicationService.updateApplicationStatus(id, { status: newStatus });
      // Reload application details to reflect the status change
      await loadApplicationDetail();
      toast.success(`Application status updated to ${newStatus}`);
    } catch (err) {
      toast.error(err.response?.data?.message || `Error updating application status`);
    } finally {
      setStatusUpdateLoading(false);
    }
  };

  // Helper function to check if a status change is allowed (no going backward after offered)
  const isStatusChangeAllowed = (targetStatus) => {
    const statusOrder = ['pending', 'reviewing', 'shortlisted', 'offered', 'hired'];
    const currentIndex = statusOrder.indexOf(application.status);
    const targetIndex = statusOrder.indexOf(targetStatus);
    
    // If current status is 'offered' or 'hired', only allow progression to higher statuses
    if (currentIndex >= 3) { // 'offered' or 'hired'
      return targetIndex > currentIndex || targetStatus === 'rejected';
    }
    
    // For other statuses, allow all changes except going back from offered/hired
    return true;
  };

  const handleGenerateOffer = async (offerData) => {
    setIsProcessing(true);
    try {
      const response = await applicationService.generateOfferLetter(id, offerData);
      
      // Update application status locally
      setApplication({...application, status: 'offered', offerLetterId: response.data.offerLetterId});
      
      // Reload application details to get the latest offer letter data
      await loadApplicationDetail();
      
      // Reset form and hide it
      setShowOfferForm(false);
      
      toast.success('Offer letter generated and stored successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error generating offer letter');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadOfferLetter = async () => {
    if (!offerLetter) return;
    
    try {
      const response = await offerLetterService.downloadOfferLetter(offerLetter._id);
      
      // Create blob and download
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `offer-letter-${offerLetter.candidateName.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Offer letter downloaded successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to download offer letter');
    }
  };

  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailCooldown, setEmailCooldown] = useState(0);

  const handleSendOfferLetterEmail = async () => {
    if (!offerLetter || isSendingEmail || emailCooldown > 0) return;
    
    setIsSendingEmail(true);
    try {
      await offerLetterService.sendOfferLetterEmail(offerLetter._id, {
        recipientEmail: offerLetter.email
      });
      toast.success('Offer letter emailed successfully!');
      setEmailCooldown(30);
      const timer = setInterval(() => {
        setEmailCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to email offer letter');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleRejectApplication = async () => {
    if (!rejectionReason.trim()) {
      toast.warning('Please provide a reason for rejection');
      return;
    }
    
    setIsProcessing(true);
    try {
      await applicationService.rejectApplication(id, { rejectionReason });
      
      // Update application status locally
      setApplication({...application, status: 'rejected'});
      
      // Reset form and hide it
      setRejectionReason('');
      setShowRejectForm(false);
      
      toast.success('Rejection email sent to applicant');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error rejecting application');
    } finally {
      setIsProcessing(false);
    }
  };

  const exportToCSV = () => {
    try {
      // Define CSV fields
      const csvFields = [
        { key: 'fullName', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone' },
        { key: 'skills', label: 'Skills' },
        { key: 'experience', label: 'Experience' },
        { key: 'education', label: 'Education' },
        { key: 'coverLetter', label: 'Cover Letter' },
        { key: 'status', label: 'Status' },
        { key: 'createdAt', label: 'Applied Date' },
      ];

      // Create CSV header
      let csvContent = csvFields.map(field => field.label).join(',') + '\n';
      
      // Format a single row for the current application
      const row = csvFields.map(field => {
        let value = application[field.key];
        
        // Format dates
        if (field.key === 'createdAt') {
          value = new Date(value).toLocaleDateString();
        }
        
        // Format arrays
        if (Array.isArray(value)) {
          value = value.join('; ');
        }
        
        // Escape commas and quotes
        if (value && typeof value === 'string') {
          value = value.replace(/"/g, '""');
          value = `"${value}"`;
        }
        
        return value || '';
      });
      
      csvContent += row.join(',') + '\n';
      
      // Create a download link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const jobTitle = job ? job.title.replace(/\s+/g, '_') : 'application';
      const fileName = `${application.fullName.replace(/\s+/g, '_')}_${jobTitle}.csv`;
      
      link.setAttribute('href', url);
      link.setAttribute('download', fileName);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Application data exported to CSV');
    } catch (err) {
      toast.error('Error exporting application data');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const getStatusBadgeColor = (status) => {
    switch (status.toLowerCase()) {
      case 'pending': return 'bg-yellow-500';
      case 'reviewing': return 'bg-blue-500';
      case 'shortlisted': return 'bg-indigo-600';
      case 'rejected': return 'bg-red-500';
      case 'offered': return 'bg-green-500';
      case 'hired': return 'bg-green-600';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return <Loader fullPage={true} text="Assembling candidate profile..." />;
  }

  if (!application) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-7xl">
        <div className="bg-red-900/30 border border-red-500 text-red-400 px-6 py-4 rounded-md mb-6">
          Application not found or you do not have permission to view it.
        </div>
        <button 
          className="px-5 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-md flex items-center"
          onClick={() => navigate('/applications')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Back to Applications
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-7xl min-h-screen animate-fade-in">
      <div className="flex justify-between items-center mb-8 pt-8">
        {/* <h1 className="text-3xl font-bold text-white">Application Details</h1> */}
        <button 
          className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-md transition flex items-center"
          onClick={handleBackToJobApplications}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Back to Applications
        </button>
      </div>

      {(statusUpdateLoading || isProcessing) && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-xl">
          <span className="h-5 w-5 block animate-spin rounded-full border-2 border-emerald-100 border-t-emerald-600" />
          <span className="text-sm font-semibold text-slate-700">
            {statusUpdateLoading ? "Updating status..." : "Processing..."}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          {/* Applicant Information Card */}
          <div className="bg-gray-900 border border-gray-800 pt-12 rounded-xl overflow-hidden shadow-lg">
            {/* <div className="bg-gradient-to-r from-blue-900 to-indigo-900 px-6 py-4">
              <h2 className="text-xl font-semibold text-white">Applicant Information</h2>
            </div> */}
            <div className="p-6">
              <div className="grid grid-cols-2 sm:grid-cols-2 gap-6 mb-6">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Full Name</p>
                  <p className="text-white text-lg">{application.fullName}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm mb-1">Email</p>
                  <p className="text-white text-lg">{application.email}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm mb-1">Phone</p>
                  <p className="text-white text-lg">{application.phone || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm mb-1">Application Date</p>
                  <p className="text-white text-lg">{formatDate(application.createdAt)}</p>
                </div>
              </div>
              
              <div className="mb-6">
                <p className="text-gray-400 text-sm mb-1">Status</p>
                <span className={`inline-block px-3 py-1 rounded-full ${getStatusBadgeColor(application.status)} text-white text-sm font-medium`}>
                  {application.status.charAt(0).toUpperCase() + application.status.slice(1)}
                </span>
              </div>

              {application.resumeUrl && (
                <div>
                  <p className="text-gray-400 text-sm mb-2">Resume</p>
                  <button 
                    type="button"
                    onClick={handleViewResume}
                    className="inline-flex items-center px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-md transition"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                    </svg>
                    View Resume
                  </button>
                </div>
              )}
            </div>
          </div>
          
          {/* Job Information Card */}
          {job && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-lg">
              <div 
                className="bg-gradient-to-r from-purple-900 to-indigo-900 px-6 py-4 flex justify-between items-center cursor-pointer"
                onClick={() => setJobDetailsExpanded(!jobDetailsExpanded)}
              >
                <h2 className="text-xl font-semibold text-white">Job Information</h2>
                <button 
                  className="text-white hover:bg-purple-800/30 rounded-full p-1 transition-all"
                  aria-label={jobDetailsExpanded ? "Collapse job details" : "Expand job details"}
                >
                  {jobDetailsExpanded ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 011.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              </div>
              {jobDetailsExpanded && (
                <div className="p-6">
                  <div className="mb-4">
                    <h3 className="text-lg font-medium text-white mb-2">{job.title}</h3>
                    <p className="text-gray-300 whitespace-pre-line">{job.description}</p>
                  </div>
                  
                  {job.requirements && job.requirements.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-md font-medium text-white mb-2">Requirements</h4>
                      <ul className="list-disc list-inside space-y-1 text-gray-300 pl-2">
                        {job.requirements.map((req, index) => (
                          <li key={index}>{req}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {job.questions && job.questions.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-md font-medium text-white mb-2">Job Questions</h4>
                      <ul className="list-disc list-inside space-y-2 text-gray-300 pl-2">
                        {job.questions.map((question, index) => (
                          <li key={index}>{question.text || question.question}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* Experience Card */}
          {hasContent(application.experience) && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-lg">
              <div className="bg-gradient-to-r from-gray-800 to-gray-700 px-6 py-4">
                <h2 className="text-xl font-semibold text-white">Experience</h2>
              </div>
              <div className="p-6">
                <p className="text-gray-300 whitespace-pre-line">{formatArrayData(application.experience)}</p>
              </div>
            </div>
          )}

          {/* Skills Card */}
          {hasContent(application.skills) && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-lg">
              <div className="bg-gradient-to-r from-gray-800 to-gray-700 px-6 py-4">
                <h2 className="text-xl font-semibold text-white">Skills</h2>
              </div>
              <div className="p-6">
                {Array.isArray(application.skills) ? (
                  <div className="flex flex-wrap gap-2">
                    {application.skills.map((skill, index) => (
                      <span key={index} className="inline-block px-3 py-1 rounded-full bg-gray-800 text-gray-300">
                        {skill}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-300 whitespace-pre-line">{application.skills}</p>
                )}
              </div>
            </div>
          )}

          {/* Education Card */}
          {hasContent(application.education) && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-lg">
              <div className="bg-gradient-to-r from-gray-800 to-gray-700 px-6 py-4">
                <h2 className="text-xl font-semibold text-white">Education</h2>
              </div>
              <div className="p-6">
                <p className="text-gray-300 whitespace-pre-line">{formatArrayData(application.education)}</p>
              </div>
            </div>
          )}

          {/* Cover Letter Card */}
          {application.coverLetter && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-lg">
              <div className="bg-gradient-to-r from-gray-800 to-gray-700 px-6 py-4">
                <h2 className="text-xl font-semibold text-white">Cover Letter</h2>
              </div>
              <div className="p-6">
                <p className="text-gray-300 whitespace-pre-line">{application.coverLetter}</p>
              </div>
            </div>
          )}
          
          {/* Question Answers Card */}
          {application.questionAnswers && application.questionAnswers.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-lg">
              <div className="bg-gradient-to-r from-gray-800 to-gray-700 px-6 py-4">
                <h2 className="text-xl font-semibold text-white">Application Questions</h2>
              </div>
              <div className="p-6">
                {application.questionAnswers.map((qa, index) => (
                  <div key={index} className="mb-8">
                    <h3 className="text-lg font-medium text-white mb-2">{qa.questionText || qa.question}</h3>
                    <p className="text-gray-300 whitespace-pre-line mb-3">{qa.answer}</p>
                    
                    {qa.fileUrl && (
                      <a 
                        href={qa.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-sm text-white rounded-md transition"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clipRule="evenodd" />
                        </svg>
                        View Attached File
                      </a>
                    )}
                    {index < application.questionAnswers.length - 1 && (
                      <div className="border-b border-gray-700 my-4"></div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Application Answers Card - Alternative format */}
          {application.answers && application.answers.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-lg">
              <div className="bg-gradient-to-r from-gray-800 to-gray-700 px-6 py-4">
                <h2 className="text-xl font-semibold text-white">Application Questions</h2>
              </div>
              <div className="p-6">
                {application.answers.map((answer, index) => (
                  <div key={index} className="mb-8">
                    <h3 className="text-lg font-medium text-white mb-2">{answer.question || answer.questionText}</h3>
                    <p className="text-gray-300 whitespace-pre-line mb-3">{answer.answer}</p>
                    
                    {answer.fileUrl && (
                      <a 
                        href={answer.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-sm text-white rounded-md transition"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clipRule="evenodd" />
                        </svg>
                        View Attached File
                      </a>
                    )}
                    {index < application.answers.length - 1 && (
                      <div className="border-b border-gray-700 my-4"></div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Application Responses Card - Another possible format */}
          {application.responses && application.responses.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-lg">
              <div className="bg-gradient-to-r from-gray-800 to-gray-700 px-6 py-4">
                <h2 className="text-xl font-semibold text-white">Application Questions</h2>
              </div>
              <div className="p-6">
                {application.responses.map((response, index) => (
                  <div key={index} className="mb-8">
                    <h3 className="text-lg font-medium text-white mb-2">{response.question || response.questionText}</h3>
                    
                    {response.type === 'checkbox' && Array.isArray(response.answer) ? (
                      <div className="space-y-1">
                        {response.answer.map((item, i) => (
                          <div key={i} className="flex items-center">
                            <span className="inline-block w-2 h-2 rounded-full bg-yellow-400 mr-2"></span>
                            <span className="text-gray-300">{item}</span>
                          </div>
                        ))}
                      </div>
                    ) : response.type === 'file' && response.answer ? (
                      <a 
                        href={response.answer} 
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        View Uploaded File
                      </a>
                    ) : (
                      <p className="text-gray-300 whitespace-pre-line mb-3">
                        {response.answer || <span className="text-gray-500 italic">No response</span>}
                      </p>
                    )}
                    
                    {index < application.responses.length - 1 && (
                      <div className="border-b border-gray-700 my-4"></div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Admin Actions Sidebar */}
        <div className="md:col-span-1">
          {currentUser && (isAdmin || isHR) && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-lg sticky top-24 max-h-[calc(100vh-120px)] overflow-y-auto custom-scrollbar">
              <div className="bg-gradient-to-r from-green-900 to-teal-900 px-6 py-4">
                <h2 className="text-xl font-semibold text-white">Actions</h2>
              </div>
              <div className="p-6">
                <h3 className="font-medium text-white mb-4">Update Application Status</h3>
                <div className="space-y-3">
                  <button 
                    className={`w-full py-2.5 px-4 text-left rounded-md transition flex items-center ${
                      application.status === 'reviewing' 
                        ? 'bg-blue-500 text-white' 
                        : !isStatusChangeAllowed('reviewing')
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                    onClick={() => isStatusChangeAllowed('reviewing') && handleStatusChange('reviewing')}
                    disabled={statusUpdateLoading || application.status === 'reviewing' || !isStatusChangeAllowed('reviewing')}
                    title={!isStatusChangeAllowed('reviewing') ? 'Cannot go back to previous status' : ''}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                    </svg>
                    Mark as Reviewing
                    {!isStatusChangeAllowed('reviewing') && (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-auto" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                  
                  <button 
                    className={`w-full py-2.5 px-4 text-left rounded-md transition flex items-center ${
                      application.status === 'shortlisted' 
                        ? 'bg-indigo-600 text-white' 
                        : !isStatusChangeAllowed('shortlisted')
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                    onClick={() => isStatusChangeAllowed('shortlisted') && handleStatusChange('shortlisted')}
                    disabled={statusUpdateLoading || application.status === 'shortlisted' || !isStatusChangeAllowed('shortlisted')}
                    title={!isStatusChangeAllowed('shortlisted') ? 'Cannot go back to previous status' : ''}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
                    </svg>
                    Mark as Shortlisted
                    {!isStatusChangeAllowed('shortlisted') && (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-auto" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                  
                  <button 
                    className={`w-full py-2.5 px-4 text-left rounded-md transition flex items-center ${
                      application.status === 'offered' 
                        ? 'bg-green-500 text-white' 
                        : !isStatusChangeAllowed('offered')
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                    onClick={() => isStatusChangeAllowed('offered') && handleStatusChange('offered')}
                    disabled={statusUpdateLoading || application.status === 'offered' || !isStatusChangeAllowed('offered')}
                    title={!isStatusChangeAllowed('offered') ? 'Cannot go back to previous status' : ''}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
                      <path fillRule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                    Mark as Offered
                    {!isStatusChangeAllowed('offered') && (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-auto" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                  
                  <button 
                    className={`w-full py-2.5 px-4 text-left rounded-md transition flex items-center ${application.status === 'hired' 
                      ? 'bg-green-600 text-white' 
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                    onClick={() => handleStatusChange('hired')}
                    disabled={statusUpdateLoading || application.status === 'hired'}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Mark as Hired
                  </button>
                  
                  <button 
                    className={`w-full py-2.5 px-4 text-left rounded-md transition flex items-center ${application.status === 'rejected' 
                      ? 'bg-red-500 text-white' 
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                    onClick={() => handleStatusChange('rejected')}
                    disabled={statusUpdateLoading || application.status === 'rejected'}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    Reject Application
                  </button>
                </div>
                
                {statusUpdateLoading && (
                  <div className="mt-4 flex items-center justify-center">
                    <Loader inline={true} size="sm" text="Updating status..." />
                  </div>
                )}

                {/* Offer Letter Management Section - Show if offer letter exists or if admin can generate one */}
                <div className="mt-6">
                  <h3 className="font-medium text-white mb-4">Offer Letter Management</h3>
                  
                  {/* Show existing offer letter if it exists - regardless of application status */}
                  {offerLetter ? (
                    <div className="bg-gray-900 rounded-lg p-4 border border-gray-700 mb-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-white font-medium">Offer Letter Details</h4>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            offerLetter.status === 'Accepted' ? 'bg-green-900 text-green-200' :
                            offerLetter.status === 'Rejected' ? 'bg-red-900 text-red-200' :
                            'bg-yellow-900 text-yellow-200'
                          }`}>
                            {offerLetter.status}
                          </span>
                          {offerLetter.acceptedAt && (
                            <span className="text-xs text-gray-400">
                              Accepted: {new Date(offerLetter.acceptedAt).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                  
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm mb-4">
                        <div>
                          <span className="text-gray-400">Position:</span>
                          <span className="text-white ml-2">{offerLetter.position}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Department:</span>
                          <span className="text-white ml-2">{offerLetter.department}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Salary:</span>
                          <span className="text-white ml-2">{formatCurrencyValue(offerLetter.salary)}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Start Date:</span>
                          <span className="text-white ml-2">{new Date(offerLetter.startDate).toLocaleDateString()}</span>
                        </div>
                        {offerLetter.duration && (
                          <div>
                            <span className="text-gray-400">Duration:</span>
                            <span className="text-white ml-2">{offerLetter.duration}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-400">Valid Until:</span>
                          <span className="text-white ml-2">{new Date(offerLetter.validUntil).toLocaleDateString()}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Work Type:</span>
                          <span className="text-white ml-2">{offerLetter.workType}</span>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-3">
                        <button 
                          className="px-4 py-2 bg-lime-400 hover:bg-lime-500 text-black text-sm font-medium rounded transition-colors"
                          onClick={handleDownloadOfferLetter}
                        >
                          Download PDF
                        </button>
                        <button 
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                          onClick={handleSendOfferLetterEmail}
                          disabled={isSendingEmail || emailCooldown > 0}
                        >
                          {isSendingEmail ? 'Sending...' : emailCooldown > 0 ? 'Please wait...' : 'Send Email'}
                        </button>
                        <button 
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded transition-colors"
                          onClick={() => window.open(`/certificates?tab=alloffers`, '_blank')}
                        >
                          View in Certificates
                        </button>
                        <button 
                          className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium rounded transition-colors disabled:opacity-50"
                          onClick={refreshOfferLetter}
                          disabled={offerLetterLoading}
                          title="Refresh offer letter data"
                        >
                          {offerLetterLoading ? 'Refreshing...' : 'Refresh'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Show generate offer button if no offer letter exists and user is admin
                    (isAdmin || (isHR && currentUser?.permissions?.canGenerateOfferLetter)) && (
                      <button 
                        className="w-full py-2.5 px-4 text-left rounded-md transition flex items-center bg-gray-800 text-gray-300 hover:bg-gray-700"
                        onClick={() => setShowOfferForm(true)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3H6a1 1 0 100 2h3v3a1 1 0 102 0v-3h3a1 1 0 100-2h-3V7z" clipRule="evenodd" />
                        </svg>
                        Generate Offer Letter
                      </button>
                    )
                  )}
                  
                  {/* Show offer form - only for admins */}
                  {(isAdmin || (isHR && currentUser?.permissions?.canGenerateOfferLetter)) && 
                  showOfferForm && !offerLetter && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
                      <div className="relative bg-gray-900 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-gray-700 shadow-2xl p-6">
                        <div className="flex justify-between items-center mb-6">
                          <h2 className="text-xl font-bold text-white">Generate Offer Letter</h2>
                          <button onClick={() => setShowOfferForm(false)} className="text-gray-400 hover:text-white transition-colors">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        <ApplicationOfferForm
                          application={application}
                          job={job}
                          onSubmit={handleGenerateOffer}
                          loading={isProcessing}
                          onCancel={() => setShowOfferForm(false)}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6">
                  <h3 className="font-medium text-white mb-4">Reject Application</h3>
                  <button 
                    className="w-full py-2.5 px-4 text-left rounded-md transition flex items-center bg-gray-800 text-gray-300 hover:bg-gray-700"
                    onClick={() => setShowRejectForm(true)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3H6a1 1 0 100 2h3v3a1 1 0 102 0v-3h3a1 1 0 100-2h-3V7z" clipRule="evenodd" />
                    </svg>
                    Reject Application
                  </button>
                  {showRejectForm && (
                     <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                      <div className="relative bg-gray-900 rounded-xl max-w-lg w-full border border-gray-700 shadow-2xl p-6">
                        <div className="flex justify-between items-center mb-6">
                          <h2 className="text-xl font-bold text-white">Reject Application</h2>
                          <button onClick={() => setShowRejectForm(false)} className="text-gray-400 hover:text-white transition-colors">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        <textarea 
                          className="w-full p-4 bg-gray-800 text-white border border-gray-700 rounded-lg mb-4 focus:ring-2 focus:ring-lime-brand focus:border-transparent outline-none resize-none"
                          rows="4"
                          placeholder="Enter rejection reason..."
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                        />
                        <div className="flex justify-end gap-3 mt-4">
                          <button
                            className="px-4 py-2 text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-lg transition"
                            onClick={() => setShowRejectForm(false)}
                          >
                            Cancel
                          </button>
                          <button 
                            className="px-4 py-2 flex items-center bg-red-600/90 text-white hover:bg-red-500 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={handleRejectApplication}
                            disabled={isProcessing || !rejectionReason.trim()}
                          >
                            {isProcessing ? (
                              <span className="mr-2">Processing...</span>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3H6a1 1 0 100 2h3v3a1 1 0 102 0v-3h3a1 1 0 100-2h-3V7z" clipRule="evenodd" />
                              </svg>
                            )}
                            Confirm Rejection
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Contract Details Section */}
                {(application.status === 'offered' || application.status === 'hired' || contract) && (
                  <div className="mt-6">
                    <h3 className="font-medium text-white mb-4">
                      Offer Acceptance & Contract Details
                    </h3>
                    
                    {contract ? (
                      <div className="bg-gray-800/50 rounded-lg p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-green-400 font-medium">✓ Offer Accepted</span>
                          <span className="text-xs text-gray-400">
                            {contract.workflowStatus?.submittedAt && 
                              `Submitted: ${formatDate(contract.workflowStatus.submittedAt)}`}
                          </span>
                        </div>
                        
                        {/* Privacy Notice */}
                        <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-3 text-xs">
                          <div className="flex items-center text-blue-300">
                            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                            </svg>
                            <span className="font-medium">Sensitive Information Protected</span>
                          </div>
                          <p className="text-blue-200 mt-1">
                            Account numbers and ID details are masked for security. Hover over masked fields to view complete information.
                          </p>
                        </div>
                        
                        {/* Personal Information */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h4 className="text-sm font-medium text-gray-300 mb-2">Contact Information</h4>
                            <div className="text-sm text-gray-400 space-y-1">
                              <p>Phone: {contract.phone}</p>
                              <p>Date of Birth: {contract.personalInfo?.dateOfBirth && 
                                new Date(contract.personalInfo.dateOfBirth).toLocaleDateString()}</p>
                              <p>Nationality: {contract.personalInfo?.nationality}</p>
                            </div>
                          </div>
                          
                          <div>
                            <h4 className="text-sm font-medium text-gray-300 mb-2">Address</h4>
                            <div className="text-sm text-gray-400">
                              {contract.personalInfo?.address && (
                                <p>
                                  {contract.personalInfo.address.street}, {contract.personalInfo.address.city}, 
                                  {contract.personalInfo.address.state} {contract.personalInfo.address.zipCode}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Emergency Contact */}
                        {contract.personalInfo?.emergencyContact && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-300 mb-2">Emergency Contact</h4>
                            <div className="text-sm text-gray-400">
                              <p>{contract.personalInfo.emergencyContact.name} ({contract.personalInfo.emergencyContact.relationship})</p>
                              <p>Phone: {contract.personalInfo.emergencyContact.phone}</p>
                              {contract.personalInfo.emergencyContact.email && (
                                <p>Email: {contract.personalInfo.emergencyContact.email}</p>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Banking Information */}
                        {contract.bankingInfo && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-300 mb-2">Banking Information</h4>
                            <div className="text-sm text-gray-400 grid grid-cols-1 md:grid-cols-2 gap-2">
                              <p>Account Holder: {contract.bankingInfo.accountHolderName}</p>
                              <p>Bank: {contract.bankingInfo.bankName}</p>
                              <div className="relative group flex items-center">
                                <p className="cursor-help">
                                  Account Number: ****{contract.bankingInfo.accountNumber?.slice(-4)}
                                </p>
                                <svg className="w-3 h-3 ml-1 text-gray-500 group-hover:text-blue-400 transition-colors" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                </svg>
                                <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block bg-gray-800 text-white text-xs rounded-md px-3 py-2 whitespace-nowrap z-20 border border-gray-600 shadow-lg">
                                  <div className="font-medium text-blue-300 mb-1">Full Account Number:</div>
                                  <div className="font-mono tracking-wider">{contract.bankingInfo.accountNumber}</div>
                                  <div className="absolute top-full left-4 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-800"></div>
                                </div>
                              </div>
                              <p>IFSC: {contract.bankingInfo.ifscCode}</p>
                              {contract.bankingInfo.accountType && (
                                <p>Account Type: {contract.bankingInfo.accountType}</p>
                              )}
                              {contract.bankingInfo.branch && (
                                <p>Branch: {contract.bankingInfo.branch}</p>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Identification */}
                        {contract.personalInfo?.identificationDocuments && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-300 mb-2">Identification</h4>
                            <div className="text-sm text-gray-400">
                              <div className="relative group flex items-center">
                                <p className="cursor-help">
                                  {contract.personalInfo.identificationDocuments.idType}: 
                                  ****{contract.personalInfo.identificationDocuments.idNumber?.slice(-4)}
                                </p>
                                <svg className="w-3 h-3 ml-1 text-gray-500 group-hover:text-blue-400 transition-colors" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                </svg>
                                <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block bg-gray-800 text-white text-xs rounded-md px-3 py-2 whitespace-nowrap z-20 border border-gray-600 shadow-lg">
                                  <div className="font-medium text-blue-300 mb-1">Full {contract.personalInfo.identificationDocuments.idType}:</div>
                                  <div className="font-mono tracking-wider">{contract.personalInfo.identificationDocuments.idNumber}</div>
                                  <div className="absolute top-full left-4 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-800"></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* Comments */}
                        {contract.acceptanceComments && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-300 mb-2">Candidate Comments</h4>
                            <p className="text-sm text-gray-400 bg-gray-900/50 p-3 rounded">
                              {contract.acceptanceComments}
                            </p>
                          </div>
                        )}
                        
                        {/* Contract Status Actions */}
                        <div className="flex gap-2 pt-2 border-t border-gray-700">
                          {application.status !== 'hired' && (
                            <button 
                              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-md transition"
                              onClick={() => handleStatusChange('hired')}
                              disabled={statusUpdateLoading}
                            >
                              {statusUpdateLoading ? 'Processing...' : 'Hire Candidate'}
                            </button>
                          )}
                          
                        </div>
                      </div>
                    ) : (
                      <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
                        <div className="flex items-center">
                          <svg className="w-5 h-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          <div>
                            <h3 className="text-yellow-300 font-medium">Waiting for Offer Acceptance</h3>
                            <p className="text-yellow-200 text-sm mt-1">
                              The candidate has been sent an offer letter but hasn't accepted it yet.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-6">
                  <h3 className="font-medium text-white mb-4">Export Application Data</h3>
                  <button 
                    className="w-full py-2.5 px-4 text-left rounded-md transition flex items-center bg-gray-800 text-gray-300 hover:bg-gray-700"
                    onClick={exportToCSV}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3H6a1 1 0 100 2h3v3a1 1 0 102 0v-3h3a1 1 0 100-2h-3V7z" clipRule="evenodd" />
                    </svg>
                    Export to CSV
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ApplicationDetail;