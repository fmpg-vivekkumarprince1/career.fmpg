import React, { useState, useEffect } from 'react';
import { offerLetterService } from '../../services/api';
import { format } from 'date-fns';

const normalizeOfferId = (value = '') => value.trim();

const VerifyOfferLetterForm = ({ offerId: propOfferId }) => {
  const [offerId, setOfferId] = useState(propOfferId || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [offer, setOffer] = useState(null);

  // Auto-verify when offerId is provided via props
  useEffect(() => {
    if (propOfferId && propOfferId.trim()) {
      setOfferId(normalizeOfferId(propOfferId));
      // Auto-verify the offer letter
      verifyAutomatically(propOfferId);
    }
  }, [propOfferId]);

  const verifyAutomatically = async (id) => {
    const normalizedId = normalizeOfferId(id);

    if (!normalizedId) {
      return;
    }

    setLoading(true);
    setError('');
    setOffer(null);
    
    try {
      const response = await offerLetterService.verifyOfferLetter(normalizedId);
      setOffer(response.data.offerLetter);
    } catch (err) {
      setError(err.response?.data?.message || 'Offer letter verification failed');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setOfferId(e.target.value);
    // Clear previous
    setError('');
    setOffer(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const normalizedId = normalizeOfferId(offerId);
    if (!normalizedId) return;
    
    setOfferId(normalizedId);
    await verifyAutomatically(normalizedId);
  };

  const handleDownload = async () => {
    try {
      const response = await offerLetterService.downloadOfferLetter(offer._id);
      
      // Create blob URL and download
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `offer-letter-${offer._id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback to window.open with full URL
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4001';
      window.open(`${API_URL}/api/certification/offer-letters/${offer._id}/download`, '_blank');
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
      <div className="p-6 md:p-8">
        <h3 className="text-xl font-bold text-slate-900 mb-4">Verify Offer Letter</h3>
        
        {propOfferId && (
          <div className="mb-4 p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 text-sm">
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-600 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              Offer ID detected from QR code. Verifying automatically...
            </div>
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <label htmlFor="offerId" className="block text-sm font-medium text-slate-700 mb-1.5">
              Offer Letter ID
            </label>
            <input
              id="offerId"
              type="text"
              placeholder="Enter offer letter ID (e.g. FMPG-OFF-...)"
              value={offerId}
              onChange={handleChange}
              required
              className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm placeholder:text-slate-400"
            />
            <p className="mt-2 text-xs text-slate-500">
              Example: <span className="text-slate-700 font-mono">FMPG-OFF-...</span> or <span className="text-slate-700 font-mono">663...</span>
            </p>
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className={`px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl shadow-sm transition-colors ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {loading ? 'Verifying...' : 'Verify Offer Letter'}
          </button>
        </form>

        {error && (
          <div className="mt-5 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        {offer && (
          <div className="mt-6 border border-emerald-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-emerald-50 px-5 py-3.5 border-b border-emerald-200 text-emerald-900">
              <div className="flex justify-between items-center">
                <h5 className="text-base font-semibold m-0">Offer Letter Verified Successfully</h5>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <div className="p-6 bg-white space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-y-1">
                <div className="text-slate-500 text-sm font-medium md:col-span-1">Reference ID:</div>
                <div className="text-emerald-700 font-mono font-bold md:col-span-3 text-sm">
                  FMPG-OFF-{offer.shortId || offer._id.toString().slice(-6).toUpperCase()}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-y-1">
                <div className="text-slate-500 text-sm font-medium md:col-span-1">Candidate:</div>
                <div className="text-slate-900 md:col-span-3 font-semibold text-sm">{offer.candidateName}</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-y-1">
                <div className="text-slate-500 text-sm font-medium md:col-span-1">Position:</div>
                <div className="text-slate-800 md:col-span-3 text-sm">{offer.position}</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-y-1">
                <div className="text-slate-500 text-sm font-medium md:col-span-1">Department:</div>
                <div className="text-slate-800 md:col-span-3 text-sm">{offer.department}</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-y-1">
                <div className="text-slate-500 text-sm font-medium md:col-span-1">Status:</div>
                <div className="md:col-span-3 text-sm font-semibold">
                  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    offer.status === 'Accepted' ? 'bg-emerald-100 text-emerald-800' : 
                    offer.status === 'Rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {offer.status}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-y-1">
                <div className="text-slate-500 text-sm font-medium md:col-span-1">Start Date:</div>
                <div className="text-slate-800 md:col-span-3 text-sm">
                  {format(new Date(offer.startDate), 'MMM dd, yyyy')}
                </div>
              </div>
              <div className="pt-4 mt-2 border-t border-slate-100">
                <button 
                  className="px-4 py-2 bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-50 rounded-xl text-sm font-medium transition-colors shadow-sm"
                  onClick={handleDownload}
                >
                  Download Offer Letter
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifyOfferLetterForm;
