import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { applicationService, jobService } from '../services/api';
import JobQuestionManager from '../components/JobQuestionManager';
import { getResumeViewUrl } from '../utils/urlUtils';
import Loader from '../components/common/Loader';

const JOB_TABS = ['details', 'questions', 'applications'];

const JobForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(id ? true : false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    company: '',
    location: '',
    description: '',
    requirements: '',
    responsibilities: '',
    salary: '',
    type: 'Full-time',
    department: '',
    position: '',
    isPublished: false,
    questions: [],
    image: null,
    hrContact: {
      name: '',
      email: '',
      phone: ''
    }
  });
  
  const [imagePreview, setImagePreview] = useState('');
  
  const getTabFromUrl = () => {
    const requestedTab = new URLSearchParams(location.search).get('tab');
    if (!JOB_TABS.includes(requestedTab)) return 'details';
    if (!id && requestedTab === 'applications') return 'details';
    return requestedTab;
  };

  const [activeTab, setActiveTab] = useState(getTabFromUrl);
  const [applications, setApplications] = useState([]);
  const [loadingApplications, setLoadingApplications] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    if (id) {
      loadJob();
    }
  }, [id]);

  useEffect(() => {
    setActiveTab(getTabFromUrl());
  }, [location.search, id]);

  useEffect(() => {
    if (id && activeTab === 'applications') {
      loadJobApplications();
    }
  }, [id, activeTab]);

  const handleTabChange = (tab) => {
    if (!JOB_TABS.includes(tab) || (!id && tab === 'applications')) return;

    const searchParams = new URLSearchParams(location.search);
    searchParams.set('tab', tab);
    navigate({ pathname: location.pathname, search: searchParams.toString() });
  };

  const loadJob = async () => {
    try {
      setLoading(true);
      const response = await jobService.getJobById(id);
      const job = response.data;

      if (job.slug && id !== job.slug) {
        navigate(`/jobs/edit/${job.slug}${location.search}`, { replace: true });
      }

      setFormData({
        title: job.title || '',
        company: job.company || '',
        location: job.location || '',
        description: job.description || '',
        requirements: Array.isArray(job.requirements) ? job.requirements.join('\n') : job.requirements || '',
        responsibilities: Array.isArray(job.responsibilities) ? job.responsibilities.join('\n') : job.responsibilities || '',
        salary: job.salary || '',
        type: job.type || 'Full-time',
        department: job.department || '',
        position: job.position || '',
        isPublished: job.isPublished !== false,
        questions: job.questions || [],
        hrContact: {
          name: job.hrContact?.name || '',
          email: job.hrContact?.email || '',
          phone: job.hrContact?.phone || ''
        }
      });
      
      if (job.imageUrl) {
        setImagePreview(`${import.meta.env.VITE_API_BASE_URL || ''}${job.imageUrl}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || `Error loading job with ID: ${id}`);
    } finally {
      setLoading(false);
    }
  };

  const loadJobApplications = async () => {
    if (!id) return;

    try {
      setLoadingApplications(true);
      const response = await jobService.getJobApplications(id);
      setApplications(response.data);
    } catch (err) {
      toast.error(err.response?.data?.message || `Error loading applications for job ID: ${id}`);
    } finally {
      setLoadingApplications(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData(prev => ({ ...prev, image: file }));
      
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    }
  };
  
  const handleRemoveImage = () => {
    setFormData(prev => ({ ...prev, image: null }));
    setImagePreview('');
  };

  const handleQuestionsChanged = (updatedQuestions) => {
    setFormData(prev => ({ ...prev, questions: updatedQuestions }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploadProgress(0);

    // Check if we have an image to upload
    const hasImageUpload = formData.image && formData.image instanceof File;
    
    if (hasImageUpload) {
      setIsUploading(true);
    }

    try {
      const formattedData = {
        ...formData,
        requirements: typeof formData.requirements === 'string' ?
          formData.requirements.split('\n').filter(line => line.trim()) :
          formData.requirements,
        responsibilities: typeof formData.responsibilities === 'string' ?
          formData.responsibilities.split('\n').filter(line => line.trim()) :
          formData.responsibilities,
      };

      // Setup progress callback for image uploads
      const onUploadProgress = (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        setUploadProgress(percentCompleted);
      };

      if (id) {
        await jobService.updateJob(id, formattedData, hasImageUpload ? onUploadProgress : null);
        toast.success('Job updated successfully!');
      } else {
        const response = await jobService.createJob(formattedData, hasImageUpload ? onUploadProgress : null);
        toast.success('Job created successfully!');
        setTimeout(() => {
          navigate(`/jobs/edit/${response.data.job.slug || response.data.job._id}`);
        }, 1500);
      }
    } catch (err) {
      console.error('Job submission error:', err);
      
      // Handle timeout errors specifically
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        toast.error('Upload is taking longer than expected. Please wait a moment and check if the job was created successfully.');
      } else {
        toast.error(err.response?.data?.message || 'Error saving job');
      }
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleCancel = () => {
    navigate('/jobs');
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  const handleViewResume = async (applicationId, resumeUrl) => {
    if (!applicationId || !resumeUrl) return;

    try {
      const response = await applicationService.getResumeAccessUrl(applicationId);
      const secureUrl = response?.data?.url;
      if (secureUrl) {
        window.open(secureUrl, '_blank', 'noopener,noreferrer');
        return;
      }
    } catch (resumeError) {
      console.error('Error fetching secure resume URL:', resumeError);
    }

    window.open(getResumeViewUrl(resumeUrl), '_blank', 'noopener,noreferrer');
  };

  const getStatusBadgeColor = (status) => {
    switch (status.toLowerCase()) {
      case 'pending': return 'bg-yellow-500';
      case 'reviewing': return 'bg-blue-500';
      case 'shortlisted': return 'bg-indigo-500';
      case 'rejected': return 'bg-red-500';
      case 'offered': return 'bg-green-500';
      case 'hired': return 'bg-green-600';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return <Loader fullPage={true} text="Preparing workspace..." />;
  }

  return (
    <div className="ui-page">
      <div className="ui-content">
      <div className="ui-page-header">
        <span className="fmpg-kicker">Recruitment workspace</span>
        <h1 className="ui-page-title mt-3">{id ? 'Manage job' : 'Create a new job'}</h1>
        <p className="ui-page-subtitle">Configure the role, application questions, and review incoming candidates.</p>
      </div>

      <div className="mb-8 overflow-x-auto border-b border-slate-200">
        <div className="flex flex-wrap">
          <ul className="flex gap-1 mb-4">
            <li>
              <button
                className={`px-6 py-3 rounded-t-lg font-medium transition ${activeTab === 'details' 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                  : 'bg-white text-slate-500 border border-transparent hover:bg-slate-50'}`}
                onClick={() => handleTabChange('details')}
              >
                Job Details
              </button>
            </li>
            <li>
              <button
                className={`px-6 py-3 rounded-t-lg font-medium transition ${activeTab === 'questions' 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                  : 'bg-white text-slate-500 border border-transparent hover:bg-slate-50'}`}
                onClick={() => handleTabChange('questions')}
              >
                Application Questions
              </button>
            </li>
            {id && (
              <li>
                <button
                  className={`px-6 py-3 rounded-t-lg font-medium transition flex items-center ${activeTab === 'applications' 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                    : 'bg-white text-slate-500 border border-transparent hover:bg-slate-50'}`}
                  onClick={() => handleTabChange('applications')}
                >
                  Applications 
                  <span className="ml-2 bg-primary text-black text-xs font-bold px-2.5 py-0.5 rounded-full">
                    {applications.length}
                  </span>
                </button>
              </li>
            )}
          </ul>
        </div>
      </div>

      {activeTab === 'details' && (
        <div className="ui-card p-6 sm:p-8">
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-bold text-slate-900">Publication status</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {formData.isPublished
                        ? 'Published jobs are visible publicly and accept applications.'
                        : 'Draft jobs are visible only to authorized staff and cannot accept applications.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={formData.isPublished}
                    onClick={() => setFormData((prev) => ({ ...prev, isPublished: !prev.isPublished }))}
                    className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${formData.isPublished ? 'bg-emerald-600' : 'bg-slate-300'}`}
                  >
                    <span className={`absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${formData.isPublished ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
                <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold ${formData.isPublished ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {formData.isPublished ? 'Published' : 'Draft'}
                </span>
              </div>

              <div>
                <label htmlFor="title" className="ui-label">Job title</label>
                <input
                  type="text"
                  className="ui-input"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  required
                  placeholder="e.g. Senior React Developer"
                />
              </div>

              <div>
                <label htmlFor="company" className="ui-label">Company</label>
                <input
                  type="text"
                  className="ui-input"
                  id="company"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  required
                  placeholder="e.g. Acme Inc."
                />
              </div>

              <div>
                <label htmlFor="location" className="ui-label">Location</label>
                <input
                  type="text"
                  className="ui-input"
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="e.g. Remote, New York, NY"
                />
              </div>

              <div>
                <label htmlFor="type" className="ui-label">Employment type</label>
                <select
                  className="ui-select"
                  id="type"
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                >
                  <option value="Full-time">Full-time</option>
                  <option value="Part-time">Part-time</option>
                  <option value="Contract">Contract</option>
                  <option value="Internship">Internship</option>
                </select>
              </div>

              <div>
                <label htmlFor="salary" className="ui-label">Salary</label>
                <input
                  type="text"
                  className="ui-input"
                  id="salary"
                  name="salary"
                  value={formData.salary}
                  onChange={handleChange}
                  placeholder="e.g., ₹50,000 - ₹70,000 per year"
                />
              </div>

              <div>
                <label htmlFor="department" className="block text-sm font-medium text-gray-300 mb-1">Department</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-white"
                  id="department"
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  placeholder="e.g., Engineering, Marketing, Sales"
                />
              </div>

              <div>
                <label htmlFor="position" className="block text-sm font-medium text-gray-300 mb-1">Position</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-white"
                  id="position"
                  name="position"
                  value={formData.position}
                  onChange={handleChange}
                  placeholder="e.g., Manager, SDE, Team Lead"
                />
              </div>
            </div>

            <div className="mb-6">
              <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-1">Job Description</label>
              <textarea
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-white"
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows="5"
                required
                placeholder="Provide a detailed description of the job role"
              ></textarea>
              <p className="mt-1 text-sm text-gray-500">Provide a detailed description of the job role.</p>
            </div>
            
            <div className="mb-6">
              <label htmlFor="image" className="block text-sm font-medium text-gray-300 mb-1">Job Image</label>
              <div className="flex flex-col md:flex-row items-start gap-4">
                <div className="flex-1">
                  <input
                    type="file"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-white"
                    id="image"
                    accept="image/*"
                    onChange={handleImageChange}
                    disabled={isUploading}
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Upload an image to represent this job (max 20MB). Large images may take a moment to upload.
                  </p>
                </div>
                
                {imagePreview && (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Job preview"
                      className="h-40 w-40 object-cover rounded-lg border border-gray-700"
                    />
                    <button
                      type="button"
                      className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 focus:outline-none"
                      onClick={handleRemoveImage}
                      title="Remove image"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label htmlFor="requirements" className="block text-sm font-medium text-gray-300 mb-1">Requirements</label>
                <textarea
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-white"
                  id="requirements"
                  name="requirements"
                  value={formData.requirements}
                  onChange={handleChange}
                  rows="5"
                  placeholder="Enter each requirement on a new line"
                ></textarea>
                <p className="mt-1 text-sm text-gray-500">Enter each requirement on a new line.</p>
              </div>

              <div>
                <label htmlFor="responsibilities" className="block text-sm font-medium text-gray-300 mb-1">Responsibilities</label>
                <textarea
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-white"
                  id="responsibilities"
                  name="responsibilities"
                  value={formData.responsibilities}
                  onChange={handleChange}
                  rows="5"
                  placeholder="Enter each responsibility on a new line"
                ></textarea>
                <p className="mt-1 text-sm text-gray-500">Enter each responsibility on a new line.</p>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-medium text-white mb-4">HR Contact Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label htmlFor="hrName" className="block text-sm font-medium text-gray-300 mb-1">Name</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-white"
                    id="hrName"
                    value={formData.hrContact?.name || ''}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      hrContact: { ...prev.hrContact, name: e.target.value } 
                    }))}
                    placeholder="Enter HR name"
                  />
                </div>
                <div>
                  <label htmlFor="hrEmail" className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                  <input
                    type="email"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-white"
                    id="hrEmail"
                    value={formData.hrContact?.email || ''}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      hrContact: { ...prev.hrContact, email: e.target.value } 
                    }))}
                    placeholder="Enter HR email"
                  />
                </div>
                <div>
                  <label htmlFor="hrPhone" className="block text-sm font-medium text-gray-300 mb-1">Phone</label>
                  <input
                    type="tel"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-white"
                    id="hrPhone"
                    value={formData.hrContact?.phone || ''}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      hrContact: { ...prev.hrContact, phone: e.target.value } 
                    }))}
                    placeholder="Enter HR phone"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-between mt-8">
              <button
                type="button"
                onClick={handleCancel}
                disabled={isUploading}
                className={`px-6 py-3 font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${
                  isUploading 
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                    : 'bg-gray-700 text-white hover:bg-gray-600'
                }`}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isUploading}
                className={`px-6 py-3 font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-900 flex items-center gap-2 ${
                  isUploading 
                    ? 'bg-gray-600 text-gray-300 cursor-not-allowed' 
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {isUploading ? (
                  <>
                    {uploadProgress > 0 ? `Uploading... ${uploadProgress}%` : 'Uploading image...'}
                  </>
                ) : (
                  id ? 'Update Job' : 'Create Job'
                )}
              </button>
            </div>

            {/* Upload Progress Bar */}
            {isUploading && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm text-gray-300 mb-2">
                  <span>Uploading image to cloud storage...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out" 
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Please wait while we upload your image. This may take a moment for larger files.
                </p>
              </div>
            )}
          </form>
        </div>
      )}

      {activeTab === 'questions' && (
        <div className="bg-gray-900 rounded-lg shadow-lg p-8 border border-gray-800">
          {!id ? (
            <div className="bg-blue-900/30 border border-blue-500 text-blue-400 px-6 py-4 rounded-md">
              <p className="mb-4">Please save the job details first before adding application questions.</p>
              <p className="mb-4">After creating the job, you'll be able to define custom questions for applicants.</p>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={() => handleTabChange('details')}
              >
                Go to Job Details
              </button>
            </div>
          ) : (
            <JobQuestionManager
              jobId={id}
              onQuestionsChanged={handleQuestionsChanged}
            />
          )}
        </div>
      )}

      {activeTab === 'applications' && id && (
        <div className="bg-gray-900 rounded-lg shadow-lg p-8 border border-gray-800">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <h3 className="text-xl font-semibold text-white">Applications for this Job</h3>
            
            <div className="flex items-center space-x-2">
              <label htmlFor="filterStatus" className="text-gray-300 text-sm font-medium">
                Filter by Status:
              </label>
              <select
                id="filterStatus"
                className="bg-gray-800 border border-gray-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">All Applications</option>
                <option value="pending">Pending</option>
                <option value="reviewing">Reviewing</option>
                <option value="shortlisted">Shortlisted</option>
                <option value="offered">Offered</option>
                <option value="hired">Hired</option>
                <option value="rejected">Rejected</option>
              </select>
              
              <button
                className="bg-gray-800 border border-gray-700 hover:bg-gray-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                onClick={loadJobApplications}
                title="Refresh"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>

          {loadingApplications ? (
            <Loader text="Loading applications..." />
          ) : applications.length === 0 ? (
            <div className="bg-blue-900/30 border border-blue-500 text-blue-400 px-6 py-8 rounded-md text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-4 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-lg">No applications have been submitted for this job yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700">
                <thead>
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Applicant Name
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Email
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Applied On
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {applications
                    .filter(app => filterStatus === 'all' || app.status.toLowerCase() === filterStatus)
                    .map(app => (
                      <tr key={app._id} className="hover:bg-gray-800/50 transition">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                          {app.fullName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          {app.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(app.status)} text-white`}>
                            {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          {formatDate(app.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                          <button
                            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition"
                            onClick={() => navigate(`/applications/${app.slug || app._id}`)}
                          >
                            View Details
                          </button>
                          {app.resumeUrl && (
                            <button
                              className="px-3 py-1.5 bg-gray-700 text-white text-xs font-medium rounded hover:bg-gray-600 transition"
                             onClick={() => handleViewResume(app._id, app.resumeUrl)}

                            >
                              View Resume
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
    </div>
  );
};

export default JobForm;
