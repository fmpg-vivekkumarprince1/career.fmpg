import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { certificateService } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import Loader from '../common/Loader';
import ConfirmationModal from '../common/ConfirmationModal';
import { 
  Search, 
  Filter, 
  Download, 
  Mail, 
  ShieldCheck, 
  Trash2, 
  Edit3, 
  ChevronDown, 
  ChevronUp, 
  RefreshCw,
  Send,
  X,
  Calendar,
  Award
} from 'lucide-react';
import { toast } from 'react-toastify';

const CertificateList = ({ certificates = [], loading, onEmailCertificate, onDeleteCertificate, onUpdateCertificate }) => {
  const { isSuperAdmin } = useAuth();
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  // Delete & Verify Modal States
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [certToDelete, setCertToDelete] = useState(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailData, setEmailData] = useState({ id: '', email: '' });
  const [emailLoading, setEmailLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [activeDownloadId, setActiveDownloadId] = useState(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifiedCertificate, setVerifiedCertificate] = useState(null);
  const [verifyError, setVerifyError] = useState('');

  // Comprehensive Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCert, setEditingCert] = useState(null);
  const [showAdvancedFields, setShowAdvancedFields] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    domain: '',
    jobrole: '',
    fromDate: '',
    toDate: '',
    issuedOn: '',
    issuedBy: 'FMPG',
    recipientEmail: '',
    recipientId: '',
    recipientAffiliation: '',
    project: '',
    mode: '',
    performance: '',
    hours: '',
    supervisorName: '',
    supervisorPosition: '',
    issuePlace: '',
    summary: ''
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editActionType, setEditActionType] = useState('save'); // 'save' | 'download' | 'email'

  // Safe Date Formatting helper
  const safeFormatDate = (dateVal) => {
    if (!dateVal) return '—';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '—';
      return format(d, 'MM/dd/yyyy');
    } catch {
      return '—';
    }
  };

  // Unique domains for filtering
  const uniqueDomains = useMemo(() => {
    const set = new Set();
    certificates.forEach((c) => {
      if (c.domain) set.add(c.domain.trim());
    });
    return Array.from(set).sort();
  }, [certificates]);

  // Filtered and sorted certificates
  const filteredCertificates = useMemo(() => {
    return (certificates || [])
      .filter((cert) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        const rawId = String(cert._id || '').toLowerCase();
        const displayId = `fmpg-${rawId}`;
        const name = (cert.name || '').toLowerCase();
        const email = (cert.recipientEmail || cert.userId?.email || '').toLowerCase();
        const role = (cert.jobrole || '').toLowerCase();
        const domain = (cert.domain || '').toLowerCase();
        return (
          rawId.includes(q) ||
          displayId.includes(q) ||
          name.includes(q) ||
          email.includes(q) ||
          role.includes(q) ||
          domain.includes(q)
        );
      })
      .filter((cert) => {
        if (!domainFilter) return true;
        return (cert.domain || '').trim().toLowerCase() === domainFilter.toLowerCase();
      })
      .sort((a, b) => {
        if (sortBy === 'oldest') {
          return new Date(a.issuedOn || a.createdAt || 0) - new Date(b.issuedOn || b.createdAt || 0);
        }
        if (sortBy === 'name') {
          return (a.name || '').localeCompare(b.name || '');
        }
        // Default newest
        return new Date(b.issuedOn || b.createdAt || 0) - new Date(a.issuedOn || a.createdAt || 0);
      });
  }, [certificates, searchQuery, domainFilter, sortBy]);

  // Open Edit Modal with all fields pre-filled from certificate
  const handleShowEditModal = (cert) => {
    setEditingCert(cert);
    const hasOptional = !!(
      cert.recipientId ||
      cert.recipientAffiliation ||
      cert.project ||
      cert.mode ||
      cert.performance ||
      cert.hours ||
      cert.supervisorName ||
      cert.supervisorPosition ||
      cert.issuePlace ||
      cert.summary
    );
    setShowAdvancedFields(hasOptional);

    setEditFormData({
      name: cert.name || '',
      domain: cert.domain || '',
      jobrole: cert.jobrole || '',
      fromDate: cert.fromDate ? new Date(cert.fromDate).toISOString().split('T')[0] : '',
      toDate: cert.toDate ? new Date(cert.toDate).toISOString().split('T')[0] : '',
      issuedOn: cert.issuedOn
        ? new Date(cert.issuedOn).toISOString().split('T')[0]
        : (cert.createdAt ? new Date(cert.createdAt).toISOString().split('T')[0] : ''),
      issuedBy: cert.issuedBy || 'FMPG',
      recipientEmail: cert.recipientEmail || cert.userId?.email || '',
      recipientId: cert.recipientId || '',
      recipientAffiliation: cert.recipientAffiliation || '',
      project: cert.project || '',
      mode: cert.mode || '',
      performance: cert.performance || '',
      hours: cert.hours !== undefined && cert.hours !== null ? String(cert.hours) : '',
      supervisorName: cert.supervisorName || '',
      supervisorPosition: cert.supervisorPosition || '',
      issuePlace: cert.issuePlace || '',
      summary: cert.summary || ''
    });
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingCert(null);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Save changes to certificate (with optional download or email)
  const handleSaveEdit = async (action = 'save') => {
    if (!editingCert) return;
    setEditLoading(true);
    setEditActionType(action);

    try {
      const payload = {
        ...editFormData,
        hours: editFormData.hours ? Number(editFormData.hours) : undefined
      };

      if (onUpdateCertificate) {
        await onUpdateCertificate(editingCert._id, payload);
      } else {
        await certificateService.updateCertificate(editingCert._id, payload);
      }

      toast.success('Certificate updated successfully!');

      // Action 1: If user chose to download immediately
      if (action === 'download') {
        await downloadCertificate(editingCert._id);
      }

      // Action 2: If user chose to send email immediately
      if (action === 'email' && editFormData.recipientEmail) {
        await onEmailCertificate(editingCert._id, editFormData.recipientEmail);
      }

      setShowEditModal(false);
      setEditingCert(null);
    } catch (err) {
      console.error('Failed to update certificate:', err);
      toast.error(err.response?.data?.message || 'Failed to update certificate');
    } finally {
      setEditLoading(false);
      setEditActionType('save');
    }
  };

  const handleCloseEmailModal = () => setShowEmailModal(false);

  const handleShowEmailModal = (certificate) => {
    setEmailData({
      id: certificate._id,
      email: certificate.recipientEmail || certificate.userId?.email || ''
    });
    setShowEmailModal(true);
  };

  const handleShowVerifyModal = (certificate) => {
    setShowVerifyModal(true);
    setVerifyError('');
    setVerifiedCertificate(null);
    verifyCertificate(certificate._id);
  };

  const handleCloseVerifyModal = () => {
    setShowVerifyModal(false);
    setVerifiedCertificate(null);
    setVerifyError('');
  };

  const verifyCertificate = async (certificateId) => {
    setVerifyLoading(true);
    setVerifyError('');

    try {
      const response = await certificateService.verifyCertificate(certificateId);
      setVerifiedCertificate(response.data.certificate);
    } catch (error) {
      setVerifyError(error.response?.data?.message || 'Certificate verification failed');
      console.error('Verification error:', error);
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleSendEmail = () => {
    setEmailLoading(true);
    onEmailCertificate(emailData.id, emailData.email)
      .finally(() => {
        setEmailLoading(false);
        handleCloseEmailModal();
      });
  };

  const handleEmailChange = (e) => {
    setEmailData({
      ...emailData,
      email: e.target.value
    });
  };

  const downloadCertificate = async (id) => {
    try {
      setDownloadLoading(true);
      setActiveDownloadId(id);

      const response = await certificateService.downloadCertificate(id);
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `certificate-${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading certificate:', error);
      toast.error('Error downloading certificate. Please try again.');
    } finally {
      setDownloadLoading(false);
      setActiveDownloadId(null);
    }
  };

  return (
    <>
      <div className="bg-secondary-black rounded-xl shadow-md border border-dark-gray overflow-hidden">
        
        {/* Header & Controls Area */}
        <div className="p-6 border-b border-gray-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-3">
                <h3 className="text-xl font-bold text-white">All Certificates</h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-700/50">
                  {filteredCertificates.length} {filteredCertificates.length === 1 ? 'record' : 'records'}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Search, inspect, download, and modify any existing or old certificate as per requirement.
              </p>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-12 gap-3">
            {/* Search Input */}
            <div className="sm:col-span-6 relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search by candidate name, email, role, or ID (e.g. FMPG-...)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Domain Filter */}
            <div className="sm:col-span-3">
              <select
                value={domainFilter}
                onChange={(e) => setDomainFilter(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">All Domains</option>
                {uniqueDomains.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* Sort Order */}
            <div className="sm:col-span-3">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="newest">Sort: Newest Issued</option>
                <option value="oldest">Sort: Oldest Issued</option>
                <option value="name">Sort: Candidate Name (A-Z)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Certificate Table */}
        <div className="p-6">
          {loading ? null : filteredCertificates.length === 0 ? (
            <div className="text-center my-12 space-y-2">
              <Award className="w-12 h-12 mx-auto text-gray-600" />
              <p className="text-gray-300 font-medium">No certificates match your search criteria.</p>
              {(searchQuery || domainFilter) && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setDomainFilter('');
                  }}
                  className="px-3 py-1 text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
                >
                  Clear search filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-800 text-left">
                <thead>
                  <tr className="bg-gray-900/50">
                    <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Cert ID</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Recipient</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Domain</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Role</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Internship Dates</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Issued On</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 bg-secondary-black">
                  {filteredCertificates.map((cert) => (
                    <tr key={cert._id} className="hover:bg-gray-800/40 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-xs font-mono font-bold text-lime-400">
                        FMPG-{cert._id.toString().substring(0, 8)}...
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-200">
                        <div className="font-semibold text-white">{cert.name}</div>
                        {cert.recipientEmail && (
                          <div className="text-xs text-gray-400">{cert.recipientEmail}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-300">
                        <span className="px-2 py-0.5 rounded bg-gray-800 text-gray-300 border border-gray-700">
                          {cert.domain}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-200 font-medium">
                        {cert.jobrole}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-300">
                        {safeFormatDate(cert.fromDate)} — {safeFormatDate(cert.toDate)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-emerald-400 font-medium">
                        {safeFormatDate(cert.issuedOn || cert.createdAt)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-right space-x-1.5">
                        {/* Download Button */}
                        <button
                          className={`px-2.5 py-1 bg-lime-400 hover:bg-lime-500 text-black text-xs font-semibold rounded transition shadow-sm ${
                            downloadLoading && activeDownloadId === cert._id ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                          onClick={() => downloadCertificate(cert._id)}
                          disabled={downloadLoading && activeDownloadId === cert._id}
                          title="Download Certificate PDF"
                        >
                          {downloadLoading && activeDownloadId === cert._id ? 'Downloading...' : 'Download'}
                        </button>

                        {/* Edit Button */}
                        <button
                          className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold rounded transition"
                          onClick={() => handleShowEditModal(cert)}
                          title="Edit this certificate (dates, role, name, optional info)"
                        >
                          Edit
                        </button>

                        {/* Email Button */}
                        <button
                          className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 hover:text-white text-xs font-medium rounded transition"
                          onClick={() => handleShowEmailModal(cert)}
                          title="Email Certificate PDF to Candidate"
                        >
                          Email
                        </button>

                        {/* Verify Button */}
                        <button
                          className="px-2.5 py-1 bg-blue-950/40 hover:bg-blue-900/60 border border-blue-600/40 text-blue-400 text-xs font-medium rounded transition"
                          onClick={() => handleShowVerifyModal(cert)}
                          title="Verify Certificate Details"
                        >
                          Verify
                        </button>

                        {/* Delete Button (Super Admin only) */}
                        {isSuperAdmin && (
                          <button
                            className="px-2 py-1 bg-red-950/30 hover:bg-red-900/50 border border-red-600/40 text-red-400 text-xs font-medium rounded transition"
                            onClick={() => {
                              setCertToDelete(cert);
                              setShowDeleteModal(true);
                            }}
                            title="Delete Certificate (Super Admin)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
      </div>

      {/* COMPREHENSIVE EDIT CERTIFICATE MODAL */}
      {showEditModal && editingCert && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl max-w-3xl w-full p-6 text-white my-8 max-h-[92vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-gray-800 pb-4 flex-shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/40">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Edit Certificate Details</h3>
                  <p className="text-xs text-gray-400 font-mono">
                    ID: FMPG-{editingCert._id}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseEditModal}
                className="text-gray-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={(e) => { e.preventDefault(); handleSaveEdit('save'); }} className="overflow-y-auto pr-1 py-4 space-y-4 flex-grow">
              
              {/* Core Information Section */}
              <div className="bg-gray-800/60 p-4 rounded-xl border border-gray-700/60 space-y-3">
                <span className="text-xs font-semibold text-emerald-400 tracking-wide uppercase block">
                  Core Details
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">Recipient Name *</label>
                    <input
                      type="text"
                      name="name"
                      value={editFormData.name}
                      onChange={handleEditChange}
                      required
                      placeholder="e.g. John Doe"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">Recipient Email</label>
                    <input
                      type="email"
                      name="recipientEmail"
                      value={editFormData.recipientEmail}
                      onChange={handleEditChange}
                      placeholder="candidate@example.com"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">Job Role / Position *</label>
                    <input
                      type="text"
                      name="jobrole"
                      value={editFormData.jobrole}
                      onChange={handleEditChange}
                      required
                      placeholder="e.g. Frontend Developer Intern"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">Domain / Department *</label>
                    <input
                      type="text"
                      name="domain"
                      value={editFormData.domain}
                      onChange={handleEditChange}
                      required
                      placeholder="e.g. Web Development"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">Start Date (From) *</label>
                    <input
                      type="date"
                      name="fromDate"
                      value={editFormData.fromDate}
                      onChange={handleEditChange}
                      required
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">End Date (To) *</label>
                    <input
                      type="date"
                      name="toDate"
                      value={editFormData.toDate}
                      onChange={handleEditChange}
                      required
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-emerald-400 mb-1">
                      Issued On Date *
                    </label>
                    <input
                      type="date"
                      name="issuedOn"
                      value={editFormData.issuedOn}
                      onChange={handleEditChange}
                      required
                      className="w-full px-3 py-2 bg-gray-900 border border-emerald-500/70 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Issued By Organisation</label>
                  <input
                    type="text"
                    name="issuedBy"
                    value={editFormData.issuedBy}
                    onChange={handleEditChange}
                    placeholder="FMPG"
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Collapsible Additional Details (New Certificate Design Fields) */}
              <div className="bg-gray-800/40 rounded-xl border border-gray-700/60 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowAdvancedFields(!showAdvancedFields)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-800/60 transition"
                >
                  <div>
                    <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
                      Additional Certificate Details (Optional)
                    </span>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Intern Roll No, College/Affiliation, Project, Performance Rating, Supervisor info, etc.
                    </p>
                  </div>
                  {showAdvancedFields ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </button>

                {showAdvancedFields && (
                  <div className="p-4 pt-1 border-t border-gray-700/60 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-300 mb-1">
                          Candidate Roll / Intern ID
                        </label>
                        <input
                          type="text"
                          name="recipientId"
                          value={editFormData.recipientId}
                          onChange={handleEditChange}
                          placeholder="e.g. Roll no. 23BCS1045 or FMPG-INT-024"
                          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-300 mb-1">
                          College / Programme Affiliation
                        </label>
                        <input
                          type="text"
                          name="recipientAffiliation"
                          value={editFormData.recipientAffiliation}
                          onChange={handleEditChange}
                          placeholder="e.g. B.Tech Computer Science, XYZ University"
                          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-xs text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-300 mb-1">
                          Project / Work Area
                        </label>
                        <input
                          type="text"
                          name="project"
                          value={editFormData.project}
                          onChange={handleEditChange}
                          placeholder="e.g. Full Stack Dashboard"
                          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-300 mb-1">
                          Internship Mode
                        </label>
                        <select
                          name="mode"
                          value={editFormData.mode}
                          onChange={handleEditChange}
                          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-xs text-white"
                        >
                          <option value="">None / Not Specified</option>
                          <option value="Remote">Remote</option>
                          <option value="On-site">On-site</option>
                          <option value="Hybrid">Hybrid</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-300 mb-1">
                          Performance Rating
                        </label>
                        <input
                          type="text"
                          name="performance"
                          value={editFormData.performance}
                          onChange={handleEditChange}
                          placeholder="e.g. Outstanding, Excellent"
                          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-xs text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-300 mb-1">
                          Total Hours Worked
                        </label>
                        <input
                          type="number"
                          name="hours"
                          value={editFormData.hours}
                          onChange={handleEditChange}
                          placeholder="e.g. 160"
                          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-300 mb-1">
                          Supervisor Name
                        </label>
                        <input
                          type="text"
                          name="supervisorName"
                          value={editFormData.supervisorName}
                          onChange={handleEditChange}
                          placeholder="e.g. Vivek Kumar"
                          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-300 mb-1">
                          Supervisor Position
                        </label>
                        <input
                          type="text"
                          name="supervisorPosition"
                          value={editFormData.supervisorPosition}
                          onChange={handleEditChange}
                          placeholder="e.g. Engineering Lead"
                          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-xs text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-300 mb-1">
                          Place of Issue
                        </label>
                        <input
                          type="text"
                          name="issuePlace"
                          value={editFormData.issuePlace}
                          onChange={handleEditChange}
                          placeholder="e.g. Indore"
                          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-300 mb-1">
                          Brief Summary of Work
                        </label>
                        <input
                          type="text"
                          name="summary"
                          value={editFormData.summary}
                          onChange={handleEditChange}
                          placeholder="e.g. Demonstrated exceptional skills in React and Node.js..."
                          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-xs text-white"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons Footer */}
              <div className="pt-4 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleCloseEditModal}
                  disabled={editLoading}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-medium transition"
                >
                  Cancel
                </button>

                <div className="flex flex-wrap items-center gap-2 justify-end w-full sm:w-auto">
                  {/* Save & Email */}
                  {editFormData.recipientEmail && (
                    <button
                      type="button"
                      onClick={() => handleSaveEdit('email')}
                      disabled={editLoading}
                      className="px-3 py-2 bg-blue-600/80 hover:bg-blue-600 text-white rounded-lg text-xs font-semibold transition flex items-center disabled:opacity-50"
                      title="Save updates and immediately resend certificate email to candidate"
                    >
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                      {editLoading && editActionType === 'email' ? 'Updating & Sending...' : 'Save & Resend Email'}
                    </button>
                  )}

                  {/* Save & Download */}
                  <button
                    type="button"
                    onClick={() => handleSaveEdit('download')}
                    disabled={editLoading}
                    className="px-3.5 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 rounded-lg text-xs font-semibold transition flex items-center disabled:opacity-50"
                    title="Save updates and download fresh PDF"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    {editLoading && editActionType === 'download' ? 'Updating & Downloading...' : 'Save & Download'}
                  </button>

                  {/* Save Changes Only */}
                  <button
                    type="submit"
                    disabled={editLoading}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-md transition disabled:opacity-50"
                  >
                    {editLoading && editActionType === 'save' ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex justify-between items-center border-b border-gray-700 p-4">
              <h3 className="text-lg font-semibold text-white">Send Certificate via Email</h3>
              <button
                onClick={handleCloseEmailModal}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Recipient Email
                </label>
                <input
                  type="email"
                  value={emailData.email}
                  onChange={handleEmailChange}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-lime-400"
                  placeholder="Enter email address"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 border-t border-gray-700 p-4">
              <button
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md text-sm transition-colors"
                onClick={handleCloseEmailModal}
              >
                Cancel
              </button>
              <button
                className={`px-4 py-2 bg-lime-400 hover:bg-lime-600 text-black font-medium rounded-md text-sm transition-colors ${
                  emailLoading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                onClick={handleSendEmail}
                disabled={emailLoading}
              >
                {emailLoading ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verify Modal */}
      {showVerifyModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex justify-between items-center border-b border-gray-700 p-4">
              <h3 className="text-lg font-semibold text-white">Certificate Verification</h3>
              <button
                onClick={handleCloseVerifyModal}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              {verifyLoading ? (
                <div className="text-center py-6">
                  <Loader size="medium" />
                  <p className="mt-2 text-gray-300">Verifying certificate...</p>
                </div>
              ) : verifyError ? (
                <div className="bg-red-900/40 border border-red-700 text-red-200 p-4 rounded-md">
                  <p className="font-medium">Verification Failed</p>
                  <p className="text-sm mt-1">{verifyError}</p>
                </div>
              ) : verifiedCertificate && (
                <div className="space-y-4">
                  <div className="bg-emerald-900/40 border border-emerald-700 text-emerald-200 p-4 rounded-md">
                    <p className="font-semibold text-emerald-300 flex items-center">
                      <ShieldCheck className="w-4 h-4 mr-1.5" />
                      Valid Certificate
                    </p>
                    <p className="text-xs mt-1">This certificate has been issued and verified in our database.</p>
                  </div>
                  <div className="bg-gray-700/50 p-4 rounded-md space-y-2 text-xs">
                    <div>
                      <span className="text-gray-400">Certificate ID:</span>
                      <p className="text-white font-mono font-semibold">FMPG-{verifiedCertificate._id}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Recipient:</span>
                      <p className="text-white font-semibold">{verifiedCertificate.name}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Domain & Role:</span>
                      <p className="text-white">{verifiedCertificate.domain} — {verifiedCertificate.jobrole}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Internship Period:</span>
                      <p className="text-white">
                        {safeFormatDate(verifiedCertificate.fromDate)} to {safeFormatDate(verifiedCertificate.toDate)}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-400">Issued On:</span>
                      <p className="text-emerald-400 font-semibold">
                        {safeFormatDate(verifiedCertificate.issuedOn || verifiedCertificate.createdAt)}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-400">Issued By:</span>
                      <p className="text-white">{verifiedCertificate.issuedBy || 'FMPG'}</p>
                    </div>
                  </div>
                  <div className="flex justify-end pt-2">
                    <button
                      className="px-4 py-2 bg-lime-400 hover:bg-lime-500 text-black font-semibold rounded-md text-xs transition"
                      onClick={() => downloadCertificate(verifiedCertificate._id)}
                    >
                      Download Certificate PDF
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setCertToDelete(null);
        }}
        onConfirm={async () => {
          if (certToDelete && onDeleteCertificate) {
            await onDeleteCertificate(certToDelete._id);
          }
          setShowDeleteModal(false);
          setCertToDelete(null);
        }}
        title="Delete Certificate"
        message={`Are you sure you want to delete the certificate for "${certToDelete?.name}" (${certToDelete?.jobrole})? This action cannot be undone.`}
        confirmText="Delete Certificate"
        cancelText="Cancel"
        type="danger"
      />
    </>
  );
};

export default CertificateList;
