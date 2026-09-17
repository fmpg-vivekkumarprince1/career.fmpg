import React, { useState } from 'react';
import { format } from 'date-fns';
import { certificateService } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import Loader from '../common/Loader';
import ConfirmationModal from '../common/ConfirmationModal';

const CertificateList = ({ certificates, loading, onEmailCertificate, onDeleteCertificate }) => {
  const { isSuperAdmin } = useAuth();
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
      console.log(`Downloading certificate with ID: ${id}`);

      const response = await certificateService.downloadCertificate(id);

      console.log('Response received successfully', {
        type: response.headers?.['content-type'],
        size: typeof response.data === 'object' ?
          (response.data.size ? `${Math.round(response.data.size / 1024)}KB` : 'unknown') : 'not a blob',
        status: response.status
      });

      // The response.data is already a blob from our updated service
      const blob = response.data;

      // Create an object URL for the blob
      const url = window.URL.createObjectURL(blob);

      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `certificate-${id}.pdf`);
      document.body.appendChild(link);
      link.click();

      // Clean up by removing the link and revoking the blob URL
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      console.log('Certificate download complete');
    } catch (error) {
      console.error('Error downloading certificate:', error);
      alert('Error downloading certificate. Please try again.');
    } finally {
      setDownloadLoading(false);
      setActiveDownloadId(null);
    }
  };

  return (
    <>
      <div className="bg-secondary-black rounded-lg shadow-md border border-dark-gray">
        <div className="p-6">
          <h3 className="text-xl font-semibold text-white mb-5">All Certificates</h3>
          {loading ? null : certificates.length === 0 ? (
            <div className="text-center my-12">
              <p className="text-gray-400">No certificates found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Domain</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Job Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Duration</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Issued On</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {certificates.map((cert) => (
                    <tr key={cert._id} className="hover:bg-gray-800/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-lime-400">FMPG-{cert._id.toString().substring(0, 8)}...</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">{cert.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">{cert.domain}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">{cert.jobrole}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">
                        {format(new Date(cert.fromDate), 'MM/dd/yyyy')} - {format(new Date(cert.toDate), 'MM/dd/yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">{format(new Date(cert.issuedOn), 'MM/dd/yyyy')}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">
                        <div className="flex space-x-2">
                          <button
                            className={`px-3 py-1 bg-lime-400 hover:bg-lime-600 text-black text-xs font-medium rounded transition-colors ${downloadLoading && activeDownloadId === cert._id ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={() => downloadCertificate(cert._id)}
                            disabled={downloadLoading && activeDownloadId === cert._id}
                          >
                            {downloadLoading && activeDownloadId === cert._id ? 'Downloading...' : 'Download'}
                          </button>
                          <button
                            className="px-3 py-1 bg-transparent border border-gray-600 hover:border-gray-400 text-gray-300 hover:text-white text-xs font-medium rounded transition-colors"
                            onClick={() => handleShowEmailModal(cert)}
                          >
                            Email
                          </button>
                          <button
                            className="px-3 py-1 bg-transparent border border-blue-600/30 hover:border-blue-400/50 text-blue-400 hover:bg-blue-900/20 text-xs font-medium rounded transition-colors flex items-center"
                            onClick={() => handleShowVerifyModal(cert)}
                          >
                            Verify
                          </button>
                          {isSuperAdmin && (
                            <button
                              className="px-3 py-1 bg-transparent border border-red-600/40 hover:border-red-500 text-red-400 hover:bg-red-900/30 text-xs font-medium rounded transition-colors flex items-center"
                              onClick={() => {
                                setCertToDelete(cert);
                                setShowDeleteModal(true);
                              }}
                              title="Delete Certificate (Super Admin)"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

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
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <form>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Recipient Email
                  </label>
                  <input
                    type="email"
                    placeholder="Enter email"
                    value={emailData.email}
                    onChange={handleEmailChange}
                    required
                    className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-transparent"
                  />
                </div>
              </form>
            </div>
            <div className="flex justify-end space-x-3 border-t border-gray-700 p-4">
              <button
                onClick={handleCloseEmailModal}
                className="px-4 py-2 bg-transparent border border-gray-600 text-gray-300 hover:text-white hover:border-gray-500 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSendEmail}
                disabled={!emailData.email || emailLoading}
                className={`px-4 py-2 bg-lime-400 hover:bg-lime-600 text-black font-medium rounded transition-colors ${!emailData.email || emailLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {emailLoading ? 'Sending...' : 'Send Certificate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verify Modal */}
      {showVerifyModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-gray-700 p-4">
              <h3 className="text-lg font-semibold text-white">Certificate Verification</h3>
              <button
                onClick={handleCloseVerifyModal}
                className="text-gray-400 hover:text-white"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              {verifyLoading && (
                <div className="flex justify-center items-center py-8">
                  <Loader inline={true} size="sm" text="Verifying certificate..." />
                </div>
              )}

              {verifyError && (
                <div className="p-4 bg-red-900/30 border border-red-500/30 rounded-md text-red-400">
                  <div className="flex items-center">
                    <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium">Verification Failed</span>
                  </div>
                  <p className="mt-2">{verifyError}</p>
                </div>
              )}

              {verifiedCertificate && (
                <div className="border border-green-500/30 rounded-md overflow-hidden">
                  <div className="bg-green-900/30 px-4 py-3 border-b border-green-500/30">
                    <div className="flex justify-between items-center text-green-400">
                      <h5 className="text-lg font-semibold m-0">Certificate Verified Successfully</h5>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>

                  <div className="p-4 bg-secondary-black/50">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-y-3">
                      <div className="text-gray-400 font-medium md:col-span-1">Name:</div>
                      <div className="text-white md:col-span-3">{verifiedCertificate.name}</div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-y-3 mt-3">
                      <div className="text-gray-400 font-medium md:col-span-1">Domain:</div>
                      <div className="text-white md:col-span-3">{verifiedCertificate.domain}</div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-y-3 mt-3">
                      <div className="text-gray-400 font-medium md:col-span-1">Job Role:</div>
                      <div className="text-white md:col-span-3">{verifiedCertificate.jobrole}</div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-y-3 mt-3">
                      <div className="text-gray-400 font-medium md:col-span-1">Duration:</div>
                      <div className="text-white md:col-span-3">
                        {format(new Date(verifiedCertificate.fromDate), 'MMM dd, yyyy')} to {format(new Date(verifiedCertificate.toDate), 'MMM dd, yyyy')}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-y-3 mt-3">
                      <div className="text-gray-400 font-medium md:col-span-1">Issued By:</div>
                      <div className="text-white md:col-span-3">{verifiedCertificate.issuedBy}</div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-gray-600">
                      <button
                        className="px-4 py-2 bg-lime-400 hover:bg-lime-600 text-black font-medium rounded-md text-sm transition-colors"
                        onClick={() => downloadCertificate(verifiedCertificate._id)}
                      >
                        Download Certificate
                      </button>
                    </div>
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