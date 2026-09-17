import { useState, useEffect, useRef, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { jobService, applicationService } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { getImageUrl, getFirstLetterFallback } from '../utils/imageUtils';
import { formatCurrencyValue } from '../utils/currencyUtils';
import ConfirmationModal from '../components/common/ConfirmationModal';
import ShareJobModal from '../components/common/ShareJobModal';
import { setCache, getCache } from '../utils/cache';
import { toast } from 'react-toastify';
import { Share2 } from 'lucide-react';

const Jobs = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  const { currentUser, isAdmin, isHR, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [animateList, setAnimateList] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useState(window.innerWidth < 640 ? 'compact' : 'detailed');
  const [isScrolling, setIsScrolling] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const searchInputRef = useRef(null);

  // States for confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [jobToDelete, setJobToDelete] = useState(null);
  const [sharingJob, setSharingJob] = useState(null);
  const [publicationUpdatingId, setPublicationUpdatingId] = useState(null);
  const canManageJobs = isAdmin || (isHR && currentUser?.permissions?.canManageJobs === true);
  const jobsCacheKey = currentUser?._id ? `jobs:${currentUser._id}` : 'jobs:public';

  const enrichJobsWithApplicationStatus = async (jobsList) => {
    if (!currentUser || currentUser.role !== 'user' || !Array.isArray(jobsList) || jobsList.length === 0) {
      return Array.isArray(jobsList) ? jobsList : [];
    }

    try {
      const jobIds = jobsList.map((job) => job._id);
      const statusResponse = await applicationService.checkMultipleApplicationStatuses(jobIds);
      const statuses = statusResponse.data?.statuses || {};

      return jobsList.map((job) => ({
        ...job,
        applicationStatus: statuses[job._id]?.status || null
      }));
    } catch {
      // Keep job listing usable if batch status lookup fails.
      return jobsList.map((job) => ({ ...job, applicationStatus: null }));
    }
  };

  // Handle window resize for responsive view mode
  useEffect(() => {
    const handleResize = () => {
      setViewMode(window.innerWidth < 640 ? 'compact' : 'detailed');
      // Collapse search on resize to larger screens
      if (window.innerWidth > 768 && searchExpanded) {
        setSearchExpanded(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [searchExpanded]);

  // Focus search input when expanded
  useEffect(() => {
    if (searchExpanded && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchExpanded]);

  // Click outside to collapse search
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchExpanded && searchInputRef.current && !searchInputRef.current.contains(event.target)) {
        // Check if the click was on the search toggle button
        const isSearchToggleClick = event.target.closest('[data-search-toggle]');
        if (!isSearchToggleClick) {
          setSearchExpanded(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [searchExpanded]);

  // Add scroll listener for enhanced UI experiences
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolling(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [currentUser?._id]);

  // Handle success message from application submission
  useEffect(() => {
    if (location.state?.success && location.state?.message) {
      toast.success(location.state.message);

      // Clear the location state
      navigate('.', { replace: true, state: {} });
    }
  }, [location, navigate]);

  useEffect(() => {
    loadJobs();
  }, []);

  useEffect(() => {
    if (!loading && jobs.length > 0) {
      setAnimateList(true);
    }
  }, [loading, jobs]);

  // Simulate loading progress for better UX
  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => {
        setLoadingProgress(prev => {
          const newProgress = prev + Math.random() * 15;
          return newProgress > 90 ? 90 : newProgress;
        });
      }, 200);

      return () => {
        clearInterval(interval);
        setLoadingProgress(100);
      };
    }
  }, [loading]);

  const loadJobs = async () => {
    setLoading(true);
    setLoadingProgress(0);

    const cachedJobs = canManageJobs ? null : getCache(jobsCacheKey);
    if (cachedJobs && Array.isArray(cachedJobs) && cachedJobs.length > 0 && cachedJobs.every(j => j.slug)) {
      const cachedJobsWithStatus = await enrichJobsWithApplicationStatus(cachedJobs);
      setJobs(cachedJobsWithStatus);
      setLoading(false);
      setAnimateList(true);
      return;
    }

    try {
      const response = await jobService.getAllJobs();
      const jobsWithStatus = await enrichJobsWithApplicationStatus(response.data);
      setJobs(jobsWithStatus);
      if (!canManageJobs) {
        setCache(jobsCacheKey, jobsWithStatus, 300000); // Cache per viewer for 5 minutes
      }
      setAnimateList(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error loading jobs');
    } finally {
      setLoading(false);
    }
  };



  const getApplicationStatusInfo = (job) => {
    const { applicationStatus } = job;
    if (!applicationStatus) {
      return { hasApplied: false, canApply: true };
    }

    return {
      hasApplied: true,
      canApply: applicationStatus === 'rejected',
      status: applicationStatus
    };
  };

  const renderApplyButton = (job, isCompact = false) => {
    const statusInfo = getApplicationStatusInfo(job);

    if (!statusInfo.hasApplied) {
      // User hasn't applied yet
      return (
        <button
          className={`bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-500 hover:to-emerald-600 text-white ${isCompact ? 'px-4 py-2' : 'px-8 py-3 w-full'} rounded-lg font-medium transform hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-opacity-50 shadow-lg hover:shadow-yellow-600/20 flex items-center justify-center gap-2`}
          onClick={(e) => {
            if (isCompact) e.stopPropagation();
            handleApply(job);
          }}
        >
          <svg className={`${isCompact ? 'w-4 h-4' : 'w-5 h-5'}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isCompact ? "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" : "M15 13l-3 3m0 0l-3-3m3 3V8m0 13a9 9 0 110-18 9 9 0 010 18z"} />
          </svg>
          {isCompact ? 'Apply Now' : 'Apply for this Position'}
        </button>
      );
    } else if (statusInfo.canApply) {
      // User can reapply (previous application was rejected)
      return (
        <button
          className={`bg-gradient-to-r from-yellow-600 to-orange-700 hover:from-yellow-500 hover:to-orange-600 text-white ${isCompact ? 'px-4 py-2' : 'px-8 py-3 w-full'} rounded-lg font-medium transform hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-opacity-50 shadow-lg hover:shadow-orange-600/20 flex items-center justify-center gap-2`}
          onClick={(e) => {
            if (isCompact) e.stopPropagation();
            handleApply(job);
          }}
        >
          <svg className={`${isCompact ? 'w-4 h-4' : 'w-5 h-5'}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {isCompact ? 'Apply Again' : 'Apply Again'}
        </button>
      );
    } else {
      // User has applied and cannot apply again
      return (
        <button
          className={`bg-gradient-to-r from-gray-600 to-gray-700 text-gray-300 ${isCompact ? 'px-4 py-2' : 'px-8 py-3 w-full'} rounded-lg font-medium cursor-not-allowed opacity-75 flex items-center justify-center gap-2`}
          disabled
        >
          <svg className={`${isCompact ? 'w-4 h-4' : 'w-5 h-5'}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Applied ({statusInfo.status})
        </button>
      );
    }
  };


  const handleEdit = (jobOrId) => {
    const identifier = typeof jobOrId === 'object' ? (jobOrId.slug || jobOrId._id) : jobOrId;
    navigate(`/jobs/edit/${identifier}`);
  };

  const handleAdd = () => {
    navigate('/jobs/create');
  };

  const handlePublicationToggle = async (job) => {
    try {
      setPublicationUpdatingId(job._id);
      const nextPublished = job.isPublished === false;
      const response = await jobService.updateJob(job.slug || job._id, { isPublished: nextPublished });
      setJobs((currentJobs) => currentJobs.map((item) =>
        item._id === job._id ? { ...item, isPublished: response.data.job.isPublished } : item
      ));
      toast.success(nextPublished ? 'Job published successfully' : 'Job moved to draft');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to update publication status');
    } finally {
      setPublicationUpdatingId(null);
    }
  };

  const handleDelete = async (id) => {
    const jobTitle = jobs.find(job => job._id === id)?.title || 'this job';
    setJobToDelete({ id, title: jobTitle });
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!jobToDelete) return;

    try {
      await jobService.deleteJob(jobToDelete.id);
      setJobs(jobs.filter(job => job._id !== jobToDelete.id));

      // Show success message (get title BEFORE clearing jobToDelete)
      toast.success(`Job "${jobToDelete.title}" deleted successfully`);

      setShowDeleteModal(false);
      setJobToDelete(null);
    } catch (err) {
      toast.error(err.response?.data?.message || `Error deleting job with ID: ${jobToDelete.id}`);
      setShowDeleteModal(false);
      setJobToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setJobToDelete(null);
  };

  const handleApply = async (job) => {
    // Check if user has already applied
    const appStatus = getApplicationStatusInfo(job);
    if (appStatus.hasApplied && !appStatus.canApply) {
      toast.error(`You have already applied for this job. Current status: ${appStatus.status}. You can only apply again if your application is rejected.`);
      return;
    }

    navigate(`/apply/${job.slug || job._id}`);
  };

  const handleViewApplications = (jobId) => {
    const job = jobs.find((item) => item._id === jobId);
    const identifier = job?.slug || jobId;
    navigate(`/jobs/edit/${identifier}?tab=applications`);
  };

  const safeJobs = Array.isArray(jobs) ? jobs : [];
  const filteredJobs = safeJobs.filter(job =>
    (job.title?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (job.company?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (job.location?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  ).filter(job =>
    filterType ? job.type === filterType : true
  ).sort((a, b) => {
    if (sortBy === 'newest') {
      return new Date(b.createdAt) - new Date(a.createdAt);
    } else if (sortBy === 'oldest') {
      return new Date(a.createdAt) - new Date(b.createdAt);
    } else if (sortBy === 'salary-high') {
      const salaryA = parseFloat(a.salary?.replace(/[^0-9.-]+/g, '')) || 0;
      const salaryB = parseFloat(b.salary?.replace(/[^0-9.-]+/g, '')) || 0;
      return salaryB - salaryA;
    } else if (sortBy === 'salary-low') {
      const salaryA = parseFloat(a.salary?.replace(/[^0-9.-]+/g, '')) || 0;
      const salaryB = parseFloat(b.salary?.replace(/[^0-9.-]+/g, '')) || 0;
      return salaryA - salaryB;
    }
    return 0;
  });

  const jobTypes = [...new Set(safeJobs.map(job => job.type))];

  // Check if a job was posted within the last 7 days
  const isNewJob = (createdAt) => {
    const jobDate = new Date(createdAt);
    const today = new Date();
    const diffTime = Math.abs(today - jobDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 7;
  };

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-4 pb-16 pt-24 sm:px-6 lg:px-8">
      <Helmet>
        <title>Remote Jobs & Careers | FMPG</title>
        <meta name="description" content="Browse open job positions at FMPG. Find roles in property management, design, digital marketing, and management. Apply today to build your career." />
        <link rel="canonical" href="https://fmpg.vercel.app/jobs" />
      </Helmet>

      <div className="relative mb-8 overflow-hidden rounded-[2rem] border border-emerald-100 bg-emerald-50 px-6 py-12 text-center sm:px-10 md:py-16">
        <div className="absolute -left-20 -top-24 h-64 w-64 rounded-full bg-white/80 blur-3xl" />
        <div className="absolute -bottom-28 right-0 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="relative z-20">
          <span className="fmpg-kicker">Open opportunities</span>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 md:text-5xl">
            Find your place at <span className="fmpg-accent-text">FMPG</span>
          </h1>
          <p className="mx-auto mb-8 mt-4 max-w-2xl text-base leading-relaxed text-slate-600 md:text-lg">
            Search thoughtful roles, understand what matters, and apply with confidence.
          </p>

          {/* Search Box in Hero */}
          <div className="max-w-3xl mx-auto">
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="Search for job titles, companies or locations..."
                className="w-full rounded-2xl border border-slate-200 bg-white py-4 pl-12 pr-12 text-slate-900 placeholder-slate-400 shadow-[0_12px_30px_-20px_rgba(15,23,42,0.35)] transition-all focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <svg className="w-5 h-5 absolute left-4 text-emerald-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchTerm && (
                <button
                  className="absolute right-4 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline-none"
                  onClick={() => setSearchTerm('')}
                >
                  <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>


      {/* Job Count & Filter Section */}
      <div className="mb-6 flex flex-row items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center flex-shrink-0">
          <span className="text-slate-600 text-xs sm:text-sm font-medium">Showing</span>
          <span className="mx-1.5 bg-emerald-50 text-emerald-700 text-xs sm:text-sm font-bold px-2.5 py-1 rounded-full">
            {filteredJobs.length}
          </span>
          <span className="text-slate-600 text-xs sm:text-sm font-medium hidden sm:inline">job opportunities</span>
          <span className="text-slate-600 text-xs sm:text-sm font-medium sm:hidden">Jobs</span>
        </div>




        <div className="flex items-center gap-2 ml-auto">
          {/* Inline filters - Right aligned */}
          <div className="hidden sm:flex items-center gap-2 pr-2 border-r border-gray-700/30 mr-1">
            <div className="relative group">
              <select
                className="appearance-none min-w-[125px] rounded-xl border border-slate-200 bg-white px-3 py-2 pr-8 text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="">All Types</option>
                {[...new Set(safeJobs.map(job => job.type))].map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-yellow-500/50">
                <svg className="w-3 h-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
            </div>

            <div className="relative group">
              <select
                className="appearance-none min-w-[125px] rounded-xl border border-slate-200 bg-white px-3 py-2 pr-8 text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="salary-high">Salary: High</option>
                <option value="salary-low">Salary: Low</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-yellow-500/50">
                <svg className="w-3 h-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M3 3a1 1 0 000 2h11a1 1 0 100-2H3zM3 7a1 1 0 000 2h7a1 1 0 100-2H3zM3 11a1 1 0 100 2h4a1 1 0 100-2H3z" />
                </svg>
              </div>
            </div>
          </div>

          {currentUser && (isAdmin || (isHR && currentUser?.permissions?.canCreateJob && currentUser?.permissions?.canManageJobs)) && (
            <button
              onClick={handleAdd}
              className="fmpg-primary-button px-4 py-2 text-xs flex items-center gap-1.5 transition-all active:scale-95 sm:mr-1"
            >
              <svg className="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Post Job
            </button>
          )}

          {/* Mobile Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="sm:hidden flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-700 text-xs transition-all active:scale-95 group"
          >
            <svg className={`w-3 h-3 ${showFilters ? 'text-emerald-600' : 'text-slate-400'}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <span className="font-semibold uppercase tracking-wide">Filters</span>
          </button>
        </div>
      </div>


      {/* Jobs listing section */}
      <div className="w-full space-y-6">
        {loading ? (
          <div className="fmpg-card overflow-hidden p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <svg className="animate-spin w-5 h-5 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-green-400">Loading Jobs...</span>
              </h2>
              <div className="w-24 bg-gray-700 h-2.5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-400 to-emerald-600 transition-all duration-300"
                  style={{ width: `${loadingProgress}%` }}
                ></div>
              </div>
            </div>
            <div className="space-y-4">
              {[...Array(5)].map((_, index) => (
                <div key={index} className="bg-gray-800/30 border border-gray-700/50 rounded-xl overflow-hidden p-5 animate-pulse">
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex-1 flex gap-4">
                      <div className="hidden sm:block h-16 w-16 bg-gray-700 rounded-lg"></div>
                      <div className="w-full">
                        <div className="h-6 bg-gray-700 rounded w-3/4 mb-3"></div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <div className="h-4 bg-gray-700 rounded w-1/4"></div>
                          <div className="h-4 bg-gray-700 rounded w-1/4"></div>
                          <div className="h-4 bg-gray-700 rounded w-1/6"></div>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center justify-end">
                      <div className="h-9 bg-gray-700 rounded-lg w-24"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (filteredJobs.length === 0) ? (
          <div className="fmpg-card overflow-hidden p-10">
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <svg className="w-20 h-20 mb-6 text-gray-600 opacity-50" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <h3 className="text-xl font-bold text-slate-900 mb-2">No matching jobs found</h3>
              <p className="text-slate-500 text-center max-w-md">Try adjusting your search criteria or browse all available positions.</p>
              <button
                onClick={() => { setSearchTerm(''); setFilterType(''); }}
                className="fmpg-secondary-button mt-6 px-5 py-2.5 transition-colors duration-300 flex items-center gap-2"
              >
                <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Reset Filters
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredJobs.map((job, index) => (
              <div
                key={job._id}
                className={`fmpg-card overflow-hidden ${animateList ? 'animate-fade-in-up' : 'opacity-0'}`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div>
                  <div
                    className="p-5 flex md:flex-row justify-between gap-4 relative"
                  >
                    {isNewJob(job.createdAt) && (
                      <div className="absolute -top-1 -right-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg shadow-md transform rotate-2 z-10">
                        NEW
                      </div>
                    )}
                    <div className="flex-1 flex gap-5">
                      {job.imageUrl ? (
                        <div className="hidden sm:block">
                          <div className="h-20 w-20 rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 p-1">
                            <img
                              src={getImageUrl(job.imageUrl)}
                              alt={job.title}
                              className="h-full w-full object-cover rounded-md transition-transform duration-500 hover:scale-110"
                              onError={(e) => {
                                const letterDiv = document.createElement('div');
                                letterDiv.className = "h-full w-full flex items-center justify-center text-white text-2xl font-bold rounded-md";
                                letterDiv.innerText = getFirstLetterFallback(job.title);
                                e.target.parentNode.appendChild(letterDiv);
                                e.target.style.display = 'none';
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="hidden sm:flex h-20 w-20 items-center justify-center bg-gray-500 text-white text-2xl font-bold rounded-lg shadow-md">
                          {getFirstLetterFallback(job.title)}
                        </div>
                      )}
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-slate-900 hover:text-emerald-700 transition-colors duration-300 flex items-center group">
                          {job.title}
                          {canManageJobs && (
                            <span className={`ml-3 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${job.isPublished === false ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                              {job.isPublished === false ? 'Draft' : 'Published'}
                            </span>
                          )}
                          <svg className="w-5 h-5 ml-2 text-slate-400 group-hover:text-emerald-600 transition-transform duration-300 group-hover:translate-x-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </h3>
                        <div className="flex flex-wrap gap-3 items-center mt-2 text-sm">
                          <span className="flex items-center text-gray-300 hover:text-white transition-colors duration-300 group">
                            <svg className="w-4 h-4 mr-1.5 text-emerald-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            {job.company}
                          </span>
                          <span className="flex items-center text-gray-300 hover:text-white transition-colors duration-300 group">
                            <svg className="w-4 h-4 mr-1.5 text-emerald-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {job.location}
                          </span>
                          {job.salary && (
                            <span className="flex items-center text-emerald-400 hover:text-emerald-300 transition-colors duration-300 group">
                              <svg className="w-4 h-4 mr-1.5 text-emerald-500 group-hover:text-emerald-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {formatCurrencyValue(job.salary)}
                            </span>
                          )}
                          {job.type && (
                            <span className="bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700 rounded-full border border-emerald-100">
                              {job.type}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSharingJob(job);
                        }}
                        className="p-2.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all border border-slate-200 hover:border-emerald-300 flex items-center gap-1.5 text-xs font-semibold shadow-sm"
                        title="Share this job"
                        aria-label={`Share ${job.title}`}
                      >
                        <Share2 className="w-4 h-4 text-emerald-600" />
                        <span className="hidden sm:inline">Share</span>
                      </button>
                      {currentUser && currentUser.role === 'user' && (
                        <div className="hidden md:block">
                          {renderApplyButton(job, true)}
                        </div>
                      )}
                      {!currentUser && (
                        <div className="hidden md:block">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApply(job);
                            }}
                            className="fmpg-primary-button px-4 py-2 text-sm"
                          >
                            View & Apply
                          </button>
                        </div>
                      )}
                      {currentUser && canManageJobs && (isAdmin || currentUser.assignedJobs?.some(j => (j._id || j) === job._id)) && (
                        <div className="hidden md:flex gap-2">
                          <button
                            className={`${job.isPublished === false ? 'bg-emerald-700 hover:bg-emerald-600' : 'bg-slate-700 hover:bg-slate-600'} text-white px-3 py-2 rounded-lg transition flex items-center disabled:opacity-60`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePublicationToggle(job);
                            }}
                            disabled={publicationUpdatingId === job._id}
                            title={job.isPublished === false ? 'Publish job' : 'Unpublish job'}
                          >
                            {publicationUpdatingId === job._id ? 'Saving…' : (job.isPublished === false ? 'Publish' : 'Unpublish')}
                          </button>
                          <button
                            className="bg-blue-900/80 hover:bg-blue-800 text-white px-3 py-2 rounded-lg transition duration-300 ease-in-out flex items-center gap-1 hover:shadow-md"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewApplications(job._id);
                            }}
                            title="View applications"
                          >
                            <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            <span className="hidden sm:inline ml-1">Applications</span>
                          </button>
                          <button
                            className="bg-amber-900/80 hover:bg-amber-800 text-white px-3 py-2 rounded-lg transition duration-300 ease-in-out flex items-center gap-1 hover:shadow-md"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(job);
                            }}
                            title="Edit job"
                          >
                            <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            <span className="hidden sm:inline ml-1">Edit</span>
                          </button>
                          {isSuperAdmin && (
                            <button
                              className="bg-red-900/80 hover:bg-red-800 text-white px-3 py-2 rounded-lg transition duration-300 ease-in-out flex items-center gap-1 hover:shadow-md"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(job._id);
                              }}
                              title="Delete job (Super Admin)"
                            >
                              <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              <span className="hidden sm:inline ml-1">Delete</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Mobile bottom section with share & apply buttons */}
                  <div className="md:hidden border-t border-slate-100 px-5 py-4">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSharingJob(job);
                          }}
                          className="flex items-center justify-center gap-1.5 py-2.5 px-3.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 font-semibold text-xs transition-all shadow-sm flex-1"
                          title="Share job"
                        >
                          <Share2 className="w-4 h-4 text-emerald-600" />
                          <span>Share</span>
                        </button>
                        {currentUser && currentUser.role === 'user' ? (
                          <div className="flex-[2]">
                            {renderApplyButton(job, true)}
                          </div>
                        ) : !currentUser ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApply(job);
                            }}
                            className="fmpg-primary-button py-2.5 px-4 text-xs font-bold flex-[2]"
                          >
                            View & Apply
                          </button>
                        ) : null}
                      </div>
                      {currentUser && canManageJobs && (isAdmin || currentUser.assignedJobs?.some(j => (j._id || j) === job._id)) && (
                        <div className="flex gap-2 justify-center">
                          <button
                            className={`${job.isPublished === false ? 'bg-emerald-700 hover:bg-emerald-600' : 'bg-slate-700 hover:bg-slate-600'} text-white px-4 py-2 rounded-lg transition flex-1 disabled:opacity-60`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePublicationToggle(job);
                            }}
                            disabled={publicationUpdatingId === job._id}
                          >
                            {publicationUpdatingId === job._id ? 'Saving…' : (job.isPublished === false ? 'Publish' : 'Unpublish')}
                          </button>
                          <button
                            className="bg-blue-900/80 hover:bg-blue-800 text-white px-4 py-2 rounded-lg transition duration-300 ease-in-out flex items-center gap-1 hover:shadow-md flex-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewApplications(job._id);
                            }}
                            title="View applications"
                          >
                            <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            <span className="ml-1">Applications</span>
                          </button>
                          <button
                            className="bg-amber-900/80 hover:bg-amber-800 text-white px-4 py-2 rounded-lg transition duration-300 ease-in-out flex items-center gap-1 hover:shadow-md flex-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(job);
                            }}
                            title="Edit job"
                          >
                            <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            <span className="ml-1">Edit</span>
                          </button>
                          {isSuperAdmin && (
                            <button
                              className="bg-red-900/80 hover:bg-red-800 text-white px-4 py-2 rounded-lg transition duration-300 ease-in-out flex items-center gap-1 hover:shadow-md flex-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(job._id);
                              }}
                              title="Delete job (Super Admin)"
                            >
                              <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              <span className="ml-1">Delete</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}

        {!currentUser && (
          <div className="mt-8 overflow-hidden rounded-2xl border border-emerald-100 bg-emerald-50 p-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">Ready to apply for your dream job?</h3>
                <p className="text-slate-600">Sign in or create an account to start your career journey.</p>
              </div>
              <div className="flex gap-3">
                <Link
                  to="/login"
                  className="fmpg-primary-button inline-flex items-center px-5 py-2.5 transition"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="fmpg-secondary-button inline-flex items-center px-5 py-2.5 transition"
                >
                  Create Account
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        title="Delete Job"
        message={`Are you sure you want to delete "${jobToDelete?.title}"? This action cannot be undone and will permanently remove the job posting and all associated applications.`}
        confirmText="Delete Job"
        cancelText="Cancel"
        confirmButtonClass="bg-red-600 hover:bg-red-700 text-white"
        cancelButtonClass="bg-gray-600 hover:bg-gray-700 text-white"
        type="danger"
      />

      {/* Share Job Modal */}
      <ShareJobModal
        isOpen={Boolean(sharingJob)}
        onClose={() => setSharingJob(null)}
        job={sharingJob}
      />
      {/* Mobile Filter Modal - Premium Glassmorphism */}
      {showFilters && (
        <div className="lg:hidden fixed inset-0 z-[100] flex items-end justify-center p-0">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-500 animate-in fade-in"
            onClick={() => setShowFilters(false)}
          ></div>

          <div className="relative w-full max-w-2xl bg-white rounded-t-[2rem] border-t border-slate-200 shadow-[0_-20px_60px_rgba(15,23,42,0.18)] p-5 pb-6 transform transition-all duration-300 ease-out animate-in slide-in-from-bottom-full h-auto max-h-[70vh] overflow-y-auto overflow-x-hidden flex flex-col">
            {/* Modal Drag Indicator */}
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4 shrink-0"></div>

            <div className="flex items-center justify-between mb-6 px-1">
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Refine <span className="text-emerald-600">jobs</span>
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setFilterType('');
                    setSortBy('newest');
                  }}
                  className="px-3 py-2 text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-emerald-700 transition-colors"
                >
                  Reset
                </button>
                <button
                  onClick={() => setShowFilters(false)}
                  className="p-2 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-100 transition-all active:scale-90"
                >
                  <svg className="w-4 h-4 font-bold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="space-y-6 flex-1 px-1">
              <div>
                <label className="block text-xs font-bold uppercase tracking-[0.16em] text-slate-500 mb-3 ml-1">Job category</label>
                <div className="flex flex-nowrap gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  <button
                    onClick={() => setFilterType('')}
                    className={`flex-shrink-0 px-4 py-2.5 rounded-full text-xs font-bold transition-all duration-300 border ${filterType === '' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200'}`}
                  >
                    All Types
                  </button>
                  {[...new Set(safeJobs.map(job => job.type))].map(type => (
                    <button
                      key={type}
                      onClick={() => setFilterType(type)}
                      className={`flex-shrink-0 px-4 py-2.5 rounded-full text-xs font-bold transition-all duration-300 border ${filterType === type ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200'}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-[0.16em] text-slate-500 mb-3 ml-1">Sort by</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'newest', label: 'Newest' },
                    { id: 'oldest', label: 'Oldest' },
                    { id: 'salary-high', label: 'Highest Salary' },
                    { id: 'salary-low', label: 'Lowest Salary' }
                  ].map(option => (
                    <button
                      key={option.id}
                      onClick={() => setSortBy(option.id)}
                      className={`flex items-center justify-center px-3 py-3 rounded-xl text-xs font-bold transition-all duration-300 border ${sortBy === option.id ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white text-slate-600 border-slate-200'}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8 shrink-0">
              <button
                onClick={() => setShowFilters(false)}
                className="fmpg-primary-button w-full py-4 text-sm uppercase tracking-[0.18em] active:scale-[0.98] transition-all"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Jobs;