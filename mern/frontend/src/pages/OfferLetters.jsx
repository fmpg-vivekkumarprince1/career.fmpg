import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { offerLetterService } from '../services/api';
import OfferLetterForm from '../components/certificates/OfferLetterForm';
import OfferLetterList from '../components/certificates/OfferLetterList';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Loader from '../components/common/Loader';

const OfferLetters = () => {
  const [activeTab, setActiveTab] = useState('list');
  const [loading, setLoading] = useState(false);
  const [offerLetters, setOfferLetters] = useState([]);
  const navigate = useNavigate();
  const { currentUser, isAdmin, isHR } = useAuth();

  useEffect(() => {
    if (!currentUser || (!isAdmin && !isHR)) {
      navigate('/login', { state: { message: "You must have admin access to access this page" } });
      return;
    }
    
    fetchOfferLetters();
  }, [navigate, currentUser]);

  const fetchOfferLetters = async () => {
    setLoading(true);
    try {
      const response = await offerLetterService.getAllOfferLetters();
      setOfferLetters(response.data);
    } catch (err) {
      toast.error('Failed to fetch offer letters');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleIssueOfferLetter = async (offerData) => {
    setLoading(true);
    
    try {
      console.log('Issuing offer letter with data:', offerData);
      const response = await offerLetterService.issueOfferLetter(offerData);
      toast.success('Offer letter issued successfully!');
      
      // Refresh the list immediately
      try {
        await fetchOfferLetters();
      } catch (fetchErr) {
        console.warn('Failed to refresh offer letters:', fetchErr);
      }
      
      // Switch to list tab to show the new offer letter
      setActiveTab('list');

      // Send email automatically in an isolated try-catch so email latency/timeout never marks the creation as failed
      if (offerData.email) {
        try {
          console.log('Sending offer letter email to:', offerData.email);
          await offerLetterService.sendOfferLetterEmail(response.data.offerLetterId, {
            recipientEmail: offerData.email
          });
          toast.success('Offer letter issued and emailed successfully!');
        } catch (emailErr) {
          console.warn('Auto email dispatch timed out or failed:', emailErr);
          toast.warning('Offer letter created! However, email delivery took longer than expected. You can resend it anytime from the list.');
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to issue offer letter');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadOfferLetter = async (id) => {
    try {
      console.log('Downloading offer letter:', id);
      const response = await offerLetterService.downloadOfferLetter(id);
      
      // Create blob and download
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `offer-letter-${id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Offer letter downloaded successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to download offer letter');
      console.error('Error:', err);
    }
  };

  const handleSendOfferLetterEmail = async (id, email) => {
    try {
      console.log('Sending offer letter email:', id, email);
      await offerLetterService.sendOfferLetterEmail(id, {
        recipientEmail: email
      });
      toast.success('Offer letter emailed successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to email offer letter');
      console.error('Error:', err);
    }
  };

  const handleUpdateOfferLetterStatus = async (id, status) => {
    try {
      console.log('Updating offer letter status:', id, status);
      await offerLetterService.updateOfferLetterStatus(id, status);
      toast.success(`Offer letter marked as ${status.toLowerCase()}!`);
      
      // Refresh the list
      await fetchOfferLetters();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update offer letter status');
      console.error('Error:', err);
    }
  };

  const handleExtendOfferLetter = async (id, extensionData) => {
    try {
      console.log('Extending offer letter:', id, extensionData);
      await offerLetterService.extendOfferLetter(id, extensionData);
      toast.success('Offer letter extended successfully!');
      
      // Refresh the list
      await fetchOfferLetters();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to extend offer letter');
      console.error('Error:', err);
      throw err; // Re-throw to let the modal handle it
    }
  };

  const handleDeleteOfferLetter = async (id) => {
    try {
      console.log('Deleting offer letter:', id);
      await offerLetterService.deleteOfferLetter(id);
      toast.success('Offer letter deleted successfully!');
      setOfferLetters(prev => prev.filter(o => o._id !== id));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete offer letter');
      console.error('Error deleting offer letter:', err);
    }
  };

  return (
    <div className="ui-page">
      <div className="ui-content">
        <div className="ui-page-header">
          <span className="fmpg-kicker">Hiring documents</span>
          <h1 className="ui-page-title mt-3">Offer letters</h1>
          <p className="ui-page-subtitle">Create and track employment offers from one workspace.</p>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-8">
          <div className="flex space-x-4 border-b border-slate-200">
            <button
              onClick={() => setActiveTab('list')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'list'
                  ? 'text-emerald-700 border-b-2 border-emerald-600'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              All Offer Letters
            </button>
            <button
              onClick={() => setActiveTab('issue')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'issue'
                  ? 'text-emerald-700 border-b-2 border-emerald-600'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Issue New Offer Letter
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-8 relative min-h-[400px]">
          {loading && <Loader text="Synchronizing offer data…" />}
          
          {!loading && activeTab === 'list' && (
            <OfferLetterList 
              offerLetters={offerLetters}
              loading={loading}
              onDownload={handleDownloadOfferLetter}
              onSendEmail={handleSendOfferLetterEmail}
              onUpdateStatus={handleUpdateOfferLetterStatus}
              currentUser={currentUser}
              onExtend={handleExtendOfferLetter}
              onDeleteOfferLetter={handleDeleteOfferLetter}
            />
          )}

          {!loading && activeTab === 'issue' && (
            <OfferLetterForm 
              onSubmit={handleIssueOfferLetter}
              loading={loading}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default OfferLetters;
