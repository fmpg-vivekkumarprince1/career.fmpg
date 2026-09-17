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
    <div className="bg-secondary-black rounded-lg shadow-md border border-dark-gray">
      <div className="p-6">
        <h3 className="text-xl font-semibold text-white mb-4">Verify Offer Letter</h3>
        
        {propOfferId && (
          <div className="mb-4 p-3 bg-blue-900/30 border border-blue-500/30 rounded-md text-blue-400">
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              Offer ID detected from QR code. Verifying automatically...
            </div>
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="offerId" className="block text-sm font-medium text-gray-300 mb-2">
              Offer Letter ID
            </label>
            <input
              id="offerId"
              type="text"
              placeholder="Enter offer letter ID (e.g. FMPG-OFF-...)"
              value={offerId}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-transparent"
            />
            <p className="mt-2 text-sm text-gray-400">
              Example: <span className="text-gray-300">FMPG-OFF-...</span> or <span className="text-gray-300">663...</span>
            </p>
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className={`px-4 py-2 bg-lime-400 hover:bg-lime-400 text-black font-medium rounded-md transition-colors ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {loading ? 'Verifying...' : 'Verify Offer Letter'}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-4 bg-red-900/30 border border-red-500/30 rounded-md text-red-400">
            {error}
          </div>
        )}

        {offer && (
          <div className="mt-6 border border-green-500/30 rounded-md overflow-hidden">
            <div className="bg-green-900/30 px-4 py-3 border-b border-green-500/30 text-green-400">
              <div className="flex justify-between items-center">
                <h5 className="text-lg font-semibold m-0">Offer Letter Verified Successfully</h5>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <div className="p-4 bg-secondary-black/50">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-y-3">
                <div className="text-gray-400 font-medium md:col-span-1">Reference ID:</div>
                <div className="text-lime-400 font-mono font-bold md:col-span-3">
                  FMPG-OFF-{offer.shortId || offer._id.toString().slice(-6).toUpperCase()}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-y-3 mt-3">
                <div className="text-gray-400 font-medium md:col-span-1">Candidate:</div>
                <div className="text-white md:col-span-3 font-semibold">{offer.candidateName}</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-y-3 mt-3">
                <div className="text-gray-400 font-medium md:col-span-1">Position:</div>
                <div className="text-white md:col-span-3">{offer.position}</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-y-3 mt-3">
                <div className="text-gray-400 font-medium md:col-span-1">Department:</div>
                <div className="text-white md:col-span-3">{offer.department}</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-y-3 mt-3">
                <div className="text-gray-400 font-medium md:col-span-1">Status:</div>
                <div className={`md:col-span-3 font-semibold ${
                  offer.status === 'Accepted' ? 'text-green-400' : 
                  offer.status === 'Rejected' ? 'text-red-400' : 'text-yellow-400'
                }`}>
                  {offer.status}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-y-3 mt-3">
                <div className="text-gray-400 font-medium md:col-span-1">Start Date:</div>
                <div className="text-white md:col-span-3">
                  {format(new Date(offer.startDate), 'MMM dd, yyyy')}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-y-3 mt-3">
                <div className="text-gray-400 font-medium md:col-span-1">Issued On:</div>
                <div className="text-white md:col-span-3">{format(new Date(offer.createdAt), 'MMM dd, yyyy')}</div>
              </div>
              <div className="mt-5">
                <button 
                  className="px-4 py-2 bg-transparent text-lime-400 border border-lime-400 hover:bg-lime-400/10 rounded-md text-sm font-medium transition-colors"
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
