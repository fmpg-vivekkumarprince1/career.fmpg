import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import QuickCertificateModal from '../certificates/QuickCertificateModal';
import { Award } from 'lucide-react';

const RecentApplicationsTable = ({ applications, getJobById, getStatusLabel, initialShowAll = false }) => {
  const [showAll, setShowAll] = useState(initialShowAll);
  const [certModalOpen, setCertModalOpen] = useState(false);
  const [selectedAppForCert, setSelectedAppForCert] = useState(null);
  
  const getStatusColor = (status) => {
    const colors = {
      pending: { bg: 'bg-amber-900', text: 'text-amber-300', dot: 'bg-amber-500' },
      reviewing: { bg: 'bg-blue-900', text: 'text-blue-300', dot: 'bg-blue-500' },
      shortlisted: { bg: 'bg-blue-900', text: 'text-blue-300', dot: 'bg-blue-600' },
      rejected: { bg: 'bg-red-900', text: 'text-red-300', dot: 'bg-red-500' },
      offered: { bg: 'bg-green-900', text: 'text-green-300', dot: 'bg-green-500' },
      hired: { bg: 'bg-green-900', text: 'text-green-300', dot: 'bg-green-600' },
    };
    return colors[status] || { bg: 'bg-gray-800', text: 'text-gray-300', dot: 'bg-gray-500' };
  };

  return (
    <div className="bg-gray-900 rounded-xl shadow-lg overflow-hidden mb-8 border border-gray-700 scroll-mt-6">
      <div className="bg-gray-800 px-6 py-4 border-b border-gray-700 flex justify-between items-center">
        <h5 className="font-semibold text-gray-100 text-lg">Recent Applications</h5>
        <button 
          onClick={() => setShowAll(!showAll)} 
          className="px-4 py-2 text-sm bg-gray-900 border border-blue-600 text-blue-400 rounded-md hover:bg-gray-800 transition-colors duration-150 inline-flex items-center"
        >
          <span>{showAll ? "Show Less" : "View All"}</span>
          <svg className="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showAll ? "M19 9l-7 7-7-7" : "M9 5l7 7-7 7"} />
          </svg>
        </button>
      </div>
      <div className="p-6">
        {applications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6">
            <svg className="h-16 w-16 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-2 text-gray-400">No applications found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead>
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider bg-gray-800">
                    Applicant
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider bg-gray-800">
                    Job
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider bg-gray-800">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider bg-gray-800">
                    Applied On
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider bg-gray-800">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-gray-900 divide-y divide-gray-700">
                {applications
                  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) // Sort by date, newest first
                  .slice(0, showAll ? applications.length : 10) // Show 10 or all based on state
                  .map(app => {
                    const job = getJobById(app.jobId);
                    const statusColor = getStatusColor(app.status);
                    return (
                      <tr key={app._id} className="hover:bg-gray-800 transition-colors duration-150">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-8 w-8 bg-blue-900 rounded-full flex items-center justify-center text-blue-300 font-medium">
                              {app.fullName.charAt(0).toUpperCase()}
                            </div>
                            <div className="ml-3">
                              <p className="text-sm font-medium text-gray-200">{app.fullName}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-sm text-gray-200">{job.title}</p>
                          <p className="text-xs text-gray-400">{job.company}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusColor.bg} ${statusColor.text}`}>
                            <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${statusColor.dot}`}></span>
                            {getStatusLabel(app.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          {new Date(app.createdAt).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric'
                          })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm flex items-center space-x-2">
                          <Link 
                            to={`/applications/${app.slug || app._id}`} 
                            className="inline-flex items-center px-3 py-1.5 border border-blue-600 text-blue-400 rounded-md hover:bg-gray-800 transition-colors duration-150"
                          >
                            <span>view details</span>
                          </Link>
                          <button
                            onClick={() => {
                              setSelectedAppForCert(app);
                              setCertModalOpen(true);
                            }}
                            className="inline-flex items-center px-2.5 py-1.5 border border-emerald-600/50 text-emerald-400 bg-emerald-950/20 hover:bg-emerald-900/40 rounded-md transition-colors text-xs font-medium"
                            title="Issue certificate in 1-click"
                          >
                            <Award className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                            Certificate
                          </button>
                        </td>
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>
            {!showAll && applications.length > 10 && (
              <div className="mt-4 text-center">
                <p className="text-gray-400">
                  Showing 10 of {applications.length} applications
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick Certificate Modal */}
      {selectedAppForCert && (
        <QuickCertificateModal
          isOpen={certModalOpen}
          onClose={() => {
            setCertModalOpen(false);
            setSelectedAppForCert(null);
          }}
          sourceData={{
            name: selectedAppForCert.name,
            email: selectedAppForCert.email,
            jobrole: getJobById ? getJobById(selectedAppForCert.jobId)?.title : (selectedAppForCert.jobTitle || 'Intern'),
            domain: getJobById ? getJobById(selectedAppForCert.jobId)?.department : 'Web Development',
            fromDate: selectedAppForCert.createdAt,
            toDate: new Date().toISOString().split('T')[0],
            sourceType: 'Application'
          }}
          onSuccess={() => {}}
        />
      )}
    </div>
  );
};

export default RecentApplicationsTable;