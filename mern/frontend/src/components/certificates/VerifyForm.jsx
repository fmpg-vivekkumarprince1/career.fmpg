import React, { useState, useEffect } from 'react';
import { certificateService } from '../../services/api';
import { format } from 'date-fns';

const normalizeCertificateId = (value = '') => value.trim();

const VerifyForm = ({ certificateId: propCertificateId }) => {
  const [certificateId, setCertificateId] = useState(propCertificateId || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [certificate, setCertificate] = useState(null);

  // Auto-verify when certificateId is provided via props
  useEffect(() => {
    if (propCertificateId && propCertificateId.trim()) {
      setCertificateId(normalizeCertificateId(propCertificateId));
      // Auto-verify the certificate
      verifyAutomatically(propCertificateId);
    }
  }, [propCertificateId]);

  const verifyAutomatically = async (id) => {
    const normalizedId = normalizeCertificateId(id);

    if (!normalizedId) {
      return;
    }

    setLoading(true);
    setError('');
    setCertificate(null);
    
    try {
      const response = await certificateService.verifyCertificate(normalizedId);
      setCertificate(response.data.certificate);
    } catch (err) {
      setError(err.response?.data?.message || 'Certificate verification failed');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setCertificateId(e.target.value);
    // Clear previous
    setError('');
    setCertificate(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const normalizedId = normalizeCertificateId(certificateId);
    if (!normalizedId) return;
    
    setCertificateId(normalizedId);
    await verifyAutomatically(normalizedId);
  };

  const handleDownload = async () => {
    try {
      const response = await certificateService.downloadCertificate(certificate._id);
      
      // Create blob URL and download
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `certificate-${certificate._id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback to window.open with full URL
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      window.open(`${API_URL}/api/certification/download/${certificate._id}`, '_blank');
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
      <div className="p-6 md:p-8">
        <h3 className="text-xl font-bold text-slate-900 mb-4">Verify Certificate</h3>
        
        {propCertificateId && (
          <div className="mb-4 p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 text-sm">
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-600 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              Certificate ID detected from QR code. Verifying automatically...
            </div>
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <label htmlFor="certificateId" className="block text-sm font-medium text-slate-700 mb-1.5">
              Certificate ID
            </label>
            <input
              id="certificateId"
              type="text"
              placeholder="Enter certificate ID, with or without FMPG prefix"
              value={certificateId}
              onChange={handleChange}
              required
              className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm placeholder:text-slate-400"
            />
            <p className="mt-2 text-xs text-slate-500">
              Example: <span className="text-slate-700 font-mono">FMPG-123...</span> or <span className="text-slate-700 font-mono">123...</span>
            </p>
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className={`px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl shadow-sm transition-colors ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {loading ? 'Verifying...' : 'Verify Certificate'}
          </button>
        </form>

        {error && (
          <div className="mt-5 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        {certificate && (
          <div className="mt-6 border border-emerald-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-emerald-50 px-5 py-3.5 border-b border-emerald-200 text-emerald-900">
              <div className="flex justify-between items-center">
                <h5 className="text-base font-semibold m-0">Certificate Verified Successfully</h5>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <div className="p-6 bg-white space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-y-1">
                <div className="text-slate-500 text-sm font-medium md:col-span-1">Certificate ID:</div>
                <div className="text-emerald-700 font-mono font-bold md:col-span-3 text-sm">FMPG-{certificate._id}</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-y-1">
                <div className="text-slate-500 text-sm font-medium md:col-span-1">Name:</div>
                <div className="text-slate-900 md:col-span-3 font-semibold text-sm">{certificate.name}</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-y-1">
                <div className="text-slate-500 text-sm font-medium md:col-span-1">Domain:</div>
                <div className="text-slate-800 md:col-span-3 text-sm">{certificate.domain}</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-y-1">
                <div className="text-slate-500 text-sm font-medium md:col-span-1">Duration:</div>
                <div className="text-slate-800 md:col-span-3 text-sm">
                  {format(new Date(certificate.fromDate), 'MMM dd, yyyy')} to {format(new Date(certificate.toDate), 'MMM dd, yyyy')}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-y-1">
                <div className="text-slate-500 text-sm font-medium md:col-span-1">Issued By:</div>
                <div className="text-slate-800 md:col-span-3 text-sm">{certificate.issuedBy}</div>
              </div>
              <div className="pt-4 mt-2 border-t border-slate-100">
                <button 
                  className="px-4 py-2 bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-50 rounded-xl text-sm font-medium transition-colors shadow-sm"
                  onClick={handleDownload}
                >
                  Download Certificate
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifyForm;