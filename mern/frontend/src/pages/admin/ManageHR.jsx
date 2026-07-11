import React, { useState, useEffect } from 'react';
import { hrService, userService } from '../../services/api';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { FaUserShield, FaUsers, FaLock, FaCheck, FaTimes, 
  FaBriefcase, FaCertificate, FaFileInvoice, FaClipboardList,
  FaSearch, FaHistory, FaUserPlus, FaChevronRight, FaInfoCircle,
  FaChartLine
} from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth';
import Loader from '../../components/common/Loader';

const ManageHR = () => {
  const { currentUser, isSuperAdmin } = useAuth();
  const [hrs, setHrs] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [availableJobs, setAvailableJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('list');
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedHR, setSelectedHR] = useState(null);
  
  // Search state for promoting users
  const [searchUserQuery, setSearchUserQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Configuration form state
  const [configForm, setConfigForm] = useState({
    permissions: {
      canGenerateCertificate: false,
      canGenerateOfferLetter: false,
      canCreateJob: false,
      canManageJobs: false,
      canViewApplicants: false,
      canManageReviews: false,
      canManageEmployees: false,
      canManageRecommendations: false,
      canAccessDashboard: false
    },
    assignedJobs: []
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [hrsRes, logsRes, jobsRes] = await Promise.all([
        hrService.getAllHRs(),
        hrService.getAuditLogs(),
        hrService.getAvailableJobs()
      ]);
      setHrs(hrsRes.data);
      setAuditLogs(logsRes.data);
      setAvailableJobs(jobsRes.data);
    } catch (error) {
      toast.error('Failed to load HR management data');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchUsers = async () => {
    if (!searchUserQuery.trim()) return;
    setSearching(true);
    try {
      const res = await userService.getAllUsers({ search: searchUserQuery });
      // Filter out existing HRs (already in HR department)
      const filtered = res.data.users.filter(u => u.department !== 'HR');
      setSearchResults(filtered);
    } catch (error) {
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleOpenConfig = (hr) => {
    setSelectedHR(hr);
    setConfigForm({
      permissions: {
        canGenerateCertificate: hr.permissions?.canGenerateCertificate || false,
        canGenerateOfferLetter: hr.permissions?.canGenerateOfferLetter || false,
        canCreateJob: hr.permissions?.canCreateJob || false,
        canManageJobs: hr.permissions?.canManageJobs || false,
        canViewApplicants: hr.permissions?.canViewApplicants || false,
        canManageReviews: hr.permissions?.canManageReviews || false,
        canManageEmployees: hr.permissions?.canManageEmployees || false,
        canManageRecommendations: hr.permissions?.canManageRecommendations || false,
        canAccessDashboard: hr.permissions?.canAccessDashboard || false
      },
      assignedJobs: hr.assignedJobs?.map(j => (typeof j === 'object' ? j._id : j)) || []
    });
    setShowConfigModal(true);
  };

  const handleTogglePermission = (name) => {
    setConfigForm(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [name]: !prev.permissions[name]
      }
    }));
  };

  const handleToggleJob = (jobId) => {
    setConfigForm(prev => {
      const isAssigned = prev.assignedJobs.includes(jobId);
      if (isAssigned) {
        return { ...prev, assignedJobs: prev.assignedJobs.filter(id => id !== jobId) };
      } else {
        return { ...prev, assignedJobs: [...prev.assignedJobs, jobId] };
      }
    });
  };

  const handlePromoteToHR = async (user) => {
    try {
      await hrService.createHR({ userId: user._id });
      toast.success(`${user.name} added to HR department`);
      setShowAddModal(false);
      setSearchUserQuery('');
      setSearchResults([]);
      fetchInitialData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Promotion failed');
    }
  };

  const handleRevokeHR = async (hrId, name) => {
    if (!window.confirm(`Are you sure you want to revoke HR access from ${name}? Their department will be reset.`)) {
      return;
    }
    
    try {
      await hrService.revokeHR(hrId);
      toast.success(`HR access revoked from ${name}`);
      fetchInitialData();
    } catch (error) {
      toast.error('Revocation failed');
    }
  };

  const handleSaveConfig = async () => {
    try {
      await hrService.updateHRPermissions(selectedHR._id, configForm);
      toast.success('Permissions updated successfully');
      setShowConfigModal(false);
      fetchInitialData();
    } catch (error) {
      toast.error('Update failed');
    }
  };

  const PermissionBadge = ({ enabled, label, icon: Icon }) => (
    <div className={`flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-medium border ${
      enabled 
        ? 'bg-lime-900/30 text-lime-400 border-lime-700/50' 
        : 'bg-gray-800 text-gray-500 border-gray-700'
    }`}>
      <Icon className="w-3 h-3" />
      <span>{label}</span>
    </div>
  );

  if (!isSuperAdmin) {
    return (
      <div className="ui-page flex items-center justify-center">
        <div className="text-center">
          <FaLock className="mx-auto text-red-500 text-5xl mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-gray-400">Super admin authority or high-level admin access is required to manage HR staff.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ui-page">
      <div className="ui-content">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold flex items-center">
              <FaUserShield className="mr-3 text-lime-400" />
              HR Department Management
            </h1>
            <p className="mt-2 text-gray-400">Assign permissions and job-specific authority to HR department staff.</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-4 md:mt-0 flex items-center px-6 py-3 bg-lime-500 hover:bg-lime-400 text-black font-bold rounded-lg transition-all shadow-lg hover:shadow-lime-500/20"
          >
            <FaUserPlus className="mr-2" /> Add to HR Department
          </button>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-gray-900 p-1 rounded-xl mb-8 w-fit border border-gray-800">
          <button
            onClick={() => setActiveTab('list')}
            className={`flex items-center px-6 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'list' 
                ? 'bg-gray-800 text-white shadow-sm border border-gray-700' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <FaUsers className="mr-2" /> HR Directory
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center px-6 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'logs' 
                ? 'bg-gray-800 text-white shadow-sm border border-gray-700' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <FaHistory className="mr-2" /> Audit Logs
          </button>
        </div>

        {loading ? (
          <Loader text="Fetching HR data..." />
        ) : activeTab === 'list' ? (
          <div className="grid grid-cols-1 gap-6">
            {hrs.length === 0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
                <FaUsers className="mx-auto text-gray-700 text-6xl mb-4" />
                <h3 className="text-xl font-bold">No HR users found</h3>
                <p className="text-gray-500 mt-2">Promote a user to get started with granular permissions.</p>
              </div>
            ) : (
              hrs.map((hr) => (
                <motion.div
                  key={hr._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 hover:border-gray-700 transition-all group"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-center space-x-4">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-lime-400 to-lime-600 flex items-center justify-center text-black font-bold text-xl">
                        {hr.name?.charAt(0) || 'H'}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">{hr.name}</h3>
                        <p className="text-gray-500 text-sm">{hr.email}</p>
                      </div>
                    </div>

                    <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 px-4">
                      <PermissionBadge 
                        enabled={hr.permissions?.canGenerateCertificate} 
                        label="Certificates" 
                        icon={FaCertificate} 
                      />
                      <PermissionBadge 
                        enabled={hr.permissions?.canGenerateOfferLetter} 
                        label="Offer Letters" 
                        icon={FaFileInvoice} 
                      />
                      <PermissionBadge
                        enabled={hr.permissions?.canCreateJob}
                        label="Create Jobs"
                        icon={FaBriefcase}
                      />
                      <PermissionBadge
                        enabled={hr.permissions?.canManageJobs}
                        label="Manage Jobs"
                        icon={FaBriefcase}
                      />
                      <PermissionBadge 
                        enabled={hr.permissions?.canViewApplicants} 
                        label="Applicants" 
                        icon={FaClipboardList} 
                      />
                      <PermissionBadge 
                        enabled={hr.permissions?.canManageReviews} 
                        label="Reviews" 
                        icon={FaCheck} 
                      />
                      <PermissionBadge 
                        enabled={hr.permissions?.canManageEmployees} 
                        label="Employees" 
                        icon={FaUsers} 
                      />
                      <PermissionBadge 
                        enabled={hr.permissions?.canManageRecommendations} 
                        label="Recommendations" 
                        icon={FaUsers} 
                      />
                      <PermissionBadge 
                        enabled={hr.permissions?.canAccessDashboard} 
                        label="Dashboard" 
                        icon={FaChartLine} 
                      />
                    </div>

                    <div className="flex items-center space-x-6">
                      <div className="text-right">
                        <p className="text-xs text-gray-500 uppercase font-semibold">Job Access</p>
                        <p className="text-lime-400 font-bold">{hr.assignedJobs?.length || 0} assigned</p>
                      </div>
                      <button
                        onClick={() => handleOpenConfig(hr)}
                        className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors border border-gray-700"
                      >
                        Configure
                      </button>
                      <button
                        onClick={() => handleRevokeHR(hr._id, hr.name)}
                        className="px-4 py-2 bg-red-900/30 hover:bg-red-800/50 text-red-400 rounded-lg text-sm transition-colors border border-red-900/50"
                        title="Revoke HR Role"
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        ) : (
          /* Audit Logs View */
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-800">
                <thead className="bg-gray-800/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase">Timestamp</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase">Admin</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase">Target HR</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase">Action</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {auditLogs.map((log) => (
                    <tr key={log._id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {log.adminId?.name || 'Unknown Admin'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {log.hrId?.name || 'Unknown HR'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                          log.action === 'PROMOTE' ? 'bg-blue-900/40 text-blue-400' : 'bg-amber-900/40 text-amber-400'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400">
                        <pre className="text-[10px] font-mono whitespace-pre-wrap max-w-xs">
                          {JSON.stringify(log.changes, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Promote Modal */}
        <AnimatePresence>
          {showAddModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-md p-8 shadow-2xl"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold">Add User to HR Dept</h2>
                  <button onClick={() => setShowAddModal(false)} className="text-gray-500 hover:text-white">
                    <FaTimes size={24} />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className="relative">
                    <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      type="text"
                      placeholder="Search by name or email..."
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-lime-500 focus:border-transparent outline-none"
                      value={searchUserQuery}
                      onChange={(e) => setSearchUserQuery(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSearchUsers()}
                    />
                  </div>
                  <button
                    onClick={handleSearchUsers}
                    disabled={searching}
                    className="w-full py-3 bg-gray-800 hover:bg-gray-700 font-bold rounded-xl transition-colors"
                  >
                    {searching ? 'Searching...' : 'Search'}
                  </button>

                  <div className="max-h-60 overflow-y-auto mt-4 space-y-2 pr-2">
                    {searchResults.map(user => (
                      <div key={user._id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-xl border border-gray-700 hover:border-lime-500/50 transition-colors">
                        <div>
                          <p className="font-bold">{user.name}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                        <button
                          onClick={() => handlePromoteToHR(user)}
                          className="px-3 py-1 bg-lime-500 text-black font-bold text-xs rounded-md hover:bg-lime-400 transition-all"
                        >
                          Promote
                        </button>
                      </div>
                    ))}
                    {searchResults.length === 0 && searchUserQuery && !searching && (
                      <p className="text-center text-gray-500 py-4 italic">No suitable users found.</p>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Configuration Modal */}
        <AnimatePresence>
          {showConfigModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
              >
                <div className="p-8 border-b border-gray-800 flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold">Configure HR: {selectedHR?.name}</h2>
                    <p className="text-gray-500 text-sm">{selectedHR?.email}</p>
                  </div>
                  <button onClick={() => setShowConfigModal(false)} className="text-gray-500 hover:text-white">
                    <FaTimes size={24} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    {/* Permissions Section */}
                    <div>
                      <h3 className="text-lg font-bold mb-6 flex items-center">
                        <FaLock className="mr-2 text-amber-500" /> Granular Permissions
                      </h3>
                      <div className="space-y-4">
                        {[
                          { id: 'canGenerateCertificate', label: 'Certificate Generation', desc: 'Allows HR to issue and sign certificates.' },
                          { id: 'canGenerateOfferLetter', label: 'Offer Letter Generation', desc: 'Allows HR to generate and extend offer letters.' },
                          { id: 'canCreateJob', label: 'Job Creation', desc: 'Allows HR to create new draft jobs.' },
                          { id: 'canManageJobs', label: 'Job Management', desc: 'Allows assigned jobs to be viewed, edited, published, or unpublished.' },
                          { id: 'canViewApplicants', label: 'Applicant Insights', desc: 'Allows viewing detailed applicant profiles.' },
                          { id: 'canManageReviews', label: 'Review Moderation', desc: 'Allows approving/rejecting user reviews.' },
                          { id: 'canManageEmployees', label: 'Employee Tracking', desc: 'Full access to employee management dashboard.' },
                          { id: 'canManageRecommendations', label: 'Recommendation Management', desc: 'Allows HR to manage candidate recommendations.' },
                          { id: 'canAccessDashboard', label: 'Dashboard Access', desc: 'Allows access to the main HR analytics dashboard.' }
                        ].map(perm => (
                          <div 
                            key={perm.id} 
                            onClick={() => handleTogglePermission(perm.id)}
                            className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                              configForm.permissions[perm.id] 
                                ? 'bg-lime-500/10 border-lime-500/50 shadow-[0_0_15px_rgba(132,204,22,0.1)]' 
                                : 'bg-gray-800/30 border-gray-800 hover:border-gray-700'
                            }`}
                          >
                            <div className="flex justify-between items-center mb-1">
                              <span className={`font-bold ${configForm.permissions[perm.id] ? 'text-lime-400' : 'text-gray-300'}`}>
                                {perm.label}
                              </span>
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${
                                configForm.permissions[perm.id] ? 'bg-lime-500 border-lime-500 text-black' : 'border-gray-600'
                              }`}>
                                {configForm.permissions[perm.id] && <FaCheck size={12} />}
                              </div>
                            </div>
                            <p className="text-xs text-gray-500">{perm.desc}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Job Authority Section */}
                    <div>
                      <h3 className="text-lg font-bold mb-6 flex items-center">
                        <FaBriefcase className="mr-2 text-blue-500" /> Job-Specific Authority
                      </h3>
                      <div className="bg-gray-800/30 rounded-2xl border border-gray-800 p-2 max-h-[480px] overflow-y-auto">
                        {availableJobs.map(job => (
                          <div 
                            key={job._id}
                            onClick={() => handleToggleJob(job._id)}
                            className={`p-4 m-2 rounded-xl flex items-center justify-between cursor-pointer transition-colors ${
                              configForm.assignedJobs.includes(job._id)
                                ? 'bg-gray-700/50'
                                : 'hover:bg-gray-800'
                            }`}
                          >
                            <div>
                              <p className="font-bold text-sm">{job.title}</p>
                              <p className="text-[10px] text-gray-500 uppercase tracking-wider">{job.company} • {job.location}</p>
                            </div>
                            <div className={`w-5 h-5 rounded border ${
                              configForm.assignedJobs.includes(job._id) 
                                ? 'bg-blue-500 border-blue-500 flex items-center justify-center text-white' 
                                : 'border-gray-600'
                            }`}>
                              {configForm.assignedJobs.includes(job._id) && <FaCheck size={10} />}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 p-4 bg-gray-900/50 rounded-xl border border-gray-800 flex items-start">
                        <FaInfoCircle className="text-gray-500 mr-3 mt-1 flex-shrink-0" />
                        <p className="text-xs text-gray-500">
                          HR will only see applicants and reports for the jobs checked above. If no jobs are selected, they won't see any job data.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-8 border-t border-gray-800 bg-gray-900/50 flex justify-end space-x-4">
                  <button
                    onClick={() => setShowConfigModal(false)}
                    className="px-6 py-3 text-gray-400 hover:text-white font-bold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveConfig}
                    className="px-10 py-3 bg-lime-500 hover:bg-lime-400 text-black font-bold rounded-xl transition-all shadow-xl hover:shadow-lime-500/20"
                  >
                    Apply Changes
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
};

export default ManageHR;
