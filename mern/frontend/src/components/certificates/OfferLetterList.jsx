import React, { useEffect, useState } from 'react';
import ExtendOfferModal from './ExtendOfferModal';
import ConfirmationModal from '../common/ConfirmationModal';
import { useAuth } from '../../hooks/useAuth';
import { formatCurrencyValue } from '../../utils/currencyUtils';

const OfferLetterList = ({ 
  offerLetters, 
  loading, 
  onDownload, 
  onSendEmail, 
  onUpdateStatus,
  onExtend,
  onDeleteOfferLetter,
  currentUser,
  autoOpenExtendEmail = '',
  filterEmail = ''
}) => {
  const { isSuperAdmin } = useAuth();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [letterToDelete, setLetterToDelete] = useState(null);
  const [expandedLetter, setExpandedLetter] = useState(null);
  const [sendingEmail, setSendingEmail] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [extendModalOpen, setExtendModalOpen] = useState(false);
  const [selectedLetterForExtend, setSelectedLetterForExtend] = useState(null);

  const displayedOfferLetters = filterEmail
    ? offerLetters.filter((letter) => letter.email?.toLowerCase() === filterEmail.toLowerCase())
    : offerLetters;

  useEffect(() => {
    if (!autoOpenExtendEmail || !offerLetters?.length) return;

    const normalizedEmail = autoOpenExtendEmail.toLowerCase();
    const eligibleOffers = offerLetters
      .filter((letter) => letter.email?.toLowerCase() === normalizedEmail && letter.status === 'Accepted')
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

    if (eligibleOffers.length > 0) {
      const targetOffer = eligibleOffers[0];
      setExpandedLetter(targetOffer._id);
      setSelectedLetterForExtend(targetOffer);
      setExtendModalOpen(true);
    }
  }, [autoOpenExtendEmail, offerLetters]);

  const handleSendEmail = async (letterId, email) => {
    setSendingEmail(letterId);
    try {
      await onSendEmail(letterId, email);
    } finally {
      setSendingEmail(null);
    }
  };

  const handleStatusUpdate = async (letterId, status) => {
    setUpdatingStatus(letterId);
    try {
      await onUpdateStatus(letterId, status);
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleOpenExtendModal = (letter) => {
    setSelectedLetterForExtend(letter);
    setExtendModalOpen(true);
  };

  const handleCloseExtendModal = () => {
    setExtendModalOpen(false);
    setSelectedLetterForExtend(null);
  };

  const handleExtend = async (letterId, extensionData) => {
    try {
      await onExtend(letterId, extensionData);
      handleCloseExtendModal();
    } catch (error) {
      console.error('Error extending offer letter:', error);
      throw error;
    }
  };

  const toggleExpanded = (letterId) => {
    setExpandedLetter(expandedLetter === letterId ? null : letterId);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Accepted': return 'text-green-400';
      case 'Rejected': return 'text-red-400';
      case 'Pending': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'Accepted': return 'bg-green-900 text-green-200';
      case 'Rejected': return 'bg-red-900 text-red-200';
      case 'Pending': return 'bg-yellow-900 text-yellow-200';
      default: return 'bg-gray-900 text-gray-200';
    }
  };

  if (loading) {
    return null;
  }

  if (!offerLetters || offerLetters.length === 0) {
    return (
      <div className="bg-secondary-black rounded-lg shadow-md border border-dark-gray p-6">
        <div className="text-center py-8">
          <p className="text-gray-400 text-lg">No offer letters found</p>
          <p className="text-gray-500 text-sm mt-2">Issue your first offer letter to get started</p>
        </div>
      </div>
    );
  }

  if (displayedOfferLetters.length === 0) {
    return (
      <div className="bg-secondary-black rounded-lg shadow-md border border-dark-gray p-6">
        <div className="text-center py-8">
          <p className="text-gray-400 text-lg">No offer letters found for selected user</p>
          <p className="text-gray-500 text-sm mt-2">Try clearing the user filter</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-secondary-black rounded-lg shadow-md border border-dark-gray">
      <div className="p-6">
        <h3 className="text-xl font-semibold text-white mb-6">
          {filterEmail ? `Offer History (${displayedOfferLetters.length})` : `All Offer Letters (${displayedOfferLetters.length})`}
        </h3>
        
        <div className="space-y-4">
          {displayedOfferLetters.map((letter) => (
            <div 
              key={letter._id} 
              className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden"
            >
              {/* Summary Row */}
              <div className="p-4 cursor-pointer hover:bg-gray-750 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-white font-medium">{letter.candidateName}</h4>
                          <span className="text-xs font-mono font-bold text-lime-400 bg-lime-950/40 px-1.5 py-0.5 rounded border border-lime-800/40">
                            FMPG-OFF-{letter.shortId || letter._id.toString().slice(-6).toUpperCase()}
                          </span>
                        </div>
                        <p className="text-gray-400 text-sm">{letter.position} • {letter.department}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadgeColor(letter.status)}`}>
                        {letter.status}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${letter.offerType === 'Internship' ? 'bg-purple-900 text-purple-200' : 'bg-blue-900 text-blue-200'}`}>
                        {letter.offerType || 'Job'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-400 text-sm">
                      {letter.offerType === 'Internship' ? 'Stipend: ' : 'Salary: '} 
                      {formatCurrencyValue(letter.salary)}
                      {letter.offerType === 'Internship' && letter.payoutFrequency && (
                        <span className="text-xs text-gray-500 ml-1">({letter.payoutFrequency})</span>
                      )}
                    </span>
                    <button
                      onClick={() => toggleExpanded(letter._id)}
                      className="ml-4 text-lime-400 hover:text-lime-300 transition-colors"
                    >
                      {expandedLetter === letter._id ? (
                        <span className="text-sm">Show Less ↑</span>
                      ) : (
                        <span className="text-sm">See More ↓</span>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedLetter === letter._id && (
                <div className="border-t border-gray-700 bg-gray-850">
                  <div className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                      <div>
                        <p className="text-gray-400 text-sm">Email</p>
                        <p className="text-white">{letter.email}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-sm">Start Date</p>
                        <p className="text-white">{new Date(letter.startDate).toLocaleDateString()}</p>
                      </div>
                      {letter.duration && (
                        <div>
                          <p className="text-gray-400 text-sm">Duration</p>
                          <p className="text-white">{letter.duration}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-gray-400 text-sm">Location</p>
                        <p className="text-white">{letter.joiningLocation}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-sm">Work Type</p>
                        <p className="text-white">{letter.workType}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-sm">Valid Until</p>
                        <p className="text-white">{new Date(letter.validUntil).toLocaleDateString()}</p>
                      </div>
                      {letter.reportingManager && (
                        <div>
                          <p className="text-gray-400 text-sm">Reporting Manager</p>
                          <p className="text-white">{letter.reportingManager}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-gray-400 text-sm">Offer Type</p>
                        <p className="text-white">{letter.offerType || 'Job'}</p>
                      </div>
                      {letter.offerType === 'Internship' && letter.payoutFrequency && (
                        <div>
                          <p className="text-gray-400 text-sm">Payout Frequency</p>
                          <p className="text-white">{letter.payoutFrequency}</p>
                        </div>
                      )}
                    </div>

                    {letter.benefits && letter.benefits.length > 0 && (
                      <div className="mb-4">
                        <p className="text-gray-400 text-sm mb-2">Benefits</p>
                        <div className="flex flex-wrap gap-2">
                          {letter.benefits.map((benefit, index) => (
                            <span 
                              key={index}
                              className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded"
                            >
                              {benefit}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {letter.additionalNotes && (
                      <div className="mb-4">
                        <p className="text-gray-400 text-sm mb-2">Additional Notes</p>
                        <p className="text-white text-sm bg-gray-700 p-3 rounded">
                          {letter.additionalNotes}
                        </p>
                      </div>
                    )}

                    {letter.extensionHistory && letter.extensionHistory.length > 0 && (
                      <div className="mb-4">
                        <p className="text-gray-400 text-sm mb-2">Extension History</p>
                        <div className="space-y-2">
                          {letter.extensionHistory
                            .slice()
                            .reverse()
                            .map((entry, index) => (
                              <div key={`${letter._id}-ext-${index}`} className="bg-gray-700 p-3 rounded">
                                <p className="text-xs text-gray-300">
                                  Extended On: {new Date(entry.extendedAt).toLocaleDateString()}
                                </p>
                                <p className="text-xs text-gray-300">
                                  Valid Until: {new Date(entry.oldValidUntil).toLocaleDateString()} → {new Date(entry.newValidUntil).toLocaleDateString()}
                                </p>
                                <p className="text-xs text-gray-300">
                                  Start Date: {new Date(entry.oldStartDate).toLocaleDateString()} → {new Date(entry.newStartDate).toLocaleDateString()}
                                </p>
                                {entry.previousOfferSnapshot?.salary !== undefined && (
                                  <p className="text-xs text-gray-300">
                                    Salary: {formatCurrencyValue(entry.previousOfferSnapshot.salary)}
                                  </p>
                                )}
                                {entry.notes && <p className="text-xs text-gray-200 mt-1">Notes: {entry.notes}</p>}
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* HR Contact Info */}
                    {(letter.hrContactName || letter.hrContactEmail || letter.hrContactPhone) && (
                      <div className="mb-4">
                        <p className="text-gray-400 text-sm mb-2">HR Contact</p>
                        <div className="bg-gray-700 p-3 rounded">
                          {letter.hrContactName && (
                            <p className="text-white text-sm">Name: {letter.hrContactName}</p>
                          )}
                          {letter.hrContactEmail && (
                            <p className="text-white text-sm">Email: {letter.hrContactEmail}</p>
                          )}
                          {letter.hrContactPhone && (
                            <p className="text-white text-sm">Phone: {letter.hrContactPhone}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-700">
                      <button
                        onClick={() => onDownload(letter._id)}
                        className="px-4 py-2 bg-lime-400 hover:bg-lime-500 text-black text-sm font-medium rounded transition-colors"
                      >
                        Download PDF
                      </button>
                      
                      <>
                        <button
                          onClick={() => handleSendEmail(letter._id, letter.email)}
                          disabled={sendingEmail === letter._id}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors disabled:opacity-50"
                        >
                          {sendingEmail === letter._id ? 'Sending...' : 'Send Email'}
                        </button>

                        {letter.status === 'Pending' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleStatusUpdate(letter._id, 'Accepted')}
                              disabled={updatingStatus === letter._id}
                              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded transition-colors disabled:opacity-50"
                            >
                              Mark Accepted
                            </button>
                            <button
                              onClick={() => handleStatusUpdate(letter._id, 'Rejected')}
                              disabled={updatingStatus === letter._id}
                              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded transition-colors disabled:opacity-50"
                            >
                              Mark Rejected
                            </button>
                          </div>
                        )}

                        {letter.status === 'Accepted' && (
                          <button
                            onClick={() => handleOpenExtendModal(letter)}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded transition-colors"
                          >
                            Extend Offer
                          </button>
                        )}

                        {isSuperAdmin && (
                          <button
                            onClick={() => {
                              setLetterToDelete(letter);
                              setShowDeleteModal(true);
                            }}
                            className="px-4 py-2 bg-transparent border border-red-600/40 hover:border-red-500 text-red-400 hover:bg-red-900/30 text-sm font-medium rounded transition-colors flex items-center"
                            title="Delete Offer Letter (Super Admin)"
                          >
                            Delete Offer
                          </button>
                        )}
                      </>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Extend Offer Modal */}
      <ExtendOfferModal
        isOpen={extendModalOpen}
        onClose={handleCloseExtendModal}
        offerLetter={selectedLetterForExtend}
        onExtend={handleExtend}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setLetterToDelete(null);
        }}
        onConfirm={async () => {
          if (letterToDelete && onDeleteOfferLetter) {
            await onDeleteOfferLetter(letterToDelete._id);
          }
          setShowDeleteModal(false);
          setLetterToDelete(null);
        }}
        title="Delete Offer Letter"
        message={`Are you sure you want to delete the offer letter for "${letterToDelete?.candidateName}" (${letterToDelete?.position})? This action cannot be undone.`}
        confirmText="Delete Offer Letter"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
};

export default OfferLetterList;
