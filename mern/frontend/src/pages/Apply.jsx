import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import ReCAPTCHA from 'react-google-recaptcha';
import { motion, AnimatePresence } from 'framer-motion';
import { jobService, applicationService } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { ArrowLeft, MapPin, Briefcase, ChevronRight, Check, Upload, AlertCircle, Sparkles, FileText, CheckCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import Loader from '../components/common/Loader';
import JobQuestionAnswer from '../components/JobQuestionAnswer';
import { formatCurrencyValue } from '../utils/currencyUtils';

const FADE_VARIANTS = {
  enter: { opacity: 0, y: 10 },
  active: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 }
};

const Apply = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [job, setJob] = useState(null);
  const [jobQuestions, setJobQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    experience: '',
    education: '',
    skills: '',
    coverLetter: '',
    resume: null
  });
  const [questionAnswers, setQuestionAnswers] = useState([]);
  const [resumeUploaded, setResumeUploaded] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [, setError] = useState('');
  const [, setParseError] = useState('');
  const [, setParseSuccess] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const totalSteps = 4;
  const [recaptchaValue, setRecaptchaValue] = useState(null);
  const [existingApplication, setExistingApplication] = useState(null);
  const [focusedField, setFocusedField] = useState(null);
  const recaptchaRef = useRef(null);
  const lastFetchKeyRef = useRef('');

  // Prefetch JobsList component to make navigation instant
  useEffect(() => {
    const prefetch = () => import('./JobsList');
    prefetch().catch(() => {}); // SILENT catch
  }, []);

  useEffect(() => {
    if (!currentUser) {
      navigate('/login', { state: { from: `/apply/${slug}` } });
      return;
    }

    const userIdentity = currentUser?._id || currentUser?.email || 'unknown-user';
    const fetchKey = `${slug}:${userIdentity}`;
    if (lastFetchKeyRef.current === fetchKey) {
      return;
    }
    lastFetchKeyRef.current = fetchKey;

    let isActive = true;

    const fetchJobData = async () => {
      try {
        const jobResponse = await jobService.getJobById(slug);
        if (!isActive) return;
        const fetchedJob = jobResponse.data;
        setJob(fetchedJob);
        const actualJobId = fetchedJob._id;

        if (currentUser.email) {
          setFormData(prev => ({ ...prev, email: currentUser.email }));
        }

        if (currentUser.name) {
          setFormData(prev => ({ ...prev, fullName: currentUser.name }));
        }

        setLoadingQuestions(true);
        try {
          const questionsResponse = await jobService.getJobQuestions(actualJobId);
          if (!isActive) return;
          const questions = questionsResponse.data;

          const sortedQuestions = [...questions].sort((a, b) => a.order - b.order);
          setJobQuestions(sortedQuestions);

          const initialAnswers = sortedQuestions.map(question => ({
            questionId: question._id,
            questionText: question.questionText,
            questionType: question.questionType,
            answer: question.questionType === 'checkbox' ? [] : ''
          }));
          setQuestionAnswers(initialAnswers);
        } catch (err) {
          console.error("Error loading job questions:", err);
        } finally {
          setLoadingQuestions(false);
        }

        // Check if user has already applied for this job
        try {
          const statusResponse = await applicationService.checkApplicationStatus(actualJobId);
          if (!isActive) return;
          if (statusResponse.data.hasApplied) {
            setExistingApplication(statusResponse.data);
          }
        } catch (err) {
          console.error("Error checking application status:", err);
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Error loading job details');
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    fetchJobData();
    return () => {
      isActive = false;
    };
  }, [slug, currentUser?._id, currentUser?.email, navigate]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    // Special handling for phone number
    if (name === 'phone') {
      // Allow only digits and limit to 10 characters
      const phoneValue = value.replace(/\D/g, '').slice(0, 10);
      setFormData(prev => ({ ...prev, [name]: phoneValue }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }

    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setParseError('');
    setParseSuccess(false);

    setFormData(prev => ({ ...prev, resume: file }));
    setResumeUploaded(true);

    if (formErrors.resume) {
      setFormErrors(prev => ({ ...prev, resume: null }));
    }

    try {
      setParsing(true);
      const formDataForUpload = new FormData();
      formDataForUpload.append('resume', file);

      const response = await applicationService.parseResume(formDataForUpload);

      if (response.error) {
        toast.error(response.error);
        setParsing(false);
        return;
      }

      // Track what was successfully extracted
      const extractedFields = [];
      const updatedFormData = { ...formData, resume: file };

      // Only update fields that have meaningful content and don't overwrite existing user input
      if (response.data.fullName && response.data.fullName.trim() && !formData.fullName.trim()) {
        updatedFormData.fullName = response.data.fullName;
        extractedFields.push('name');
      }

      if (response.data.email && response.data.email.trim() && !formData.email.trim()) {
        updatedFormData.email = response.data.email;
        extractedFields.push('email');
      }

      if (response.data.phone && response.data.phone.trim() && !formData.phone.trim()) {
        updatedFormData.phone = response.data.phone;
        extractedFields.push('phone');
      }

      if (response.data.skills && response.data.skills.trim() && !formData.skills.trim()) {
        // Format skills as comma-separated if it's an array
        const skillsText = Array.isArray(response.data.skills)
          ? response.data.skills.join(', ')
          : response.data.skills;
        updatedFormData.skills = skillsText;
        extractedFields.push('skills');
      }

      if (response.data.education && response.data.education.trim() && !formData.education.trim()) {
        updatedFormData.education = response.data.education;
        extractedFields.push('education');
      }

      if (response.data.experience && response.data.experience.trim() && !formData.experience.trim()) {
        updatedFormData.experience = response.data.experience;
        extractedFields.push('experience');
      }

      setFormData(updatedFormData);

      // Show success message with details
      if (extractedFields.length > 0) {
        toast.success(`✓ Successfully extracted: ${extractedFields.join(', ')}`);
      } else {
        toast.info('Resume uploaded but no additional data could be extracted. Please fill the form manually.');
      }

    } catch (err) {
      console.error('Failed to parse resume:', err);

      // Handle different types of parsing errors
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        toast.error('Resume parsing is taking longer than expected. Please fill the form manually.');
      } else if (err.response?.status === 413) {
        toast.error('Resume file is too large for automatic parsing.');
      } else {
        toast.error('Could not automatically extract data from your resume.');
      }
    } finally {
      setParsing(false);
    }
  };


  const handleAnswerChange = useCallback((questionId, answer, file = null) => {
    setQuestionAnswers(prevAnswers => {
      const newAnswers = [...prevAnswers];
      const answerIndex = newAnswers.findIndex(a => a.questionId === questionId);

      if (answerIndex >= 0) {
        newAnswers[answerIndex] = { ...newAnswers[answerIndex], answer, fileUrl: file };
      } else {
        const question = jobQuestions.find(q => q._id === questionId);
        newAnswers.push({
          questionId,
          questionText: question?.questionText || '',
          questionType: question?.questionType || 'text',
          answer,
          fileUrl: file
        });
      }

      return newAnswers;
    });

    // Clear form error for this question if it exists
    const errorKey = `question_${questionId}`;
    if (formErrors[errorKey]) {
      setFormErrors(prev => ({ ...prev, [errorKey]: null }));
    }
  }, [jobQuestions, formErrors]);

  const handleRecaptchaChange = (value) => {
    setRecaptchaValue(value);
    if (formErrors.recaptcha) {
      setFormErrors(prev => ({ ...prev, recaptcha: null }));
    }
  };

  const handleRecaptchaExpired = () => {
    setRecaptchaValue(null);
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, totalSteps));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const validateStep = (step) => {
    const errors = {};
    let isValid = true;

    if (step === 1) {
      // Job overview is always valid
    }

    if (step === 2) {
      if (!formData.resume) {
        errors.resume = 'Resume is required';
        isValid = false;
      }
      if (!formData.fullName.trim()) {
        errors.fullName = 'Full name is required';
        isValid = false;
      }
      if (!formData.email.trim()) {
        errors.email = 'Email is required';
        isValid = false;
      }
      if (!formData.phone.trim()) {
        errors.phone = 'Phone number is required';
        isValid = false;
      } else if (!/^\d{10}$/.test(formData.phone.replace(/\D/g, ''))) {
        errors.phone = 'Phone number must be exactly 10 digits';
        isValid = false;
      }
    }

    if (step === 3) {
      // Background info is optional in this logic, but we can add more if needed
    }

    if (step === 4) {
      if (!formData.coverLetter.trim()) {
        errors.coverLetter = 'Cover letter is required';
        isValid = false;
      }
      if (!recaptchaValue) {
        errors.recaptcha = 'Please complete the reCAPTCHA';
        isValid = false;
      }

      jobQuestions.forEach(question => {
        if (question.required) {
          const answer = questionAnswers.find(a => a.questionId === question._id);
          if (!answer ||
            (typeof answer.answer === 'string' && !answer.answer.trim()) ||
            (Array.isArray(answer.answer) && answer.answer.length === 0) ||
            (answer.questionType === 'file' && !answer.fileUrl)) {
            errors[`question_${question._id}`] = 'This field is required';
            isValid = false;
          }
        }
      });
    }

    setFormErrors(errors);
    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (currentStep !== totalSteps) {
      nextStep();
      return;
    }

    if (!validateStep(totalSteps)) {
      const firstErrorField = document.querySelector('.border-red-500');
      if (firstErrorField) {
        firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    setSubmitting(true);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const applicationFormData = new FormData();
      applicationFormData.append('jobId', job?._id);
      applicationFormData.append('fullName', formData.fullName);
      applicationFormData.append('email', formData.email);
      applicationFormData.append('phone', formData.phone);
      applicationFormData.append('experience', formData.experience);
      applicationFormData.append('education', formData.education);
      applicationFormData.append('skills', formData.skills);
      applicationFormData.append('coverLetter', formData.coverLetter);
      applicationFormData.append('recaptchaToken', recaptchaValue);

      // Add referral data if provided
      if (formData.isReferred) {
        applicationFormData.append('isReferred', 'true');
        applicationFormData.append('referrerEmployeeId', formData.referrerEmployeeId);
        applicationFormData.append('referrerName', formData.referrerName);
        applicationFormData.append('referrerEmail', formData.referrerEmail);
        applicationFormData.append('referralMessage', formData.referralMessage);
      }

      if (formData.resume) {
        applicationFormData.append('resume', formData.resume);
      }

      if (questionAnswers.length > 0) {
        applicationFormData.append('questionAnswers', JSON.stringify(questionAnswers));
      }

      // Setup progress callback
      const onUploadProgress = (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        setUploadProgress(percentCompleted);
      };

      await applicationService.createApplication(applicationFormData, onUploadProgress);

      // Show success message
      toast.success('Application submitted successfully! You will receive updates via email.');

      // Clear form and reset state
      setFormData({
        fullName: '',
        email: '',
        phone: '',
        experience: '',
        education: '',
        skills: '',
        coverLetter: '',
        resume: null
      });
      setQuestionAnswers([]);
      setRecaptchaValue(null);
      if (recaptchaRef.current) {
        recaptchaRef.current.reset();
      }

      // Navigate to jobs page immediately upon success
      navigate('/jobs', { state: { success: true } });
    } catch (err) {
      console.error('Application submission error:', err);
      toast.error(err.response?.data?.message || 'Error submitting application. Please try again.');

    } finally {
      setSubmitting(false);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  if (loading) {
    return <Loader fullPage={true} />;
  }
  if (!job) {
    return <div className="text-center p-5">Job not found.</div>;
  }

  return (
    <div className="ui-page relative overflow-hidden">
      {/* Background Decorative Elements - Matching Home Page */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-100/60 rounded-full blur-[120px]" />
      </div>
      <Helmet>
        <title>{`Apply for ${job.title} at FMPG`}</title>
        <meta name="description" content={`Apply for the ${job.title} position at FMPG. Join our team building the future.`} />
      </Helmet>

      <div className="max-w-4xl mx-auto">
        {/* Header Section */}
        {currentStep === 1 && (
          <div className="mb-12">
            <Link 
              to="/jobs" 
              className="inline-flex items-center text-sm font-semibold text-slate-500 hover:text-emerald-700 transition-colors mb-6 group"
            >
              <ArrowLeft className="w-4 h-4 mr-2 transform group-hover:-translate-x-1 transition-transform" />
              Back to All Openings
            </Link>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h1 className="ui-page-title mb-6">
                  {job.title}
                </h1>
                <div className="flex flex-wrap items-center gap-4 text-gray-400">
                  <span className="flex items-center gap-1.5 bg-white px-4 py-2 rounded-full text-sm border border-slate-200">
                    <MapPin className="w-4 h-4 text-emerald-600" /> {job.location || 'Remote'}
                  </span>
                  <span className="flex items-center gap-1.5 bg-white px-4 py-2 rounded-full text-sm border border-slate-200">
                    <Briefcase className="w-4 h-4 text-emerald-600" /> {job.type || 'Full-time'}
                  </span>
                  <span className="flex items-center gap-1.5 bg-white px-4 py-2 rounded-full text-sm border border-slate-200">
                    <Sparkles className="w-4 h-4 text-emerald-600" /> {job.type === 'Internship' ? 'Stipend' : 'Salary'}: {formatCurrencyValue(job.salary)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stepper */}
        <div className="mb-12 relative z-10">
          <div className="flex items-center justify-between relative max-w-2xl mx-auto">
            <div className="absolute top-1/2 left-0 w-full h-[1px] bg-slate-200 -translate-y-1/2 z-0" />
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="relative z-10 flex flex-col items-center">
                <div 
                  className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                    currentStep === step 
                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' 
                      : currentStep > step 
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                        : 'bg-white border-slate-200 text-slate-400'
                  }`}
                >
                  {currentStep > step ? <Check className="w-6 h-6" /> : <span className="text-sm font-bold">{step}</span>}
                </div>
                <span className={`text-[10px] mt-3 font-bold uppercase tracking-[0.2em] transition-colors duration-300 ${currentStep === step ? 'text-lime-400' : 'text-gray-600'}`}>
                  {step === 1 ? 'Overview' : step === 2 ? 'Identity' : step === 3 ? 'Profile' : 'Review'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Form Card */}
        <div className="ui-card overflow-hidden relative z-10">
          <form onSubmit={handleSubmit} className="p-8 md:p-12">
            <AnimatePresence mode="wait">
              {currentStep === 1 && (
                <motion.div
                  key="step1"
                  initial="enter"
                  animate="active"
                  exit="exit"
                  variants={FADE_VARIANTS}
                  className="space-y-10"
                >
                  <div className="border-b border-gray-800/50 pb-6">
                    <h2 className="text-3xl font-bold text-white mb-2">Job <span className="text-lime-400">Overview</span></h2>
                    <p className="text-gray-400 text-base">Please review the position details before proceeding.</p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                      <h3 className="text-xl font-bold text-white flex items-center gap-3">
                        <div className="p-2 bg-lime-400/10 rounded-lg">
                          <FileText className="w-5 h-5 text-lime-400" />
                        </div>
                        Description
                      </h3>
                      <div className="text-gray-300 text-base leading-relaxed whitespace-pre-line bg-gray-950/50 p-8 rounded-2xl border border-gray-800/50">
                        {job.description}
                      </div>
                    </div>
                    <div className="space-y-6">
                      <h3 className="text-xl font-bold text-white flex items-center gap-3">
                        <div className="p-2 bg-lime-400/10 rounded-lg">
                          <CheckCircle className="w-5 h-5 text-lime-400" />
                        </div>
                        Requirements
                      </h3>
                      <div className="bg-gray-950/50 p-8 rounded-2xl border border-gray-800/50">
                        {Array.isArray(job.requirements) ? (
                          <ul className="space-y-4">
                            {job.requirements.map((req, index) => (
                              <li key={index} className="flex items-start gap-4 text-base text-gray-300">
                                <span className="mt-2.5 w-2 h-2 rounded-full bg-gradient-to-r from-lime-400 to-green-500 flex-shrink-0" />
                                {req}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-gray-300 text-base leading-relaxed">{job.requirements}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {currentStep === 2 && (
                <motion.div
                  key="step2"
                  initial="enter"
                  animate="active"
                  exit="exit"
                  variants={FADE_VARIANTS}
                  className="space-y-10"
                >
                  <div className="border-b border-gray-800/50 pb-6">
                    <h2 className="text-3xl font-bold text-white mb-2">Contact <span className="text-lime-400">Information</span></h2>
                    <p className="text-gray-400 text-base">Start by uploading your resume to pre-fill the form.</p>
                  </div>

                  {/* Resume Upload */}
                  <div className="space-y-4">
                    <label className="block text-sm font-bold uppercase tracking-widest text-gray-400">Resume Upload</label>
                    <div className={`relative group border-2 border-dashed rounded-3xl p-10 transition-all duration-500 ${
                      formData.resume ? 'border-lime-400 bg-lime-400/5' : 'border-gray-800 hover:border-lime-400/30 hover:bg-gray-800/50'
                    } ${formErrors.resume ? 'border-red-500/50 bg-red-500/5' : ''}`}>
                      <input
                        type="file"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        onChange={handleFileChange}
                        accept=".pdf,.doc,.docx"
                      />
                      <div className="text-center">
                        <div className={`mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-all duration-500 ${
                          formData.resume ? 'bg-lime-400 text-black shadow-lg shadow-lime-400/20' : 'bg-gray-800 text-gray-500 group-hover:text-lime-400'
                        }`}>
                          <Upload className="w-8 h-8" />
                        </div>
                        <p className="text-xl font-bold text-white mb-2">
                          {formData.resume ? formData.resume.name : 'Drop your resume here'}
                        </p>
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-[0.2em]">
                          {parsing ? 'Extracting Intelligence...' : 'PDF, DOCX, DOC • MAX 10MB'}
                        </p>
                      </div>
                      {parsing && (
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center rounded-3xl">
                          <div className="flex flex-col items-center">
                            <div className="w-12 h-12 border-4 border-lime-400 border-t-transparent rounded-full animate-spin mb-6" />
                            <p className="text-lime-400 font-black uppercase tracking-[0.3em] text-xs">Parsing Resume...</p>
                          </div>
                        </div>
                      )}
                    </div>
                    {formErrors.resume && <p className="text-red-500 text-xs font-bold uppercase tracking-widest flex items-center gap-2 mt-2"><AlertCircle className="w-4 h-4" /> {formErrors.resume}</p>}
                  </div>

                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="block text-sm font-bold uppercase tracking-widest text-gray-400">Full Name</label>
                      <input
                        type="text"
                        name="fullName"
                        value={formData.fullName}
                        onChange={handleChange}
                        className={`w-full bg-gray-950/50 border ${formErrors.fullName ? 'border-red-500/50' : 'border-gray-800 focus:border-lime-400'} rounded-2xl px-6 py-4 text-white focus:ring-4 focus:ring-lime-400/10 outline-none transition-all placeholder:text-gray-700`}
                        placeholder="John Doe"
                      />
                      {formErrors.fullName && <p className="text-red-500 text-[10px] font-bold uppercase tracking-widest mt-1">{formErrors.fullName}</p>}
                    </div>
                    <div className="space-y-3">
                      <label className="block text-sm font-bold uppercase tracking-widest text-gray-400">Email Address</label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className={`w-full bg-gray-950/50 border ${formErrors.email ? 'border-red-500/50' : 'border-gray-800 focus:border-lime-400'} rounded-2xl px-6 py-4 text-white focus:ring-4 focus:ring-lime-400/10 outline-none transition-all placeholder:text-gray-700`}
                        placeholder="john@example.com"
                      />
                      {formErrors.email && <p className="text-red-500 text-[10px] font-bold uppercase tracking-widest mt-1">{formErrors.email}</p>}
                    </div>
                    <div className="space-y-3">
                      <label className="block text-sm font-bold uppercase tracking-widest text-gray-400">Phone Number</label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        className={`w-full bg-gray-950/50 border ${formErrors.phone ? 'border-red-500/50' : 'border-gray-800 focus:border-lime-400'} rounded-2xl px-6 py-4 text-white focus:ring-4 focus:ring-lime-400/10 outline-none transition-all placeholder:text-gray-700`}
                        placeholder="+91 00000 00000"
                      />
                      {formErrors.phone && <p className="text-red-500 text-[10px] font-bold uppercase tracking-widest mt-1">{formErrors.phone}</p>}
                    </div>
                  </div>
                </motion.div>
              )}

              {currentStep === 3 && (
                <motion.div
                  key="step3"
                  initial="enter"
                  animate="active"
                  exit="exit"
                  variants={FADE_VARIANTS}
                  className="space-y-10"
                >
                  <div className="border-b border-gray-800/50 pb-6">
                    <h2 className="text-3xl font-bold text-white mb-2">Professional <span className="text-lime-400">Profile</span></h2>
                    <p className="text-gray-400 text-base">Your skills and background help us know you better.</p>
                  </div>

                  <div className="space-y-8">
                    <div className="space-y-3">
                      <label className="block text-sm font-bold uppercase tracking-widest text-gray-400">Skills (Comma separated)</label>
                      <textarea
                        name="skills"
                        value={formData.skills}
                        onChange={handleChange}
                        rows="3"
                        className="w-full bg-gray-950/50 border border-gray-800 rounded-2xl px-6 py-4 text-white focus:ring-4 focus:ring-lime-400/10 focus:border-lime-400 outline-none transition-all resize-none placeholder:text-gray-700"
                        placeholder="React, Node.js, TypeScript, UI Design..."
                      />
                    </div>

                    <div className="grid md:grid-cols-2 gap-8">
                      <div className="space-y-3">
                        <label className="block text-sm font-bold uppercase tracking-widest text-gray-400">Total Experience</label>
                        <textarea
                          name="experience"
                          value={formData.experience}
                          onChange={handleChange}
                          rows="4"
                          className="w-full bg-gray-950/50 border border-gray-800 rounded-2xl px-6 py-4 text-white focus:ring-4 focus:ring-lime-400/10 focus:border-lime-400 outline-none transition-all resize-none placeholder:text-gray-700"
                          placeholder="List your previous roles and key achievements..."
                        />
                      </div>
                      <div className="space-y-3">
                        <label className="block text-sm font-bold uppercase tracking-widest text-gray-400">Education</label>
                        <textarea
                          name="education"
                          value={formData.education}
                          onChange={handleChange}
                          rows="4"
                          className="w-full bg-gray-950/50 border border-gray-800 rounded-2xl px-6 py-4 text-white focus:ring-4 focus:ring-lime-400/10 focus:border-lime-400 outline-none transition-all resize-none placeholder:text-gray-700"
                          placeholder="Degrees, certifications, or relevant courses..."
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {currentStep === 4 && (
                <motion.div
                  key="step4"
                  initial="enter"
                  animate="active"
                  exit="exit"
                  variants={FADE_VARIANTS}
                  className="space-y-10"
                >
                  <div className="border-b border-gray-800/50 pb-6">
                    <h2 className="text-3xl font-bold text-white mb-2">Final <span className="text-lime-400">Review</span></h2>
                    <p className="text-gray-400 text-base">Almost there! Review your details and submit.</p>
                  </div>

                  <div className="space-y-10">
                    <div className="space-y-3">
                      <label className="block text-sm font-bold uppercase tracking-widest text-gray-400">Cover Letter</label>
                      <textarea
                        name="coverLetter"
                        value={formData.coverLetter}
                        onChange={handleChange}
                        rows="6"
                        className={`w-full bg-gray-950/50 border ${formErrors.coverLetter ? 'border-red-500/50' : 'border-gray-800 focus:border-lime-400'} rounded-2xl px-6 py-4 text-white focus:ring-4 focus:ring-lime-400/10 outline-none transition-all placeholder:text-gray-700`}
                        placeholder="Tell us why you are the best fit for this role..."
                      />
                      {formErrors.coverLetter && <p className="text-red-500 text-[10px] font-bold uppercase tracking-widest mt-1">{formErrors.coverLetter}</p>}
                    </div>

                    {/* Job Questions */}
                    {jobQuestions.length > 0 && (
                      <div className="space-y-8">
                        <h3 className="text-xl font-bold text-white border-l-4 border-lime-400 pl-4">Additional Questions</h3>
                        <div className="space-y-10">
                          {jobQuestions.map((question) => (
                            <JobQuestionAnswer
                              key={question._id}
                              question={question}
                              value={questionAnswers.find(a => a.questionId === question._id)}
                              onChange={handleAnswerChange}
                              error={formErrors[`question_${question._id}`]}
                              simple={true}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ReCAPTCHA */}
                    <div className="flex flex-col items-center p-10 bg-gray-950/50 rounded-3xl border border-gray-800/50 backdrop-blur-sm">
                      <ReCAPTCHA
                        ref={recaptchaRef}
                        sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
                        onChange={handleRecaptchaChange}
                        onExpired={handleRecaptchaExpired}
                        theme="dark"
                      />
                      {formErrors.recaptcha && <p className="text-red-500 text-[10px] font-bold uppercase tracking-widest mt-6">{formErrors.recaptcha}</p>}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form Actions */}
            <div className="flex items-center justify-between mt-16 pt-10 border-t border-gray-800/50">
              <button
                type="button"
                onClick={currentStep === 1 ? () => navigate('/jobs') : prevStep}
                className="px-8 py-4 text-sm font-bold uppercase tracking-[0.2em] text-gray-500 hover:text-white transition-all duration-300"
              >
                {currentStep === 1 ? 'Cancel' : 'Previous Step'}
              </button>
              
              <button
                type="submit"
                disabled={submitting}
                className="bg-gradient-to-r from-lime-400 to-green-500 hover:from-lime-500 hover:to-green-600 text-black font-black uppercase tracking-[0.1em] px-12 py-5 rounded-2xl transition-all shadow-xl shadow-lime-400/10 hover:shadow-lime-400/30 transform hover:translate-y-[-2px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {currentStep === totalSteps ? (submitting ? 'Submitting...' : 'Submit Application') : 'Continue'}
              </button>
            </div>
          </form>
        </div>
        {submitting && <div className="mt-5 flex justify-end"><Loader inline size="sm" text="Submitting application…" /></div>}
      </div>
    </div>
  );
};

export default Apply;