import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import Loader from '../components/common/Loader';
import { applicationService, jobService, offerLetterService } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import JobUpdateBanner from '../components/notifications/JobUpdateBanner';
import { notificationService } from '../services/api';
import { formatCurrencyValue } from '../utils/currencyUtils';
import { getResumeViewUrl } from '../utils/urlUtils';


import { getCache, setCache } from '../utils/cache';

const MyApplications = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = currentUser?._id ? `my_apps:${currentUser._id}` : null;

  const [applications, setApplications] = useState(() => {
    if (!cacheKey) return [];
    try {
      const cached = getCache(cacheKey);
      return Array.isArray(cached) ? cached : [];
    } catch {
      return [];
    }
  });

  const [selectedApplication, setSelectedApplication] = useState(null);
  const [loading, setLoading] = useState(() => {
    if (!cacheKey) return true;
    try {
      const cached = getCache(cacheKey);
      return !(Array.isArray(cached) && cached.length > 0);
    } catch {
      return true;
    }
  });
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [offerLetters, setOfferLetters] = useState({});
  const [jobDetails, setJobDetails] = useState({});
  const [jobUpdateNotifications, setJobUpdateNotifications] = useState([]);

  useEffect(() => {
    if (!currentUser) {
      navigate('/login', { state: { from: '/my-applications' } });
      return;
    }

    if (location.state?.success) {
      toast.success('Application submitted successfully!');
    }

    if (location.state?.successMessage) {
      toast.success(location.state.successMessage);
      // Clear the state to prevent showing message on refresh
      window.history.replaceState({}, document.title);
    }

    loadMyApplications();
  }, [currentUser, location, navigate]);

  // Add effect to reset copied ID notification after 3 seconds
  useEffect(() => {
    if (copiedId) {
      const timer = setTimeout(() => setCopiedId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [copiedId]);

  const loadMyApplications = async () => {
    if (applications.length === 0) {
      setLoading(true);
    }

    try {
      const [applicationsResponse, notificationsResponse] = await Promise.all([
        applicationService.getMyApplications(),
        notificationService.getUserNotifications({ unreadOnly: 'true', limit: 100 })
      ]);

      setApplications(applicationsResponse.data);
      if (cacheKey) {
        setCache(cacheKey, applicationsResponse.data, 60000);
      }

      // Build a local lookup for already-populated job details without extra API calls.
      const jobDetailsObj = {};
      applicationsResponse.data.forEach((app) => {
        if (app.jobId && typeof app.jobId === 'object' && app.jobId._id) {
          jobDetailsObj[app.jobId._id] = app.jobId;
        }
      });
      setJobDetails(jobDetailsObj);

      const updates = (notificationsResponse.data?.notifications || []).filter(
        (notification) => notification.type === 'job_update'
      );
      setJobUpdateNotifications(updates);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error loading your applications');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectApplication = async (application) => {
    // If the application is already selected, deselect it
    if (selectedApplication && selectedApplication._id === application._id) {
      setSelectedApplication(null);
      return;
    }

    // Otherwise, select the application
    setSelectedApplication(application);

    // Load offer letter if application has 'offered' or 'hired' status
    if ((application.status === 'offered' || application.status === 'hired') && !offerLetters[application._id]) {
      try {
        await loadOfferLetter(application._id);
      } catch (err) {
        console.error('Error loading offer letter:', err);
      }
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusBadgeColor = (status) => {
    switch (status.toLowerCase()) {
      case 'pending': return 'bg-gradient-to-r from-yellow-500 to-amber-600';
      case 'reviewing': return 'bg-gradient-to-r from-blue-500 to-blue-600';
      case 'shortlisted': return 'bg-gradient-to-r from-indigo-500 to-violet-600';
      case 'rejected': return 'bg-gradient-to-r from-red-500 to-red-600';
      case 'offered': return 'bg-gradient-to-r from-green-500 to-emerald-600';
      case 'hired': return 'bg-gradient-to-r from-green-600 to-emerald-700';
      default: return 'bg-gradient-to-r from-gray-500 to-gray-600';
    }
  };

  // Add function to copy application ID to clipboard
  const copyApplicationId = (id, e) => {
    e.stopPropagation(); // Prevent triggering the parent onClick
    navigator.clipboard.writeText(id)
      .then(() => {
        setCopiedId(id);
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
      });
  };

  // Load offer letter for an application
  const loadOfferLetter = async (applicationId) => {
    try {
      const fetchFn = applicationService.getMyApplicationOfferLetter || applicationService.getApplicationOfferLetter;
      const response = await fetchFn(applicationId);
      setOfferLetters(prev => ({ ...prev, [applicationId]: response.data }));
      return response.data;
    } catch (err) {
      console.error('Error loading offer letter:', err);
      return null;
    }
  };

  const handleViewResume = async (application) => {
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

  // Download offer letter PDF
  const handleDownloadOfferLetter = async (application, e) => {
    e.stopPropagation();

    try {
      setDownloading(true);
      // Load offer letter if not already loaded
      let offerLetter = offerLetters[application._id];
      if (!offerLetter && application.offerLetterId) {
        offerLetter = await loadOfferLetter(application._id);
      }

      if (offerLetter) {
        const response = await offerLetterService.downloadOfferLetter(offerLetter._id);

        // Create blob and download
        const blob = response.data;
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `offer-letter-${application.fullName.replace(/\s+/g, '_')}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        toast.success('Offer letter downloaded successfully!');
      }
    } catch (err) {
      toast.error('Failed to download offer letter');
    } finally {
      setDownloading(false);
    }
  };

  // Handle accept offer button click
  const handleAcceptOffer = async (application, e) => {
    e.stopPropagation();

    try {
      // Load offer letter if not already loaded to get the acceptance token
      let offerLetter = offerLetters[application._id];
      if (!offerLetter && application.offerLetterId) {
        offerLetter = await loadOfferLetter(application._id);
      }

      if (offerLetter) {
        // Get slugs for the URL - be more robust with jobDetails fallback
        const jobId = (application.jobId && typeof application.jobId === 'object' && application.jobId._id)
          ? application.jobId._id
          : application.jobId;

        const jobSlug = (application.jobId && typeof application.jobId === 'object' && application.jobId.slug)
          ? application.jobId.slug
          : (jobDetails[jobId]?.slug || 'job');

        const appSlug = application.slug || application._id;

        console.log(`Navigating to acceptance for job: ${jobSlug}, app: ${appSlug}`);
        // Navigate to the offer acceptance page with the job slug and application slug
        navigate(`/offer/accept/${jobSlug}/${appSlug}`);
      } else {
        toast.error('Unable to find offer letter details or acceptance link. Please contact HR.');
      }
    } catch (err) {
      console.error('Error handling offer acceptance:', err);
      toast.error('Error accessing offer acceptance. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="ui-page flex flex-col items-center justify-center">
        <Loader fullPage={true} text="Loading your applications..." />
      </div>
    );
  }

  return (
    <>
      <div className="ui-page">
        <div className="max-w-7xl mx-auto">
          {/* <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-yellow to-amber-400 mb-12 text-center">My Applications</h1> */}



          <div className="w-full">
            <div className="ui-page-header">
              <span className="fmpg-kicker">Candidate portal</span>
              <h1 className="ui-page-title mt-3">My applications</h1>
              <p className="ui-page-subtitle">Track every application and review status updates in one place.</p>
            </div>
            <div className="ui-card overflow-hidden">
              <div className="ui-card-header p-5">
                <h2 className="text-xl font-bold flex items-center text-slate-900">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Application History
                </h2>
              </div>

              <div className="p-5">
                {downloading && <div className="mb-4"><Loader inline size="sm" text="Preparing download…" /></div>}
                {applications.length === 0 ? (
                  <div className="text-center py-16 px-4">
                    <div className="mb-6 text-gray-400">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 mx-auto opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-3">No applications yet</h3>
                    <p className="text-gray-400 mb-8 max-w-lg mx-auto">Browse available jobs and submit your first application to kickstart your career journey.</p>
                    <Link to="/jobs" className="fmpg-primary-button inline-flex px-7 py-3 transition-all">
                      Browse Jobs
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-5 divide-y divide-gray-800">
                    {applications.map(application => {
                      // Get the job ID
                      const jobId = (application.jobId && typeof application.jobId === 'object' && application.jobId._id)
                        ? application.jobId._id
                        : application.jobId;

                      return (
                        <div key={application._id} className="py-5">
                          {/* Job Update Banner */}
                          <JobUpdateBanner
                            applicationId={application._id}
                            jobId={jobId}
                            notifications={jobUpdateNotifications}
                            className="mb-4"
                          />

                          <div
                            className={`rounded-xl cursor-pointer border transition-all duration-300 group ${selectedApplication && selectedApplication._id === application._id
                              ? 'border-emerald-300 bg-emerald-50/60 shadow-sm'
                              : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
                              }`}
                          >
                            <div
                              className="p-5"
                              onClick={() => handleSelectApplication(application)}
                            >
                              <div className="flex flex-col md:flex-row md:justify-between md:items-center space-y-3 md:space-y-0">
                                <div>
                                  <h3 className="text-xl font-bold mb-2 text-slate-900 transition-colors duration-300">
                                    {(() => {
                                      // Get the job ID, whether it's a string or object with _id
                                      const jobId = (application.jobId && typeof application.jobId === 'object' && application.jobId._id)
                                        ? application.jobId._id
                                        : application.jobId;

                                      // If jobId is an object with title, use that directly
                                      if (typeof application.jobId === 'object' && application.jobId.title) {
                                        return application.jobId.title;
                                      }

                                      // Otherwise look up in jobDetails
                                      return jobDetails[jobId]?.title || 'Loading...';
                                    })()}
                                  </h3>
                                  <p className="text-gray-400 flex items-center space-x-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                    </svg>
                                    <span className="font-medium text-gray-300">
                                      {(() => {
                                        const jobId = (application.jobId && typeof application.jobId === 'object' && application.jobId._id)
                                          ? application.jobId._id
                                          : application.jobId;

                                        if (typeof application.jobId === 'object' && application.jobId.company) {
                                          return application.jobId.company;
                                        }

                                        return jobDetails[jobId]?.company || 'Unknown Company';
                                      })()}
                                    </span>
                                    <span className="text-gray-600">•</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    {(() => {
                                      const jobId = (application.jobId && typeof application.jobId === 'object' && application.jobId._id)
                                        ? application.jobId._id
                                        : application.jobId;

                                      if (typeof application.jobId === 'object' && application.jobId.location) {
                                        return application.jobId.location;
                                      }

                                      return jobDetails[jobId]?.location || 'Unknown Location';
                                    })()}
                                  </p>
                                  <div className="mt-3 flex items-center flex-wrap gap-3">
                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeColor(application.status)} text-white shadow-md`}>
                                      <span className="w-2 h-2 bg-white rounded-full mr-1.5 animate-pulse"></span>
                                      {application.status.charAt(0).toUpperCase() + application.status.slice(1)}
                                    </span>
                                    <span className="text-sm text-gray-400 flex items-center bg-gray-800/40 px-2 py-0.5 rounded-full">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                      </svg>
                                      Applied on {formatDate(application.createdAt)}
                                    </span>

                                    {/* Offer Letter Button - Show only if application status is 'offered' or 'hired' */}
                                    {/* {(application.status === 'offered' || application.status === 'hired') && (
                                <button 
                                  onClick={(e) => handleDownloadOfferLetter(application, e)}
                                  className="inline-flex items-center px-3 py-1 bg-gradient-to-r from-lime-400 to-green-500 hover:from-lime-500 hover:to-green-600 text-black text-xs font-medium rounded-full transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-105"
                                  title="Download Offer Letter"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  Offer Letter
                                </button>
                              )} */}
                                  </div>
                                </div>
                                <button
                                  className={`px-4 py-2 rounded-md transition-all duration-300 text-sm font-medium flex items-center ${selectedApplication && selectedApplication._id === application._id
                                    ? 'bg-black text-white hover:from-gray-800 hover:to-gray-700 hover:shadow-lg'
                                    : 'fmpg-secondary-button hover:shadow-sm'
                                    }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectApplication(application);
                                  }}
                                >
                                  {selectedApplication && selectedApplication._id === application._id ? (
                                    <>
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                      Hide Details
                                    </>
                                  ) : (
                                    <>
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                      </svg>
                                      View Details
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>

                            {selectedApplication && selectedApplication._id === application._id && (
                              <div className="px-5 pb-5 pt-6 border-t border-gray-700/50 transition-all duration-500 animate-fade-in-up">
                                {loadingDetails ? null : (
                                  <div>
                                    {/* Application ID with copy button */}
                                    <div className="mb-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700/50 flex items-center justify-between">
                                      <div className="flex items-center">
                                        <span className="font-medium text-gray-400 mr-2">Application ID:</span>
                                        <span className="text-primary-yellow font-mono">{application._id}</span>
                                      </div>
                                      <button
                                        onClick={(e) => copyApplicationId(application._id, e)}
                                        className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded-md text-xs flex items-center transition-all duration-300"
                                        title="Copy Application ID"
                                      >
                                        {copiedId === application._id ? (
                                          <>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            Copied!
                                          </>
                                        ) : (
                                          <>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                            </svg>
                                            Copy ID
                                          </>
                                        )}
                                      </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700/50">
                                        <h4 className="font-medium text-primary-yellow mb-3 flex items-center text-lg">
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                          </svg>
                                          Contact Information
                                        </h4>
                                        <div className="space-y-2">
                                          <p className="text-gray-300 flex items-start">
                                            <span className="font-medium text-gray-400 w-16 inline-block">Name:</span>
                                            <span className="ml-1">{selectedApplication.fullName}</span>
                                          </p>
                                          <p className="text-gray-300 flex items-start">
                                            <span className="font-medium text-gray-400 w-16 inline-block">Email:</span>
                                            <span className="ml-1">{selectedApplication.email}</span>
                                          </p>
                                          <p className="text-gray-300 flex items-start">
                                            <span className="font-medium text-gray-400 w-16 inline-block">Phone:</span>
                                            <span className="ml-1">{selectedApplication.phone}</span>
                                          </p>
                                        </div>
                                      </div>

                                      <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700/50">
                                        <h4 className="font-medium text-primary-yellow mb-3 flex items-center text-lg">
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                          </svg>
                                          Resume
                                        </h4>
                                        {selectedApplication.resumeUrl ? (
                                          <button
                                            type="button"
                                            onClick={() => handleViewResume(selectedApplication)}
                                            className="inline-flex items-center px-5 py-2 bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-white rounded-md transition-all duration-300 text-sm shadow-md hover:shadow-lg"
                                          >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            View Resume
                                          </button>
                                        ) : (
                                          <p className="text-gray-500 italic">No resume file available</p>
                                        )}
                                      </div>

                                      <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700/50 md:col-span-2">
                                        <h4 className="font-medium text-primary-yellow mb-3 flex items-center text-lg">
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                          </svg>
                                          Cover Letter
                                        </h4>
                                        <div className="max-h-[200px] overflow-y-auto pr-2">
                                          <p className="text-gray-300 whitespace-pre-line leading-relaxed">{selectedApplication.coverLetter}</p>
                                        </div>
                                      </div>

                                      {selectedApplication.questionAnswers && selectedApplication.questionAnswers.length > 0 && (
                                        <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700/50 md:col-span-2">
                                          <h4 className="font-medium text-primary-yellow mb-3 flex items-center text-lg">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            Question Responses
                                          </h4>
                                          <div className="max-h-[250px] overflow-y-auto pr-2 space-y-4">
                                            {selectedApplication.questionAnswers.map((qa, index) => (
                                              <div key={index} className="border-b border-gray-600/50 pb-4 last:border-b-0 last:pb-0">
                                                <p className="font-medium text-white mb-2">{index + 1}. {qa.questionText}</p>
                                                <div className="pl-4 mt-2 bg-gray-700/20 p-3 rounded-lg border border-gray-600/30">
                                                  {qa.questionType === 'file' ? (
                                                    qa.fileUrl ? (
                                                      <a href={qa.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-all duration-300 text-sm shadow-sm hover:shadow-md">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                        </svg>
                                                        {qa.answer}
                                                      </a>
                                                    ) : (
                                                      <p className="text-gray-500 italic">No file uploaded</p>
                                                    )
                                                  ) : qa.questionType === 'checkbox' ? (
                                                    Array.isArray(qa.answer) ? (
                                                      <ul className="list-disc pl-6 text-gray-300 space-y-1">
                                                        {qa.answer.map((ans, i) => (
                                                          <li key={i} className="pl-1">{ans}</li>
                                                        ))}
                                                      </ul>
                                                    ) : (
                                                      <p className="text-gray-300">{qa.answer || 'No answer provided'}</p>
                                                    )
                                                  ) : (
                                                    <p className="text-gray-300">{qa.answer || <span className="italic text-gray-500">No answer provided</span>}</p>
                                                  )}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {/* Offer Letter Section - Show only if application has offer letter */}
                                      {(selectedApplication.status === 'offered' || selectedApplication.status === 'hired') && (
                                        <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700/50 md:col-span-2">
                                          <h4 className="font-medium text-primary-yellow mb-3 flex items-center text-lg">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            Offer Letter
                                          </h4>
                                          <div className="space-y-3">
                                            <p className="text-gray-300">
                                              Congratulations! You have received an offer letter for this position.
                                            </p>

                                            {offerLetters[selectedApplication._id] && (
                                              <div className="bg-gray-700/30 p-3 rounded-lg space-y-2">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                                  <div>
                                                    <span className="text-gray-400">Position:</span>
                                                    <span className="text-white ml-2">{offerLetters[selectedApplication._id].position}</span>
                                                  </div>
                                                  <div>
                                                    <span className="text-gray-400">Department:</span>
                                                    <span className="text-white ml-2">{offerLetters[selectedApplication._id].department}</span>
                                                  </div>
                                                  <div>
                                                    <span className="text-gray-400">Salary:</span>
                                                    <span className="text-white ml-2">{formatCurrencyValue(offerLetters[selectedApplication._id].salary)}</span>
                                                  </div>
                                                  <div>
                                                    <span className="text-gray-400">Start Date:</span>
                                                    <span className="text-white ml-2">{new Date(offerLetters[selectedApplication._id].startDate).toLocaleDateString()}</span>
                                                  </div>
                                                  <div>
                                                    <span className="text-gray-400">Status:</span>
                                                    <span className={`ml-2 px-2 py-1 rounded text-xs ${offerLetters[selectedApplication._id].status === 'Accepted' ? 'bg-green-900 text-green-200' :
                                                      offerLetters[selectedApplication._id].status === 'Rejected' ? 'bg-red-900 text-red-200' :
                                                        'bg-yellow-900 text-yellow-200'
                                                      }`}>
                                                      {offerLetters[selectedApplication._id].status}
                                                    </span>
                                                  </div>
                                                  <div>
                                                    <span className="text-gray-400">Valid Until:</span>
                                                    <span className="text-white ml-2">{new Date(offerLetters[selectedApplication._id].validUntil).toLocaleDateString()}</span>
                                                  </div>
                                                </div>
                                              </div>
                                            )}

                                            <div className="flex flex-wrap gap-3">
                                              <button
                                                onClick={(e) => handleDownloadOfferLetter(selectedApplication, e)}
                                                className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-lime-400 to-green-500 hover:from-lime-500 hover:to-green-600 text-black rounded-md transition-all duration-300 text-sm shadow-md hover:shadow-lg transform hover:scale-105"
                                              >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                                Download Offer Letter PDF
                                              </button>

                                              {/* Show Accept Offer button only if offer hasn't been accepted yet */}
                                              {selectedApplication.status === 'offered' &&
                                                (!offerLetters[selectedApplication._id] || offerLetters[selectedApplication._id].status === 'Pending') && (
                                                  <button
                                                    onClick={(e) => handleAcceptOffer(selectedApplication, e)}
                                                    className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-md transition-all duration-300 text-sm shadow-md hover:shadow-lg transform hover:scale-105"
                                                  >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    Accept Offer
                                                  </button>
                                                )}
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>)}
                          </div>
                        </div>
                      )
                    }
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MyApplications;
