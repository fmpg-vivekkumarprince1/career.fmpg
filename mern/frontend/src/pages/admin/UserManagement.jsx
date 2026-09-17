import React, { useState, useEffect } from 'react';
import { userService } from '../../services/api';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import { FaUser, FaSearch, FaFilter, FaEdit, FaTrash, FaEye, FaUsers, FaCheck, FaBan, FaEnvelope, FaPhone, FaChevronLeft, FaChevronRight, FaUserPlus } from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth';
import Loader from '../../components/common/Loader';
import { ROLES, STATUS, DEPARTMENTS } from '../../utils/constants';

const UserManagement = () => {
  const { isSuperAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0
  });
  const [userDetailLoading, setUserDetailLoading] = useState(false);
  const [editForm, setEditForm] = useState({
    status: ''
  });
  const [totalResults, setTotalResults] = useState(0);

  // Add User State (Super Admin Only)
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [addUserLoading, setAddUserLoading] = useState(false);
  const [addUserForm, setAddUserForm] = useState({
    name: '',
    email: '',
    password: '',
    phoneNumber: '',
    role: 'user',
    status: 'active',
    department: '',
    position: ''
  });

  useEffect(() => {
    fetchUsers();
  }, [currentPage, searchTerm, filterStatus]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = {
        page: currentPage,
        limit: 10,
        view: 'users' // Only regular users
      };

      if (searchTerm) params.search = searchTerm;
      if (filterStatus) params.status = filterStatus;

      const response = await userService.getAllUsers(params);
      setUsers(response.data.users);
      if (response.data.stats) {
        setStats({
          totalUsers: response.data.stats.totalUsers,
          activeUsers: response.data.stats.activeUsers
        });
      }
      setTotalPages(response.data.pagination?.totalPages || 1);
      setTotalResults(response.data.pagination?.total || 0);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleViewUser = async (user) => {
    setUserDetailLoading(true);
    setSelectedUser(user);
    setEditForm({
      status: user.status || 'active'
    });
    setShowUserModal(true);

    try {
      const response = await userService.getUserById(user._id);
      setSelectedUser(response.data.user);
    } catch (error) {
      console.error('Error fetching user details:', error);
    } finally {
      setUserDetailLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    try {
      await userService.updateUserStatus(selectedUser._id, { status: editForm.status });
      toast.success('User status updated successfully');
      setShowUserModal(false);
      fetchUsers();
    } catch (error) {
      console.error('Error updating user status:', error);
      toast.error('Failed to update user status');
    }
  };

  const handleCreateUser = async (e) => {
    e?.preventDefault();
    if (!addUserForm.name.trim() || !addUserForm.email.trim() || !addUserForm.password) {
      toast.error('Name, email, and password are required');
      return;
    }

    try {
      setAddUserLoading(true);
      await userService.createUser(addUserForm);
      toast.success('User created successfully!');
      setShowAddUserModal(false);
      setAddUserForm({
        name: '',
        email: '',
        password: '',
        phoneNumber: '',
        role: 'user',
        status: 'active',
        department: '',
        position: ''
      });
      fetchUsers();
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error(error.response?.data?.message || 'Failed to create user');
    } finally {
      setAddUserLoading(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await userService.deleteUser(userId);
        toast.success('User deleted successfully');
        fetchUsers();
      } catch (error) {
        console.error('Error deleting user:', error);
        toast.error('Failed to delete user');
      }
    }
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      // Application Statuses
      'pending': 'bg-yellow-900/40 text-yellow-400 border border-yellow-700/50',
      'reviewing': 'bg-blue-900/40 text-blue-400 border border-blue-700/50',
      'shortlisted': 'bg-indigo-900/40 text-indigo-400 border border-indigo-700/50',
      'rejected': 'bg-red-900/40 text-red-400 border border-red-700/50',
      'offered': 'bg-green-900/40 text-green-400 border border-green-700/50',
      'hired': 'bg-teal-900/40 text-teal-400 border border-teal-700/50',
      'Not Applied': 'bg-gray-800 text-gray-500 border border-gray-700'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status] || 'bg-gray-700 text-gray-300 border border-gray-600'}`}>
        {status?.charAt(0).toUpperCase() + status?.slice(1) || 'Not Applied'}
      </span>
    );
  };

  return (
    <div className="ui-page">
      <div className="ui-content">
        <div className="ui-page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <span className="fmpg-kicker">People</span>
            <h1 className="ui-page-title mt-3">User management</h1>
            <p className="ui-page-subtitle">Review registered candidates, application activity, and account details.</p>
          </div>
          {isSuperAdmin && (
            <button
              onClick={() => setShowAddUserModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm transition-all shadow-md shadow-emerald-950/20 self-start md:self-auto cursor-pointer"
            >
              <FaUserPlus className="w-4 h-4" />
              <span>Add User</span>
            </button>
          )}
        </div>
        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="ui-card p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100 bg-opacity-20">
                <FaUsers className="h-6 w-6 text-blue-500" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Total Registered Users</p>
                <p className="text-2xl font-bold text-white">{stats.totalUsers}</p>
              </div>
            </div>
          </div>
          
          <div className="ui-card p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100 bg-opacity-20">
                <FaCheck className="h-6 w-6 text-green-500" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Active User Accounts</p>
                <p className="text-2xl font-bold text-white">{stats.activeUsers}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="ui-card p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, email or phone..."
                className="ui-input pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="relative">
              <FaFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
              <select
                className="ui-select appearance-none pl-10 cursor-pointer"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">All App Status</option>
                <option value="pending">Pending</option>
                <option value="reviewing">Reviewing</option>
                <option value="shortlisted">Shortlisted</option>
                <option value="offered">Offered</option>
                <option value="hired">Hired</option>
                <option value="rejected">Rejected</option>
                <option value="Not Applied">Not Applied</option>
              </select>
            </div>

            <button
              onClick={() => { setSearchTerm(''); setFilterStatus(''); setCurrentPage(1); }}
              className="fmpg-secondary-button px-4 py-2 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div className="ui-card overflow-hidden">
          <div className="ui-card-header flex justify-between items-center">
            <h2 className="text-xl font-semibold text-slate-900">User directory</h2>
            <div className="text-sm text-slate-500">Page {currentPage} of {totalPages}</div>
          </div>
          
          {loading ? (
            <Loader text="Loading users..." />
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No users found.</div>
          ) : (
            <div className="ui-table-shell border-0 rounded-none">
              <table className="min-w-full divide-y divide-gray-700">
                <thead>
                  <tr>
                    <th scope="col">User</th>
                    <th scope="col">Contact</th>
                    <th scope="col">Application status</th>
                    <th scope="col" className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {users.map((user) => (
                    <tr key={user._id} className="transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                            {user.name?.charAt(0).toUpperCase()}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-slate-900">{user.name}</div>
                            <div className="text-xs text-gray-400">Joined {new Date(user.createdAt).toLocaleDateString()}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-300 flex items-center mb-1">
                          <FaEnvelope className="mr-2 text-gray-500 text-xs" /> {user.email}
                        </div>
                        {user.phoneNumber && (
                          <div className="text-sm text-gray-300 flex items-center">
                            <FaPhone className="mr-2 text-gray-500 text-xs" /> {user.phoneNumber}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(user.applicationStatus)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button onClick={() => handleViewUser(user)} className="text-blue-500 hover:text-blue-400 mr-4"><FaEye /></button>
                        {isSuperAdmin && (
                          <button onClick={() => handleDeleteUser(user._id)} className="text-red-500 hover:text-red-400"><FaTrash /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-gray-900 px-4 py-3 border-t border-gray-700 sm:px-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-300">
                  Showing {((currentPage - 1) * 10) + 1} to{' '}
                  {Math.min(currentPage * 10, totalResults)} of{' '}
                  {totalResults} results
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="p-2 border border-gray-700 rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
                  >
                    <FaChevronLeft className="w-5 h-5" />
                  </button>
                  
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let page;
                    if (totalPages <= 5) {
                      page = i + 1;
                    } else if (currentPage <= 3) {
                      page = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      page = totalPages - 4 + i;
                    } else {
                      page = currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-2 border rounded-md transition-colors ${
                          page === currentPage
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'border-gray-700 hover:bg-gray-800 text-white'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                  
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 border border-gray-700 rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
                  >
                    <FaChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User Detail/Edit Modal */}
      {showUserModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-75">
          <div className="bg-gray-900 rounded-lg max-w-lg w-full border border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-700 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">User Details</h3>
              <button onClick={() => setShowUserModal(false)} className="text-gray-400 hover:text-white"><FaTimes className="w-5 h-5" /></button>
            </div>
            
            <div className="p-6">
              <div className="flex items-center mb-6">
                <div className="h-16 w-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-bold">
                  {selectedUser.name?.charAt(0).toUpperCase()}
                </div>
                <div className="ml-4">
                  <h4 className="text-lg font-semibold text-white">{selectedUser.name}</h4>
                  <p className="text-gray-400">{selectedUser.email}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Account Status</label>
                  <select
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-md py-2 px-3 outline-none focus:ring-2 focus:ring-blue-500"
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>

                {selectedUser.phoneNumber && (
                  <div>
                    <span className="text-sm font-medium text-gray-400">Phone Number:</span>
                    <span className="ml-2 text-white">{selectedUser.phoneNumber}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 bg-gray-800 text-right">
              <button 
                onClick={() => setShowUserModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white mr-2"
              >
                Cancel
              </button>
              <button 
                onClick={handleUpdateStatus}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal (Super Admin Only) */}
      {isSuperAdmin && showAddUserModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/60">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <FaUserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Add New User</h3>
                  <p className="text-xs text-slate-400">Create a new account with customized role and credentials.</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddUserModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <FaTimes className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser}>
              <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                      Full Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Alex Morgan"
                      className="w-full bg-slate-800/90 border border-slate-700 text-white rounded-lg py-2.5 px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder-slate-500"
                      value={addUserForm.name}
                      onChange={(e) => setAddUserForm({ ...addUserForm, name: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                      Email Address <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="user@example.com"
                      className="w-full bg-slate-800/90 border border-slate-700 text-white rounded-lg py-2.5 px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder-slate-500"
                      value={addUserForm.email}
                      onChange={(e) => setAddUserForm({ ...addUserForm, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                      Password <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Minimum 6 characters"
                      className="w-full bg-slate-800/90 border border-slate-700 text-white rounded-lg py-2.5 px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder-slate-500"
                      value={addUserForm.password}
                      onChange={(e) => setAddUserForm({ ...addUserForm, password: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      placeholder="+91 98765 43210"
                      className="w-full bg-slate-800/90 border border-slate-700 text-white rounded-lg py-2.5 px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder-slate-500"
                      value={addUserForm.phoneNumber}
                      onChange={(e) => setAddUserForm({ ...addUserForm, phoneNumber: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                      Role
                    </label>
                    <select
                      className="w-full bg-slate-800/90 border border-slate-700 text-white rounded-lg py-2.5 px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer"
                      value={addUserForm.role}
                      onChange={(e) => setAddUserForm({ ...addUserForm, role: e.target.value })}
                    >
                      <option value="user">User / Candidate</option>
                      <option value="employee">Employee</option>
                      <option value="admin">Admin</option>
                      <option value="hr-admin">HR Admin</option>
                      <option value="manager">Manager</option>
                      <option value="recruiter">Recruiter</option>
                      <option value="finance">Finance</option>
                      <option value="payroll-admin">Payroll Admin</option>
                      <option value="verifier">Verifier</option>
                      <option value="super-admin">Super Admin</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                      Account Status
                    </label>
                    <select
                      className="w-full bg-slate-800/90 border border-slate-700 text-white rounded-lg py-2.5 px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer"
                      value={addUserForm.status}
                      onChange={(e) => setAddUserForm({ ...addUserForm, status: e.target.value })}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                      Department (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Engineering, Sales"
                      className="w-full bg-slate-800/90 border border-slate-700 text-white rounded-lg py-2.5 px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder-slate-500"
                      value={addUserForm.department}
                      onChange={(e) => setAddUserForm({ ...addUserForm, department: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                      Position (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Senior Developer"
                      className="w-full bg-slate-800/90 border border-slate-700 text-white rounded-lg py-2.5 px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder-slate-500"
                      value={addUserForm.position}
                      onChange={(e) => setAddUserForm({ ...addUserForm, position: e.target.value })}
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-xs text-emerald-300">
                  <span className="font-semibold">Super Admin Note:</span> The newly created account will be pre-verified and active immediately for instant login.
                </div>
              </div>

              <div className="p-5 border-t border-slate-800 bg-slate-900/80 flex justify-end items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addUserLoading}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-all shadow-md shadow-emerald-950/30 flex items-center gap-2"
                >
                  {addUserLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Creating User...</span>
                    </>
                  ) : (
                    <>
                      <FaUserPlus className="w-4 h-4" />
                      <span>Create User</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Simple FaTimes replacement since I didn't import it in icons list correctly
const FaTimes = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
  </svg>
);

export default UserManagement;
