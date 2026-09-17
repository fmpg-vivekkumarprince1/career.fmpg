import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { certificateService, offerLetterService } from '../services/api';
import IssueForm from '../components/certificates/IssueForm';
import CertificateList from '../components/certificates/CertificateList';
import VerifyForm from '../components/certificates/VerifyForm';
import OfferLetterForm from '../components/certificates/OfferLetterForm';
import OfferLetterList from '../components/certificates/OfferLetterList';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Loader from '../components/common/Loader';
import BulkOfferModal from '../components/certificates/BulkOfferModal';
import { FaFileAlt } from 'react-icons/fa';

const Certificates = () => {
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const actionParam = searchParams.get('action');
  const emailParam = searchParams.get('email') || '';
  const prefillData = {
    name: searchParams.get('name') || '',
    email: searchParams.get('email') || '',
    domain: searchParams.get('domain') || '',
    jobrole: searchParams.get('jobrole') || '',
    fromDate: searchParams.get('fromDate') || '',
    toDate: searchParams.get('toDate') || ''
  };
  const [activeTab, setActiveTab] = useState(tabParam || 'issue');
  const [loading, setLoading] = useState(false);
  const [certificates, setCertificates] = useState([]);
  const [offerLetters, setOfferLetters] = useState([]);
  const navigate = useNavigate();
  const { currentUser, isAdmin, isHR } = useAuth();

  // Bulk Offer States
  const [showBulkOfferModal, setShowBulkOfferModal] = useState(false);
  const [bulkOfferLoading, setBulkOfferLoading] = useState(false);
  const [bulkOfferFile, setBulkOfferFile] = useState(null);
  const [bulkOfferCommon, setBulkOfferCommon] = useState({
    joiningLocation: 'Indore',
    validUntil: '',
    workType: 'On-site',
    hrContactName: currentUser?.name || '',
    hrContactEmail: currentUser?.email || '',
    hrContactPhone: '',
    sendEmail: false,
    endDate: '',
    duration: ''
  });

  useEffect(() => {
    if (!currentUser || (!isAdmin && !isHR)) {
      navigate('/login', { state: { message: "You must have admin access to access this page" } });
      return;
    }
    
    const fetchCertificates = async () => {
      setLoading(true);
      try {
        const response = await certificateService.getAllCertificates();
        setCertificates(response.data);
      } catch (err) {
        toast.error('Failed to fetch certificates');
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    };

    const fetchOfferLetters = async () => {
      try {
        const response = await offerLetterService.getAllOfferLetters();
        setOfferLetters(response.data);
      } catch (err) {
        console.error('Error fetching offer letters:', err);
      }
    };

    fetchCertificates();
    fetchOfferLetters();
  }, [navigate, currentUser, isAdmin, isHR]);

  // Handle tab parameter changes
  useEffect(() => {
    if (tabParam && ['issue', 'offer', 'all', 'alloffers', 'verify'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleIssue = async (certificateData) => {
    setLoading(true);
    
    try {
      const response = await certificateService.issueCertificate(certificateData);
      toast.success('Certificate issued successfully!');
      
      if (certificateData.email) {
        await certificateService.sendCertificateEmail(response.data.certificateId, {
          recipientEmail: certificateData.email,
          subject: `Certificate for ${certificateData.jobrole}`,
          message: `Congratulations on completing your internship in ${certificateData.domain}!`
        });
        toast.success('Certificate issued and emailed successfully!');
      }
      
      const updatedCerts = await certificateService.getAllCertificates();
      setCertificates(updatedCerts.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to issue certificate');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailCertificate = async (id, email) => {
    setLoading(true);
    
    try {
      const cert = certificates.find(c => c._id === id);
      if (!cert) throw new Error('Certificate not found');
      
      await certificateService.sendCertificateEmail(id, {
        recipientEmail: email,
        subject: `Certificate for ${cert.jobrole}`,
        message: `Congratulations on completing your internship in ${cert.domain}!`
      });
      
      toast.success('Certificate emailed successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to email certificate');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCertificate = async (id) => {
    try {
      setLoading(true);
      await certificateService.deleteCertificate(id);
      toast.success('Certificate deleted successfully');
      setCertificates(prev => prev.filter(c => c._id !== id));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete certificate');
      console.error('Error deleting certificate:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOfferLetter = async (id) => {
    try {
      setLoading(true);
      await offerLetterService.deleteOfferLetter(id);
      toast.success('Offer letter deleted successfully');
      setOfferLetters(prev => prev.filter(o => o._id !== id));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete offer letter');
      console.error('Error deleting offer letter:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOfferLetterGeneration = async (offerData) => {
    setLoading(true);
    
    try {
      const response = await offerLetterService.issueOfferLetter(offerData);
      toast.success('Offer letter issued successfully!');
      
      // Send email automatically
      if (offerData.email) {
        await offerLetterService.sendOfferLetterEmail(response.data.offerLetterId, {
          recipientEmail: offerData.email
        });
        toast.success('Offer letter issued and emailed successfully!');
      }
      
      // Refresh offer letters list
      const updatedOfferLetters = await offerLetterService.getAllOfferLetters();
      setOfferLetters(updatedOfferLetters.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to issue offer letter');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadOfferLetter = async (id) => {
    try {
      const response = await offerLetterService.downloadOfferLetter(id);
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
      await offerLetterService.updateOfferLetterStatus(id, status);
      toast.success(`Offer letter marked as ${status.toLowerCase()}!`);
      const updatedOfferLetters = await offerLetterService.getAllOfferLetters();
      setOfferLetters(updatedOfferLetters.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update offer letter status');
      console.error('Error:', err);
    }
  };

  const handleExtendOfferLetter = async (id, extensionData) => {
    try {
      await offerLetterService.extendOfferLetter(id, extensionData);
      toast.success('Offer letter extended successfully!');
      const updatedOfferLetters = await offerLetterService.getAllOfferLetters();
      setOfferLetters(updatedOfferLetters.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to extend offer letter');
      console.error('Error:', err);
      throw err;
    }
  };

  const handleBulkOfferSubmit = async (e) => {
    e.preventDefault();
    if (!bulkOfferFile) {
      toast.error('Please select a CSV file');
      return;
    }

    const formData = new FormData();
    formData.append('file', bulkOfferFile);
    formData.append('joiningLocation', bulkOfferCommon.joiningLocation);
    formData.append('validUntil', bulkOfferCommon.validUntil);
    formData.append('workType', bulkOfferCommon.workType);
    formData.append('hrContactName', bulkOfferCommon.hrContactName);
    formData.append('hrContactEmail', bulkOfferCommon.hrContactEmail);
    formData.append('hrContactPhone', bulkOfferCommon.hrContactPhone);
    formData.append('endDate', bulkOfferCommon.endDate || '');
    formData.append('duration', bulkOfferCommon.duration || '');
    formData.append('sendEmail', bulkOfferCommon.sendEmail);

    try {
      setBulkOfferLoading(true);
      const response = await offerLetterService.bulkIssueOfferLetters(formData);
      const { successCount, errorCount } = response.data;
      const successMsg = `Successfully issued ${successCount} offer letters.`;
      const failMsg = errorCount > 0 ? ` Failed: ${errorCount}. Check console for details.` : '';
      toast.success(successMsg + failMsg);
      setShowBulkOfferModal(false);
      setBulkOfferFile(null);
      const updatedOfferLetters = await offerLetterService.getAllOfferLetters();
      setOfferLetters(updatedOfferLetters.data);
    } catch (error) {
      console.error('Bulk offer error:', error);
      toast.error(error.response?.data?.message || 'Failed to process bulk offer letters');
    } finally {
      setBulkOfferLoading(false);
    }
  };

  const handleDownloadBulkOfferSample = async () => {
    try {
      const blob = await offerLetterService.downloadOfferSampleCSV();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'bulk_offer_sample.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Sample download error:', error);
      toast.error('Failed to download sample CSV');
    }
  };

  return (
    <div className="ui-page">
      <div className="ui-content">
      <div className="ui-page-header">
        <span className="fmpg-kicker">Documents</span>
        <h1 className="ui-page-title mt-3">Certificate management</h1>
        <p className="ui-page-subtitle">Issue, verify, and manage candidate credentials and offer letters.</p>
      </div>
      
      <div className="mb-6 overflow-x-auto border-b border-slate-200">
        <ul className="flex flex-wrap -mb-px">
          {['issue', 'offer', 'all', 'alloffers', 'verify'].map((tab) => (
            <li key={tab} className="mr-2">
              <button
                onClick={() => setActiveTab(tab)}
                className={`inline-block py-4 px-4 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'border-b-2 border-emerald-600 text-emerald-700'
                    : 'text-slate-500 hover:text-slate-900 border-b-2 border-transparent'
                }`}
              >
                {tab === 'issue' && 'Issue Certificate'}
                {tab === 'offer' && 'Issue Offer Letter'}
                {tab === 'all' && 'All Certificates'}
                {tab === 'alloffers' && 'All Offer Letters'}
                {tab === 'verify' && 'Verify Certificate'}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="ui-card p-6 relative min-h-[400px]">
        {loading && <Loader text="Processing request…" />}
        
        {!loading && activeTab === 'offer' && (
          <div className="absolute top-6 right-6 z-10">
            <button
              onClick={() => setShowBulkOfferModal(true)}
              className="fmpg-primary-button px-4 py-2 text-xs flex items-center gap-2 transition-all"
            >
              <FaFileAlt className="text-sm" />
              Bulk Issue Offer
            </button>
          </div>
        )}

        {!loading && activeTab === 'issue' && (
          <IssueForm onSubmit={handleIssue} loading={loading} initialData={prefillData} />
        )}
        
        {!loading && activeTab === 'offer' && (
          <OfferLetterForm onSubmit={handleOfferLetterGeneration} loading={loading} />
        )}
        
        {!loading && activeTab === 'all' && (
          <CertificateList 
            certificates={certificates} 
            loading={loading} 
            onEmailCertificate={handleEmailCertificate}
            onDeleteCertificate={handleDeleteCertificate}
          />
        )}
        
        {!loading && activeTab === 'alloffers' && (
          <OfferLetterList 
            offerLetters={offerLetters}
            loading={loading}
            onDownload={handleDownloadOfferLetter}
            onSendEmail={handleSendOfferLetterEmail}
            onUpdateStatus={handleUpdateOfferLetterStatus}
            onExtend={handleExtendOfferLetter}
            onDeleteOfferLetter={handleDeleteOfferLetter}
            currentUser={currentUser}
            autoOpenExtendEmail={actionParam === 'extend' ? emailParam : ''}
            filterEmail={emailParam}
          />
        )}
        
        {!loading && activeTab === 'verify' && <VerifyForm />}

        <BulkOfferModal
          show={showBulkOfferModal}
          onClose={() => setShowBulkOfferModal(false)}
          onSubmit={handleBulkOfferSubmit}
          loading={bulkOfferLoading}
          file={bulkOfferFile}
          setFile={setBulkOfferFile}
          commonDetails={bulkOfferCommon}
          setCommonDetails={setBulkOfferCommon}
          onDownloadSample={handleDownloadBulkOfferSample}
        />
      </div>
      </div>
    </div>
  );
};

export default Certificates;