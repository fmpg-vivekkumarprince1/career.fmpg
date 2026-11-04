import React, { useState, useEffect } from 'react';
import { Award, Send, Download, X, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';
import { toast } from 'react-toastify';
import { certificateService } from '../../services/api';

const QuickCertificateModal = ({ isOpen, onClose, sourceData = {}, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    jobrole: '',
    domain: '',
    fromDate: '',
    toDate: '',
    issuedOn: '',
    issuedBy: 'FMPG',
    subject: '',
    message: ''
  });

  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(''); // 'issuing' | 'sending' | ''
  const [error, setError] = useState('');

  // Pre-fill form when sourceData changes or modal opens
  useEffect(() => {
    if (isOpen && sourceData) {
      const candidateName = sourceData.name || sourceData.candidateName || '';
      const candidateEmail = sourceData.email || sourceData.candidateEmail || '';
      const role = sourceData.jobrole || sourceData.position || sourceData.jobTitle || sourceData.job?.title || 'Intern';
      const domainValue = sourceData.domain || sourceData.department || sourceData.job?.department || 'Web Development';
      
      // Default to 1-3 months tenure if dates not provided
      const today = new Date().toISOString().split('T')[0];
      let from = '';
      if (sourceData.fromDate || sourceData.startDate) {
        from = new Date(sourceData.fromDate || sourceData.startDate).toISOString().split('T')[0];
      } else {
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        from = threeMonthsAgo.toISOString().split('T')[0];
      }

      let to = '';
      if (sourceData.toDate || sourceData.endDate) {
        to = new Date(sourceData.toDate || sourceData.endDate).toISOString().split('T')[0];
      } else {
        to = today;
      }

      const issueDate = sourceData.issuedOn
        ? new Date(sourceData.issuedOn).toISOString().split('T')[0]
        : today;

      setFormData({
        name: candidateName,
        email: candidateEmail,
        jobrole: role,
        domain: domainValue,
        fromDate: from,
        toDate: to,
        issuedOn: issueDate,
        issuedBy: sourceData.issuedBy || 'FMPG',
        subject: `Certificate of Completion - ${role}`,
        message: `Dear ${candidateName || 'Candidate'},\n\nCongratulations on successfully completing your tenure with us as ${role}! Please find attached your official verified certificate of completion.\n\nBest regards,\nFMPG Team`
      });
      setError('');
    }
  }, [isOpen, sourceData]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
    if (error) setError('');
  };

  const validate = () => {
    if (!formData.name.trim()) return 'Candidate Name is required';
    if (!formData.email.trim()) return 'Recipient Email is required';
    if (!formData.jobrole.trim()) return 'Job Role / Position is required';
    if (!formData.domain.trim()) return 'Domain / Department is required';
    if (!formData.fromDate) return 'Start Date (From) is required';
    if (!formData.toDate) return 'End Date (To) is required';
    if (!formData.issuedOn) return 'Issued On Date is required';
    if (new Date(formData.fromDate) > new Date(formData.toDate)) {
      return 'Start Date cannot be after End Date';
    }
    return null;
  };

  // Helper to trigger automatic download of PDF
  const triggerDownload = async (certId, name) => {
    try {
      const response = await certificateService.downloadCertificate(certId);
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Certificate-${(name || 'candidate').replace(/\s+/g, '_')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (dlErr) {
      console.warn('PDF auto-download notice:', dlErr);
    }
  };

  // Handler 1: Issue & Immediately Send Email in 1-Click
  const handleGenerateAndSend = async () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }

    try {
      setLoading(true);
      setLoadingStep('issuing');

      // 1. Issue certificate
      const certPayload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        domain: formData.domain.trim(),
        jobrole: formData.jobrole.trim(),
        fromDate: formData.fromDate,
        toDate: formData.toDate,
        issuedOn: formData.issuedOn,
        issuedBy: formData.issuedBy.trim() || 'FMPG'
      };

      const issueRes = await certificateService.issueCertificate(certPayload);
      const certId = issueRes.data.certificateId || issueRes.data.id;

      // 2. Immediately send certificate email with attachment
      setLoadingStep('sending');
      await certificateService.sendCertificateEmail(certId, {
        recipientEmail: formData.email.trim(),
        subject: formData.subject.trim() || `Certificate: ${formData.jobrole}`,
        message: formData.message.trim()
      });

      // 3. Trigger local download for admin records
      triggerDownload(certId, formData.name);

      toast.success(`🎉 Certificate generated & emailed to ${formData.email} successfully!`);
      if (onSuccess) onSuccess(issueRes.data);
      onClose();
    } catch (apiErr) {
      console.error('Certificate generation/sending failed:', apiErr);
      const msg = apiErr.response?.data?.message || apiErr.message || 'Failed to generate/send certificate';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  // Handler 2: Issue Certificate Only (Without sending email)
  const handleGenerateOnly = async () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }

    try {
      setLoading(true);
      setLoadingStep('issuing');

      const certPayload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        domain: formData.domain.trim(),
        jobrole: formData.jobrole.trim(),
        fromDate: formData.fromDate,
        toDate: formData.toDate,
        issuedOn: formData.issuedOn,
        issuedBy: formData.issuedBy.trim() || 'FMPG'
      };

      const issueRes = await certificateService.issueCertificate(certPayload);
      const certId = issueRes.data.certificateId || issueRes.data.id;

      // Trigger download
      await triggerDownload(certId, formData.name);

      toast.success('Certificate created & downloaded successfully!');
      if (onSuccess) onSuccess(issueRes.data);
      onClose();
    } catch (apiErr) {
      console.error('Certificate generation failed:', apiErr);
      const msg = apiErr.response?.data?.message || apiErr.message || 'Failed to generate certificate';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-2xl w-full p-6 text-white shadow-2xl relative">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl text-white shadow-md">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold text-white">Generate Certificate</h2>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-900/60 text-emerald-300 border border-emerald-700/50">
                  Pre-filled & Ready
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Ready to issue from {sourceData.sourceType || 'Application / Offer Letter'}. Review or edit details below.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-400 hover:text-white p-1 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mt-4 p-3 bg-red-900/40 border border-red-700/50 rounded-xl text-xs text-red-200 flex items-center">
            <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <div className="mt-4 space-y-4 max-h-[65vh] overflow-y-auto pr-1">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Candidate Name */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Candidate Name <span className="text-emerald-400">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. John Doe"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Recipient Email */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Recipient Email <span className="text-emerald-400">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="candidate@example.com"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Job Role */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Job Role / Position <span className="text-emerald-400">*</span>
              </label>
              <input
                type="text"
                name="jobrole"
                value={formData.jobrole}
                onChange={handleChange}
                placeholder="e.g. Full Stack Developer Intern"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Domain / Department */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Domain / Department <span className="text-emerald-400">*</span>
              </label>
              <input
                type="text"
                name="domain"
                value={formData.domain}
                onChange={handleChange}
                placeholder="e.g. Web Development"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* From Date */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Start Date (From) <span className="text-emerald-400">*</span>
              </label>
              <input
                type="date"
                name="fromDate"
                value={formData.fromDate}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* To Date */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                End Date (To) <span className="text-emerald-400">*</span>
              </label>
              <input
                type="date"
                name="toDate"
                value={formData.toDate}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Issued On Date */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Issued On (Date) <span className="text-emerald-400">*</span>
              </label>
              <input
                type="date"
                name="issuedOn"
                value={formData.issuedOn}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-gray-800 border border-emerald-500/50 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>

            {/* Issued By */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Issued By
              </label>
              <input
                type="text"
                name="issuedBy"
                value={formData.issuedBy}
                onChange={handleChange}
                placeholder="FMPG"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Email Subject */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Email Subject
            </label>
            <input
              type="text"
              name="subject"
              value={formData.subject}
              onChange={handleChange}
              placeholder="Certificate of Completion"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Email Message Note */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Email Message Body (Candidate will receive this with PDF attached)
            </label>
            <textarea
              name="message"
              rows={3}
              value={formData.message}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none font-sans"
            />
          </div>

        </div>

        {/* Footer Actions */}
        <div className="mt-6 pt-4 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-gray-400 flex items-center">
            <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-400" />
            <span>Ready for single-click dispatch</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-gray-700 rounded-lg text-xs font-medium text-gray-300 hover:bg-gray-800 transition disabled:opacity-50"
            >
              Cancel
            </button>

            {/* Secondary: Generate Only */}
            <button
              type="button"
              onClick={handleGenerateOnly}
              disabled={loading}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg text-xs font-medium text-gray-200 transition flex items-center disabled:opacity-50"
              title="Issue and download certificate without sending an email"
            >
              <Download className="w-4 h-4 mr-1.5 text-gray-400" />
              Generate Only
            </button>

            {/* Primary: 1-Click Generate & Send */}
            <button
              type="button"
              onClick={handleGenerateAndSend}
              disabled={loading}
              className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold rounded-lg text-xs shadow-lg shadow-emerald-950/40 transition flex items-center disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                  {loadingStep === 'issuing' ? 'Generating Certificate...' : 'Sending Email...'}
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-1.5" />
                  Generate & Send Email (1-Click)
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default QuickCertificateModal;
