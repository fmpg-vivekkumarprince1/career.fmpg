import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { contractService } from '../services/api';
import { formatCurrencyValue } from '../utils/currencyUtils';
import { toast } from 'react-toastify';
import Loader from '../components/common/Loader';

const OfferAcceptance = () => {
  const { jobSlug, slug } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [offerLetter, setOfferLetter] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  const [step, setStep] = useState(1); // 1: Review Offer, 2: Personal Info, 3: Banking Info, 4: Documents
  const [acceptanceDecision, setAcceptanceDecision] = useState(''); // 'accept' or 'reject'
  
  // Form data
  const [formData, setFormData] = useState({
    phone: '',
    personalInfo: {
      dateOfBirth: '',
      nationality: 'Indian',
      address: {
        street: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'India'
      },
      emergencyContact: {
        name: '',
        relationship: '',
        phone: '',
        email: ''
      },
      identificationDocuments: {
        idType: 'Aadhar',
        idNumber: ''
      }
    },
    bankingInfo: {
      accountHolderName: '',
      accountNumber: '',
      bankName: '',
      ifscCode: '',
      accountType: 'Savings',
      branch: ''
    },
    acceptanceComments: '',
    agreementTerms: {
      termsAccepted: false,
      privacyPolicyAccepted: false
    }
  });
  
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    if (slug) {
      loadOfferDetails();
    }
  }, [slug]);

  const loadOfferDetails = async () => {
    try {
      setLoading(true);
      setError('');
      // In this system, 'slug' from the URL is the application slug
      const response = await contractService.getOfferForAcceptance(slug);
      
      setOfferLetter(response.offerLetter);
      
      // Pre-fill form with offer letter data
      setFormData(prev => ({
        ...prev,
        bankingInfo: {
          ...prev.bankingInfo,
          accountHolderName: response.offerLetter.candidateName
        }
      }));
      
    } catch (err) {
      toast.error(err.message || 'Failed to load offer details');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (path, value) => {
    setFormData(prev => {
      const newData = { ...prev };
      const keys = path.split('.');
      let current = newData;
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return newData;
    });
  };

  const validateStep = (stepNumber) => {
    switch (stepNumber) {
      case 2:
        const { personalInfo, phone } = formData;
        return phone && 
               personalInfo.dateOfBirth && 
               personalInfo.nationality &&
               personalInfo.address.street &&
               personalInfo.address.city &&
               personalInfo.address.state &&
               personalInfo.address.zipCode &&
               personalInfo.emergencyContact.name &&
               personalInfo.emergencyContact.relationship &&
               personalInfo.emergencyContact.phone &&
               personalInfo.identificationDocuments.idType &&
               personalInfo.identificationDocuments.idNumber;
      case 3:
        const { bankingInfo } = formData;
        return bankingInfo.accountHolderName &&
               bankingInfo.accountNumber &&
               bankingInfo.bankName &&
               bankingInfo.ifscCode &&
               bankingInfo.accountType &&
               bankingInfo.branch;
      case 4:
        return formData.agreementTerms.termsAccepted && 
               formData.agreementTerms.privacyPolicyAccepted;
      default:
        return true;
    }
  };

  const handleAcceptOffer = async () => {
    if (!validateStep(4)) {
      toast.error('Please complete all required fields and accept the terms');
      return;
    }
    
    try {
      setSubmitting(true);
      setError('');
      
      const contractData = {
        ...formData,
        agreementTerms: {
          ...formData.agreementTerms,
          acceptedAt: new Date(),
          ipAddress: 'client-ip' // In real app, get actual IP
        }
      };
      
      const response = await contractService.acceptOffer(slug, contractData);
      
      toast.success('Offer accepted successfully! Redirecting to home page...');
      
      // Navigate to home page with success message after delay
      setTimeout(() => {
        navigate('/', { 
          state: { 
            successMessage: 'Offer accepted successfully! Your application is now under review. You will receive updates via email.',
            contractId: response.contractId,
            candidateName: offerLetter.candidateName 
          } 
        });
      }, 2000);
      
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to accept offer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectOffer = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }
    
    try {
      setSubmitting(true);
      setError('');
      
      await contractService.rejectOffer(slug, { rejectionReason });
      
      toast.success('Offer rejected successfully. Thank you for your consideration.');
      
      // Navigate away after delay
      setTimeout(() => {
        navigate('/');
      }, 3000);
      
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to reject offer');
    } finally {
      setSubmitting(false);
    }
  };

  const nextStep = () => {
    if (validateStep(step)) {
      setStep(step + 1);
    } else {
      toast.error('Please complete all required fields before proceeding');
    }
  };

  const prevStep = () => {
    setStep(step - 1);
  };

  if (loading) {
    return null;
  }

  if (error && !offerLetter) {
    return (
      <div className="ui-page flex items-center justify-center">
        <div className="ui-card max-w-md w-full p-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-400 mb-4">Error</h1>
            <p className="text-slate-600 mb-6">{error || 'Failed to load offer details'}</p>
            <button 
              onClick={() => navigate('/')}
              className="px-6 py-2.5 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors shadow-sm"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!offerLetter) {
    return null;
  }

  return (
    <div className="ui-page">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="ui-card p-6 mb-6 py-10">
          <div className="text-center">
            <span className="fmpg-kicker">Employment offer</span>
            <h1 className="ui-page-title mt-3 mb-2">Respond to your offer</h1>
            <p className="text-slate-600">
              Offer from {offerLetter.companyName || 'FMPG'}
            </p>
          </div>
        </div>

        {/* Header */}

        {/* Main Content */}
        <div className="ui-card">
          {step === 1 && (
          <OfferReviewStep 
              offerLetter={offerLetter}
              onAccept={() => {
                setAcceptanceDecision('accept');
                nextStep();
              }}
              onReject={() => setAcceptanceDecision('reject')}
              onCancel={() => setAcceptanceDecision('')}
              rejectionReason={rejectionReason}
              setRejectionReason={setRejectionReason}
              onSubmitRejection={handleRejectOffer}
              submitting={submitting}
              acceptanceDecision={acceptanceDecision}
            />
          )}

          {step === 2 && acceptanceDecision === 'accept' && (
            <PersonalInfoStep 
              formData={formData}
              onChange={handleInputChange}
              onNext={nextStep}
              onPrev={prevStep}
            />
          )}

          {step === 3 && acceptanceDecision === 'accept' && (
            <BankingInfoStep 
              formData={formData}
              onChange={handleInputChange}
              onNext={nextStep}
              onPrev={prevStep}
            />
          )}

          {step === 4 && acceptanceDecision === 'accept' && (
            <FinalStep 
              formData={formData}
              onChange={handleInputChange}
              onSubmit={handleAcceptOffer}
              onPrev={prevStep}
              submitting={submitting}
              offerLetter={offerLetter}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// Step Components
const OfferReviewStep = ({ 
  offerLetter, 
  onAccept, 
  onReject, 
  onCancel,
  rejectionReason, 
  setRejectionReason, 
  onSubmitRejection, 
  submitting,
  acceptanceDecision 
}) => (
  <div className="p-6 md:p-8">
    <h2 className="text-2xl font-bold text-slate-900 mb-6">Review Your Job Offer</h2>
    
    {/* Offer Details */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 bg-slate-50 border border-slate-200 rounded-2xl p-6">
      <div className="space-y-4">
        <div>
          <label className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Position</label>
          <p className="text-slate-900 font-semibold text-base mt-0.5">{offerLetter.position}</p>
        </div>
        <div>
          <label className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Department</label>
          <p className="text-slate-800 text-base mt-0.5">{offerLetter.department}</p>
        </div>
        <div>
          <label className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
            {(offerLetter.offerType === 'Internship' || offerLetter.position?.toLowerCase().includes('intern')) ? 'Monthly Stipend (₹)' : 'Annual Salary (₹)'}
          </label>
          <p className="text-slate-900 font-semibold text-base mt-0.5">
            {formatCurrencyValue(offerLetter.salary)}
            {(offerLetter.offerType === 'Internship' && offerLetter.payoutFrequency) && ` (${offerLetter.payoutFrequency})`}
          </p>
        </div>
        <div>
          <label className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Work Type</label>
          <p className="text-slate-800 text-base mt-0.5">{offerLetter.workType}</p>
        </div>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Start Date</label>
          <p className="text-slate-900 font-medium text-base mt-0.5">{new Date(offerLetter.startDate).toLocaleDateString()}</p>
        </div>
        <div>
          <label className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Location</label>
          <p className="text-slate-800 text-base mt-0.5">{offerLetter.joiningLocation}</p>
        </div>
        <div>
          <label className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Valid Until</label>
          <p className="text-slate-800 text-base mt-0.5">{new Date(offerLetter.validUntil).toLocaleDateString()}</p>
        </div>
        {offerLetter.reportingManager && (
          <div>
            <label className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Reporting Manager</label>
            <p className="text-slate-800 text-base mt-0.5">{offerLetter.reportingManager}</p>
          </div>
        )}
      </div>
    </div>

    {offerLetter.benefits && offerLetter.benefits.length > 0 && (
      <div className="mb-8">
        <label className="text-slate-500 text-xs font-semibold uppercase tracking-wider block mb-2">Benefits</label>
        <div className="flex flex-wrap gap-2">
          {offerLetter.benefits.map((benefit, index) => (
            <span 
              key={index}
              className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-sm font-medium rounded-full"
            >
              {benefit}
            </span>
          ))}
        </div>
      </div>
    )}

    {acceptanceDecision === 'reject' && (
      <div className="mb-6">
        <label className="block text-slate-700 text-sm font-medium mb-2">
          Reason for Rejection *
        </label>
        <textarea
          value={rejectionReason}
          onChange={(e) => setRejectionReason(e.target.value)}
          rows="4"
          className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 shadow-sm placeholder:text-slate-400"
          placeholder="Please provide a reason for declining this offer..."
          required
        />
      </div>
    )}

    {/* Action Buttons */}
    <div className="flex gap-4">
      {acceptanceDecision === '' && (
        <>
          <button
            onClick={onAccept}
            className="flex-1 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl shadow-sm transition-colors"
          >
            Accept Offer
          </button>
          <button
            onClick={onReject}
            className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl shadow-sm transition-colors"
          >
            Decline Offer
          </button>
        </>
      )}
      
      {acceptanceDecision === 'reject' && (
        <div className="flex gap-4 w-full">
          <button
            onClick={onCancel}
            className="px-6 py-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-medium rounded-xl shadow-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSubmitRejection}
            disabled={submitting || !rejectionReason.trim()}
            className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl shadow-sm transition-colors disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Confirm Rejection'}
          </button>
        </div>
      )}
    </div>
  </div>
);

const PersonalInfoStep = ({ formData, onChange, onNext, onPrev }) => (
  <div className="p-6 md:p-8">
    <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Personal Information</h2>
        <p className="text-sm text-slate-500 mt-1">Please provide your contact and identification details</p>
      </div>
      <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-full border border-slate-200">
        Step 2 of 4
      </span>
    </div>
    
    <div className="space-y-6">
      {/* Contact Information */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
        <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
          Contact Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-700 text-sm font-medium mb-1.5">
              Phone Number *
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => onChange('phone', e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm placeholder:text-slate-400"
              placeholder="+91 9876543210"
              required
            />
          </div>
          
          <div>
            <label className="block text-slate-700 text-sm font-medium mb-1.5">
              Date of Birth *
            </label>
            <input
              type="date"
              value={formData.personalInfo.dateOfBirth}
              onChange={(e) => onChange('personalInfo.dateOfBirth', e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm placeholder:text-slate-400"
              required
            />
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-slate-700 text-sm font-medium mb-1.5">
              Nationality *
            </label>
            <input
              type="text"
              value={formData.personalInfo.nationality}
              onChange={(e) => onChange('personalInfo.nationality', e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm placeholder:text-slate-400"
              required
            />
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
        <h3 className="text-base font-semibold text-slate-900 mb-4">Address</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-slate-700 text-sm font-medium mb-1.5">
              Street Address *
            </label>
            <input
              type="text"
              value={formData.personalInfo.address.street}
              onChange={(e) => onChange('personalInfo.address.street', e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm placeholder:text-slate-400"
              placeholder="123 Main Street, Apartment/Unit Number"
              required
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-700 text-sm font-medium mb-1.5">
                City *
              </label>
              <input
                type="text"
                value={formData.personalInfo.address.city}
                onChange={(e) => onChange('personalInfo.address.city', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm placeholder:text-slate-400"
                required
              />
            </div>
            
            <div>
              <label className="block text-slate-700 text-sm font-medium mb-1.5">
                State *
              </label>
              <input
                type="text"
                value={formData.personalInfo.address.state}
                onChange={(e) => onChange('personalInfo.address.state', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm placeholder:text-slate-400"
                required
              />
            </div>
            
            <div>
              <label className="block text-slate-700 text-sm font-medium mb-1.5">
                ZIP/Postal Code *
              </label>
              <input
                type="text"
                value={formData.personalInfo.address.zipCode}
                onChange={(e) => onChange('personalInfo.address.zipCode', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm placeholder:text-slate-400"
                required
              />
            </div>
          </div>
        </div>
      </div>

      {/* Emergency Contact */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
        <h3 className="text-base font-semibold text-slate-900 mb-4">Emergency Contact</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-700 text-sm font-medium mb-1.5">
              Full Name *
            </label>
            <input
              type="text"
              value={formData.personalInfo.emergencyContact.name}
              onChange={(e) => onChange('personalInfo.emergencyContact.name', e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm placeholder:text-slate-400"
              required
            />
          </div>
          
          <div>
            <label className="block text-slate-700 text-sm font-medium mb-1.5">
              Relationship *
            </label>
            <select
              value={formData.personalInfo.emergencyContact.relationship}
              onChange={(e) => onChange('personalInfo.emergencyContact.relationship', e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm"
              required
            >
              <option value="">Select Relationship</option>
              <option value="Spouse">Spouse</option>
              <option value="Parent">Parent</option>
              <option value="Sibling">Sibling</option>
              <option value="Friend">Friend</option>
              <option value="Other">Other</option>
            </select>
          </div>
          
          <div>
            <label className="block text-slate-700 text-sm font-medium mb-1.5">
              Phone Number *
            </label>
            <input
              type="tel"
              value={formData.personalInfo.emergencyContact.phone}
              onChange={(e) => onChange('personalInfo.emergencyContact.phone', e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm placeholder:text-slate-400"
              required
            />
          </div>
          
          <div>
            <label className="block text-slate-700 text-sm font-medium mb-1.5">
              Email (Optional)
            </label>
            <input
              type="email"
              value={formData.personalInfo.emergencyContact.email}
              onChange={(e) => onChange('personalInfo.emergencyContact.email', e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>

      {/* Identification Documents */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
        <h3 className="text-base font-semibold text-slate-900 mb-4">Identification</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-700 text-sm font-medium mb-1.5">
              ID Type *
            </label>
            <select
              value={formData.personalInfo.identificationDocuments.idType}
              onChange={(e) => onChange('personalInfo.identificationDocuments.idType', e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm"
              required
            >
              <option value="Aadhar">Aadhar Card</option>
              <option value="PAN">PAN Card</option>
              <option value="Passport">Passport</option>
              <option value="Driving License">Driving License</option>
              <option value="Voter ID">Voter ID</option>
            </select>
          </div>
          
          <div>
            <label className="block text-slate-700 text-sm font-medium mb-1.5">
              ID Number *
            </label>
            <input
              type="text"
              value={formData.personalInfo.identificationDocuments.idNumber}
              onChange={(e) => onChange('personalInfo.identificationDocuments.idNumber', e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm placeholder:text-slate-400"
              required
            />
          </div>
        </div>
      </div>
    </div>

    {/* Navigation */}
    <div className="flex gap-4 mt-8">
      <button
        onClick={onPrev}
        className="px-6 py-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-medium rounded-xl shadow-sm transition-colors"
      >
        Previous
      </button>
      <button
        onClick={onNext}
        className="flex-1 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl shadow-sm transition-colors"
      >
        Next: Banking Information
      </button>
    </div>
  </div>
);

const BankingInfoStep = ({ formData, onChange, onNext, onPrev }) => (
  <div className="p-6 md:p-8">
    <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Banking Information</h2>
        <p className="text-sm text-slate-500 mt-1">Provide account details for payroll and compensation processing</p>
      </div>
      <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-full border border-slate-200">
        Step 3 of 4
      </span>
    </div>
    
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div>
            <h3 className="text-blue-900 font-semibold text-sm">Secure Banking Information</h3>
            <p className="text-blue-800 text-xs mt-1 leading-relaxed">
              Your banking details are stored encrypted and treated with strict confidentiality. This account will be credited for your monthly salary / stipend.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-slate-700 text-sm font-medium mb-1.5">
              Account Holder Name *
            </label>
            <input
              type="text"
              value={formData.bankingInfo.accountHolderName}
              onChange={(e) => onChange('bankingInfo.accountHolderName', e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm placeholder:text-slate-400"
              placeholder="As per bank records"
              required
            />
          </div>
          
          <div>
            <label className="block text-slate-700 text-sm font-medium mb-1.5">
              Account Type *
            </label>
            <select
              value={formData.bankingInfo.accountType}
              onChange={(e) => onChange('bankingInfo.accountType', e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm"
              required
            >
              <option value="Savings">Savings Account</option>
              <option value="Current">Current Account</option>
            </select>
          </div>
          
          <div>
            <label className="block text-slate-700 text-sm font-medium mb-1.5">
              Account Number *
            </label>
            <input
              type="text"
              value={formData.bankingInfo.accountNumber}
              onChange={(e) => onChange('bankingInfo.accountNumber', e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm placeholder:text-slate-400"
              placeholder="Enter account number"
              required
            />
          </div>
          
          <div>
            <label className="block text-slate-700 text-sm font-medium mb-1.5">
              IFSC Code *
            </label>
            <input
              type="text"
              value={formData.bankingInfo.ifscCode}
              onChange={(e) => onChange('bankingInfo.ifscCode', e.target.value.toUpperCase())}
              className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm placeholder:text-slate-400 uppercase font-mono"
              placeholder="e.g., SBIN0001234"
              required
            />
          </div>
          
          <div>
            <label className="block text-slate-700 text-sm font-medium mb-1.5">
              Bank Name *
            </label>
            <input
              type="text"
              value={formData.bankingInfo.bankName}
              onChange={(e) => onChange('bankingInfo.bankName', e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm placeholder:text-slate-400"
              placeholder="e.g., State Bank of India"
              required
            />
          </div>
          
          <div>
            <label className="block text-slate-700 text-sm font-medium mb-1.5">
              Branch Name *
            </label>
            <input
              type="text"
              value={formData.bankingInfo.branch}
              onChange={(e) => onChange('bankingInfo.branch', e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm placeholder:text-slate-400"
              placeholder="e.g., Mumbai Main Branch"
              required
            />
          </div>
        </div>
      </div>
    </div>

    {/* Navigation */}
    <div className="flex gap-4 mt-8">
      <button
        onClick={onPrev}
        className="px-6 py-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-medium rounded-xl shadow-sm transition-colors"
      >
        Previous
      </button>
      <button
        onClick={onNext}
        className="flex-1 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl shadow-sm transition-colors"
      >
        Next: Review & Submit
      </button>
    </div>
  </div>
);

const FinalStep = ({ formData, onChange, onSubmit, onPrev, submitting, offerLetter }) => (
  <div className="p-6 md:p-8">
    <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Review & Submit</h2>
        <p className="text-sm text-slate-500 mt-1">Review your response before confirming your offer acceptance</p>
      </div>
      <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-full border border-slate-200">
        Step 4 of 4
      </span>
    </div>
    
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
        <h3 className="text-base font-semibold text-slate-900 mb-4">Application Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl">
            <span className="text-slate-500 font-medium">Position:</span>
            <span className="text-slate-900 font-semibold">{offerLetter.position}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl">
            <span className="text-slate-500 font-medium">Start Date:</span>
            <span className="text-slate-900 font-semibold">{new Date(offerLetter.startDate).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl">
            <span className="text-slate-500 font-medium">Phone:</span>
            <span className="text-slate-900 font-semibold">{formData.phone}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl">
            <span className="text-slate-500 font-medium">Bank:</span>
            <span className="text-slate-900 font-semibold">{formData.bankingInfo.bankName}</span>
          </div>
        </div>
      </div>

      {/* Optional Comments */}
      <div>
        <label className="block text-slate-700 text-sm font-medium mb-1.5">
          Additional Comments (Optional)
        </label>
        <textarea
          value={formData.acceptanceComments}
          onChange={(e) => onChange('acceptanceComments', e.target.value)}
          rows="3"
          className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm placeholder:text-slate-400"
          placeholder="Any additional notes or questions for the HR team..."
        />
      </div>

      {/* Terms and Conditions */}
      <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-2xl p-5">
        <div className="flex items-start">
          <input
            type="checkbox"
            id="terms"
            checked={formData.agreementTerms.termsAccepted}
            onChange={(e) => onChange('agreementTerms.termsAccepted', e.target.checked)}
            className="mt-1 mr-3 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            required
          />
          <label htmlFor="terms" className="text-slate-700 text-sm leading-relaxed select-none cursor-pointer">
            I agree to the <span className="text-emerald-700 font-semibold hover:underline">Terms and Conditions</span> of employment *
          </label>
        </div>
        
        <div className="flex items-start">
          <input
            type="checkbox"
            id="privacy"
            checked={formData.agreementTerms.privacyPolicyAccepted}
            onChange={(e) => onChange('agreementTerms.privacyPolicyAccepted', e.target.checked)}
            className="mt-1 mr-3 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            required
          />
          <label htmlFor="privacy" className="text-slate-700 text-sm leading-relaxed select-none cursor-pointer">
            I agree to the <span className="text-emerald-700 font-semibold hover:underline">Privacy Policy</span> *
          </label>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div>
            <h3 className="text-amber-900 font-semibold text-sm">Important Notice</h3>
            <p className="text-amber-800 text-xs mt-1 leading-relaxed">
              By submitting this form, you are officially accepting the job offer. Your details will be processed by HR and you will receive onboarding updates via email.
            </p>
          </div>
        </div>
      </div>
    </div>

    {/* Navigation */}
    <div className="flex gap-4 mt-8">
      <button
        onClick={onPrev}
        className="px-6 py-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-medium rounded-xl shadow-sm transition-colors"
        disabled={submitting}
      >
        Previous
      </button>
      <button
        onClick={onSubmit}
        disabled={submitting || !formData.agreementTerms.termsAccepted || !formData.agreementTerms.privacyPolicyAccepted}
        className="flex-1 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? 'Submitting...' : 'Accept Offer & Submit'}
      </button>
    </div>
  </div>
);

export default OfferAcceptance;
