import React, { useState, useEffect } from 'react';
import { userService, offerLetterService, contractService } from '../../services/api';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import { FaUser, FaUserTie, FaUserShield, FaSearch, FaFilter, FaEdit, FaTrash, FaEye, FaCheck, FaTimes, FaDownload, FaCog, FaUsers, FaClock, FaBan, FaCrown, FaChevronLeft, FaChevronRight, FaFileAlt, FaFileContract, FaUserPlus } from 'react-icons/fa';
import { CSVLink } from 'react-csv';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import Loader from '../../components/common/Loader';
import { ROLES, STATUS, DEPARTMENTS, DEPARTMENT_POSITIONS, POSITION_LEVELS } from '../../utils/constants';

const EmployeeManagement = () => {
  const { currentUser, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const handleDownloadSample = () => {
    const headers = [
      'name', 'email', 'phoneNumber', 'role', 'department', 'position', 'reportingManager',
      'offerSalary', 'offerStartDate', 'offerWorkType', 'offerBenefits', 'offerComments',
      'dob', 'nationality', 'street', 'city', 'state', 'zip', 'country', 
      'idType', 'idNumber', 'bankName', 'bankAccountName', 'bankAccountNumber', 'bankIfsc', 'bankBranch',
      'emergencyName', 'emergencyRelation', 'emergencyPhone', 'emergencyEmail'
    ];
    
    const sampleData = [
      ['John Doe', 'john@example.com', '9876543210', 'employee', 'Engineering', 'Software Engineer', 'Jane Smith', '50000', '2024-04-01', 'Full-time', 'Health;Bonus', 'Welcome aboard!', '1990-01-01', 'Indian', '123 Main St', 'Mumbai', 'Maharashtra', '400001', 'India', 'Aadhar', '123456789012', 'HDFC Bank', 'John Doe', '50100123456789', 'HDFC0001234', 'Andheri West', 'Jane Doe', 'Spouse', '9876543211', 'jane@example.com']
    ];

    const csvContent = [
      headers.join(','),
      ...sampleData.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'employee_bulk_upload_sample.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUploadCSV = async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      setLoading(true);
      const response = await userService.bulkUploadEmployees(formData);
      toast.success(response.message);
      
      // Refresh user list and stats
      await fetchUsers();
      
      setShowBulkModal(false);
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error(error.response?.data?.message || 'Error uploading CSV');
    } finally {
      setLoading(false);
    }
  };
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalAdmins: 0,
    totalSuperAdmins: 0,
    totalEmployees: 0,
    activeStaff: 0,
    activeUsers: 0,
    totalActiveAccounts: 0,
    inactiveAccounts: 0,
    formerEmployees: 0,
    suspendedAccounts: 0
  });
  const [userDetailLoading, setUserDetailLoading] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [showOfferContractModal, setShowOfferContractModal] = useState(false);
  const [offerContractData, setOfferContractData] = useState(null);
  const [offerContractLoading, setOfferContractLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('offer'); // 'offer' or 'contract'
  const [selectedFile, setSelectedFile] = useState(null);
  const [expandedSection, setExpandedSection] = useState('required');

  // Add Employee State (Super Admin Only)
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [addEmployeeLoading, setAddEmployeeLoading] = useState(false);
  const [addEmployeeForm, setAddEmployeeForm] = useState({
    employeeId: '',
    name: '',
    email: '',
    password: '',
    phoneNumber: '',
    role: 'employee',
    status: 'active',
    department: 'Development',
    position: 'Frontend Developer',
    employmentType: 'full_time',
    joiningDate: new Date().toISOString().split('T')[0],
    reportingManager: '',
    workLocation: 'Office'
  });

  const handleCreateEmployee = async (e) => {
    e?.preventDefault();
    if (!addEmployeeForm.name.trim() || !addEmployeeForm.email.trim() || !addEmployeeForm.password) {
      toast.error('Name, email, and password are required');
      return;
    }

    try {
      setAddEmployeeLoading(true);
      await userService.createEmployee(addEmployeeForm);
      toast.success('Employee created successfully!');
      setShowAddEmployeeModal(false);
      setAddEmployeeForm({
        employeeId: '',
        name: '',
        email: '',
        password: '',
        phoneNumber: '',
        role: 'employee',
        status: 'active',
        department: 'Development',
        position: 'Frontend Developer',
        employmentType: 'full_time',
        joiningDate: new Date().toISOString().split('T')[0],
        reportingManager: '',
        workLocation: 'Office'
      });
      fetchUsers();
    } catch (error) {
      console.error('Error creating employee:', error);
      toast.error(error.response?.data?.message || 'Failed to create employee');
    } finally {
      setAddEmployeeLoading(false);
    }
  };

  const handleViewOfferContract = async (user, tab = 'offer') => {
    // Both user.offerLetter (from populate) or user.latestOffer might be available
    const offerRef = user.offerLetter || user.latestOffer;
    
    if (!offerRef) {
      toast.info('No offer details found for this employee');
      return;
    }

    try {
      setOfferContractLoading(true);
      setShowOfferContractModal(true);
      setActiveTab(tab);
      
      // Use the offer ID directly (could be a string or an object with _id)
      const offerId = offerRef._id || (typeof offerRef === 'string' ? offerRef : null);
      
      if (!offerId) {
        toast.error('Could not identify offer letter ID');
        setShowOfferContractModal(false);
        return;
      }

      try {
        // Pass offer ID as "applicationId" - backend now supports this as fallback
        const response = await contractService.getContractByApplicationId(offerId);
        setOfferContractData({
          offer: response.data.offerLetter,
          contract: response.data.contract
        });
      } catch (err) {
        console.log("Contract fetch failed, falling back to offer letter only");
        const fetchOfferId = offerRef._id || (typeof offerRef === 'string' ? offerRef : offerRef);
        const offerResponse = await offerLetterService.getOfferLetterById(fetchOfferId);
        setOfferContractData({
          offer: offerResponse.data,
          contract: null
        });
      }
    } catch (error) {
      console.error('Error fetching onboarding details:', error);
      toast.error('Failed to load onboarding details');
      setShowOfferContractModal(false);
    } finally {
      setOfferContractLoading(false);
    }
  };
  const [selectedColumns, setSelectedColumns] = useState({
    name: true,
    email: true,
    phone: true,
    role: true,
    status: true,
    department: true,
    position: true,
    createdAt: true
  });
  const [csvData, setCsvData] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [filteredUsersCount, setFilteredUsersCount] = useState(0);
  const [csvExportFilters, setCsvExportFilters] = useState({
    role: '',
    status: '',
    search: ''
  });
  const [csvFilterOptions, setCsvFilterOptions] = useState({
    selectedRole: '',
    selectedStatus: '',
    useCurrentFilters: false
  });
  const [totalResults, setTotalResults] = useState(0);
  const [editForm, setEditForm] = useState({
    role: '',
    status: '',
    department: '',
    position: ''
  });

  useEffect(() => {
    fetchUsers();
  }, [currentPage, searchTerm, filterRole, filterStatus]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = {
        page: currentPage,
        limit: 10,
        view: 'staff',
      };

      if (searchTerm) params.search = searchTerm;
      if (filterRole) params.role = filterRole;
      if (filterStatus) params.status = filterStatus;

      const response = await userService.getAllUsers(params);
      setUsers(response.data.users);
      if (response.data.stats) {
        setStats(response.data.stats);
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

  const fetchAllUsers = async (exportOptions = {}) => {
    try {
      const params = {
        page: 1,
        limit: 1000, // Get all users for CSV export
        view: 'staff',
      };

      // Apply export-specific filters
      if (exportOptions.role) {
        params.role = exportOptions.role;
      }
      if (exportOptions.status) {
        params.status = exportOptions.status;
      }
      if (exportOptions.search) {
        params.search = exportOptions.search;
      }

      // Store the filters used for CSV export
      setCsvExportFilters({
        role: exportOptions.role || '',
        status: exportOptions.status || '',
        search: exportOptions.search || ''
      });

      const response = await userService.getAllUsers(params);
      setAllUsers(response.data.users);
      setFilteredUsersCount(response.data.users.length);
    } catch (error) {
      console.error('Error fetching all users:', error);
      toast.error('Failed to fetch users for export');
    }
  };

  const handleCSVExport = async () => {
    // Initialize with current page filters
    setCsvFilterOptions({
      selectedRole: filterRole,
      selectedStatus: filterStatus,
      useCurrentFilters: false
    });
    // Clear previous data to show selection interface
    setAllUsers([]);
    setCsvExportFilters({ role: '', status: '', search: '' });
    setShowCSVModal(true);
  };

  const handleExportWithFilters = async () => {
    const exportOptions = {};
    
    if (csvFilterOptions.selectedRole) {
      exportOptions.role = csvFilterOptions.selectedRole;
    }
    if (csvFilterOptions.selectedStatus) {
      exportOptions.status = csvFilterOptions.selectedStatus;
    }
    
    await fetchAllUsers(exportOptions);
  };

  const handleExportAll = async () => {
    await fetchAllUsers({});
  };

  const handleExportCurrentView = async () => {
    const exportOptions = {};
    if (searchTerm) exportOptions.search = searchTerm;
    if (filterRole) exportOptions.role = filterRole;
    if (filterStatus) exportOptions.status = filterStatus;
    
    await fetchAllUsers(exportOptions);
  };

  const generateCSVFilename = () => {
    const date = new Date().toISOString().split('T')[0];
    let filename = `employees-export-${date}`;
    
    // Add filter information to filename
    const filters = [];
    if (csvFilterOptions.selectedRole) filters.push(`role-${csvFilterOptions.selectedRole}`);
    if (csvFilterOptions.selectedStatus) filters.push(`status-${csvFilterOptions.selectedStatus}`);
    if (csvExportFilters.role) filters.push(`legacy-role-${csvExportFilters.role}`);
    if (csvExportFilters.status) filters.push(`legacy-status-${csvExportFilters.status}`);
    if (csvExportFilters.search) filters.push(`search-${csvExportFilters.search.replace(/[^a-zA-Z0-9]/g, '')}`);
    
    if (filters.length > 0) {
      filename += `-filtered-${filters.join('-')}`;
    }
    
    return `${filename}.csv`;
  };

  const generateCSVData = () => {
    const selectedKeys = Object.keys(selectedColumns).filter(key => selectedColumns[key]);
    
    const headerMap = {
      name: 'Full Name',
      email: 'Email',
      phone: 'Phone',
      role: 'Role',
      status: 'Status',
      department: 'Department',
      position: 'Position',
      createdAt: 'Joined Date'
    };

    const headers = selectedKeys.map(key => headerMap[key] || key);

    const data = allUsers.map(user => {
      const row = {};
      selectedKeys.forEach(key => {
        if (key === 'createdAt') {
          row[headerMap[key] || key] = formatDate(user[key]);
        } else if (key === 'status') {
          row[headerMap[key] || key] = user[key] || 'active';
        } else {
          row[headerMap[key] || key] = user[key] || '-';
        }
      });
      return row;
    });

    return [headers, ...data.map(row => selectedKeys.map(key => row[headerMap[key] || key]))];
  };

  const handleColumnToggle = (column) => {
    setSelectedColumns(prev => ({
      ...prev,
      [column]: !prev[column]
    }));
  };

  const selectAllColumns = () => {
    const allSelected = Object.keys(selectedColumns).reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {});
    setSelectedColumns(allSelected);
  };

  const deselectAllColumns = () => {
    const allDeselected = Object.keys(selectedColumns).reduce((acc, key) => {
      acc[key] = false;
      return acc;
    }, {});
    setSelectedColumns(allDeselected);
  };

  const handleViewUser = async (user) => {
    setUserDetailLoading(true);
    setSelectedUser(user);
    setEditForm({
      role: user.role,
      status: user.status || 'active',
      department: user.department || '',
      position: user.position || '',
      positionLevel: user.positionLevel || 'Junior'
    });
    setShowUserModal(true);

    try {
      const response = await userService.getUserById(user._id);
      setSelectedUser({
        ...response.data.user,
        offerLetters: response.data.offerLetters || [],
        certificates: response.data.certificates || []
      });
    } catch (error) {
      console.error('Error fetching user details:', error);
      toast.error('Failed to load complete user details');
    } finally {
      setUserDetailLoading(false);
    }
  };

  const handleUpdateUser = async () => {
    try {
      // Update basic user info (including role for superadmin)
      const basicUpdateData = {
        status: editForm.status,
        department: editForm.department,
        position: editForm.position,
        positionLevel: editForm.positionLevel,
        role: editForm.role
      };
      
      const response = await userService.updateUserStatus(selectedUser._id, basicUpdateData);
      toast.success(response.data.message || 'User updated successfully');
      setShowUserModal(false);
      fetchUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      const errorMsg = error.response?.data?.message || 'Failed to update user';
      toast.error(errorMsg);
    }
  };

  const handleUpdateAccountStatus = async (userId, newStatus) => {
    try {
      await userService.updateAccountStatus(userId, { status: newStatus });
      toast.success(`Status updated to ${newStatus}`);
      fetchUsers(); // Refresh the users list
    } catch (error) {
      console.error('Error updating account status:', error);
      toast.error('Failed to update account status');
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

  const handleTerminateEmployee = async (user) => {
    if (user.status === 'former') {
      toast.info('This user is already terminated');
      return;
    }

    const confirmed = window.confirm(`Are you sure you want to terminate ${user.name}?`);
    if (!confirmed) return;

    const reason = window.prompt('Enter termination reason (optional):') || '';

    try {
      await userService.terminateEmployee(user._id, { reason });
      toast.success(`${user.name} has been terminated successfully`);
      fetchUsers();
    } catch (error) {
      console.error('Error terminating employee:', error);
      toast.error(error.response?.data?.message || 'Failed to terminate employee');
    }
  };

  const handleIssueCertificateForUser = (user) => {
    const fromDate = user.latestOffer?.startDate
      ? new Date(user.latestOffer.startDate).toISOString().split('T')[0]
      : '';
    const toDate = user.latestOffer?.validUntil
      ? new Date(user.latestOffer.validUntil).toISOString().split('T')[0]
      : '';

    const query = new URLSearchParams({
      tab: 'issue',
      name: user.name || '',
      email: user.email || '',
      domain: user.department || 'Internship',
      jobrole: user.position || 'Intern',
      fromDate,
      toDate
    }).toString();

    navigate(`/certificates?${query}`);
  };

  const handleManageOfferLetter = (user) => {
    if (!user.email) {
      toast.error('User email is required to manage offer letters');
      return;
    }

    const query = new URLSearchParams({
      tab: 'alloffers',
      email: user.email || '',
      action: 'extend'
    }).toString();

    navigate(`/certificates?${query}`);
  };

  const handleViewOfferHistory = (user) => {
    if (!user.email) {
      toast.error('User email is required to view offer history');
      return;
    }

    const query = new URLSearchParams({
      tab: 'alloffers',
      email: user.email || ''
    }).toString();

    navigate(`/certificates?${query}`);
  };

  const handleUpdateUserRole = async (userId, newRole) => {
    if (!isSuperAdmin) {
      toast.error('Super admin authority required to change user roles');
      return;
    }

    if (window.confirm(`Are you sure you want to change this user's role to ${newRole}?`)) {
      try {
        await userService.updateUserRole(userId, { role: newRole });
        toast.success(`User role updated to ${newRole}`);
        fetchUsers();
      } catch (error) {
        console.error('Error updating user role:', error);
        toast.error('Failed to update user role');
      }
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin':
        return <FaUserShield className="text-red-500" />;
      case 'user':
        return <FaUser className="text-blue-500" />;
      default:
        return <FaUserTie className="text-gray-500" />;
    }
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      active: 'bg-green-900 text-green-300 border border-green-700',
      inactive: 'bg-red-900 text-red-300 border border-red-700',
      former: 'bg-gray-900 text-gray-300 border border-gray-700',
      suspended: 'bg-orange-900 text-orange-300 border border-orange-700'
    };

    const statusLabels = {
      active: 'Active',
      inactive: 'Inactive',
      former: 'Former',
      suspended: 'Suspended'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status] || 'bg-gray-700 text-gray-300 border border-gray-600'}`}>
        {statusLabels[status] || status || 'Active'}
      </span>
    );
  };


  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="ui-page">
      <div className="ui-content">
        <header className="ui-page-header flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <span className="fmpg-kicker">People operations</span>
            <div className="mt-3 flex items-start gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <FaUsers className="h-5 w-5" />
              </span>
              <div>
                <h1 className="ui-page-title">Employee management</h1>
                <p className="ui-page-subtitle">Manage staff profiles, employment status, permissions, and contracts.</p>
              </div>
            </div>
          </div>
            <div className="flex items-center space-x-3">
              {isSuperAdmin && (
                <button
                  onClick={() => setShowAddEmployeeModal(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm transition-all shadow-md shadow-emerald-950/20 cursor-pointer"
                >
                  <FaUserPlus className="w-4 h-4" />
                  <span>Add Employee</span>
                </button>
              )}
              <button
                onClick={handleCSVExport}
                className="fmpg-secondary-button inline-flex items-center space-x-2 px-4 py-2.5 transition-colors"
              >
                <FaDownload />
                <span>Export CSV</span>
              </button>
            </div>
        </header>

        {/* Employee Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className=" rounded-lg p-6 border border-gray-700">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100 bg-opacity-20">
                <FaUsers className="h-6 w-6 text-blue-500" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Total Staff</p>
                <p className="text-2xl font-bold text-white">{(stats.totalEmployees || 0) + (stats.totalAdmins || 0) + (stats.totalSuperAdmins || 0)}</p>
              </div>
            </div>
          </div>
          
          <div className=" rounded-lg p-6 border border-gray-700">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-purple-100 bg-opacity-20">
                <FaUserShield className="h-6 w-6 text-purple-500" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Total Admins</p>
                <p className="text-2xl font-bold text-white">
                  {stats.totalAdmins}
                </p>
              </div>
            </div>
          </div>
          
          <div className=" rounded-lg p-6 border border-gray-700">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-indigo-100 bg-opacity-20">
                <FaUserTie className="h-6 w-6 text-indigo-500" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Total Employees</p>
                <p className="text-2xl font-bold text-white">
                  {stats.totalEmployees}
                </p>
              </div>
            </div>
          </div>
          
          <div className=" rounded-lg p-6 border border-gray-700">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100 bg-opacity-20">
                <FaCrown className="h-6 w-6 text-yellow-500" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Super Admin</p>
                <p className="text-2xl font-bold text-white">
                  {stats.totalSuperAdmins}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className=" rounded-lg shadow-md p-6 mb-6 border border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search users..."
                className="pl-10 pr-4 h-[42px] w-full bg-gray-800 border border-gray-600 text-white placeholder-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>

            {/* Role Filter */}
            <div className="relative">
              <FaFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
              <select
                className="appearance-none pl-10 pr-10 h-[42px] w-full bg-gray-800 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer relative z-0"
                value={filterRole}
                onChange={(e) => {
                  setFilterRole(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">All Roles</option>
                <option value={ROLES.EMPLOYEE}>Employee</option>
                <option value={ROLES.ADMIN}>Admin</option>
                <option value={ROLES.SUPER_ADMIN}>Super Admin</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 z-10">
                <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
            </div>

            {/* Status Filter */}
            <div className="relative">
              <FaFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
              <select
                className="appearance-none pl-10 pr-10 h-[42px] w-full bg-gray-800 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer relative z-0"
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">All Status</option>
                <option value={STATUS.ACTIVE}>Active</option>
                <option value={STATUS.INACTIVE}>Inactive</option>
                <option value={STATUS.FORMER}>Former</option>
                <option value={STATUS.SUSPENDED}>Suspended</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 z-10">
                <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
            </div>

            {/* Clear Filters */}
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterRole('');
                setFilterStatus('');
                setCurrentPage(1);
              }}
              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-gray-900 rounded-lg shadow-md overflow-hidden border border-gray-700">
          <div className="bg-gray-800 px-6 py-4 border-b border-gray-700">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-white flex items-center">
                <FaUsers className="mr-2 text-blue-500" />
                Employee Directory
              </h2>
              <div className="text-sm text-gray-400">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex flex-wrap gap-2">
                {isSuperAdmin && (
                  <button
                    onClick={() => setShowAddEmployeeModal(true)}
                    className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors text-sm font-medium shadow-sm cursor-pointer"
                  >
                    <FaUserPlus className="mr-2" />
                    Add Employee
                  </button>
                )}
                <button
                  onClick={() => setShowBulkModal(true)}
                  className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors text-sm font-medium"
                >
                  <FaDownload className="mr-2 transform rotate-180" />
                  Bulk Upload
                </button>
                <button
                  onClick={() => setShowCSVModal(true)}
                  className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium"
                >
                  <FaDownload className="mr-2" />
                  Export CSV
                </button>
              </div>
            </div>
          </div>
          {loading ? (
            <Loader text="Fetching employee records..." />
          ) : users.length === 0 ? (
            <div className="p-8 text-center">
              <FaUser className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-white">No users found</h3>
              <p className="mt-1 text-sm text-gray-400">Try adjusting your search criteria.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700">
                  <thead className="bg-gray-800">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Employee
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Role & Position
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Department
                      </th>
                      {/* <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Joined
                      </th> */}
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-gray-900 divide-y divide-gray-700">
                    {users.map((user) => (
                      <motion.tr
                        key={user._id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="hover:bg-gray-800"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                                <span className="text-white font-bold text-sm">
                                  {user.name?.charAt(0)?.toUpperCase() || 'U'}
                                </span>
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-white">
                                {user.name}
                                {user.hasExpiredOffer && (
                                  <span
                                    className="ml-2 text-yellow-400"
                                    title="Offer validity date has expired"
                                  >
                                    ⚠
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-400">{user.email}</div>
                              {user.phoneNumber && (
                                <div className="text-xs text-gray-500">{user.phoneNumber}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                {getRoleIcon(user.role)}
                                <span className="ml-2 text-sm text-white capitalize">
                                  {user.role}
                                </span>
                              </div>
                            </div>
                            {user.position && (
                              <div className="text-xs text-gray-400">
                                {user.position}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {user.role === ROLES.EMPLOYEE ? getStatusBadge(user.status) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                          {user.department || '-'}
                        </td>
                        {/* <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                          {formatDate(user.createdAt)}
                        </td> */}
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleManageOfferLetter(user)}
                            className="text-purple-500 hover:text-purple-400 mr-4"
                            title="Manage or Extend Offer Letter"
                          >
                            <FaClock />
                          </button>
                          <button
                            onClick={() => handleIssueCertificateForUser(user)}
                            className="text-green-500 hover:text-green-400 mr-4"
                            title="Issue Certificate"
                          >
                            <FaCheck />
                          </button>
                          <button
                            onClick={() => handleTerminateEmployee(user)}
                            className="text-orange-500 hover:text-orange-400 mr-4"
                            title="Terminate Employee"
                          >
                            <FaBan />
                          </button>
                          <button
                            onClick={() => handleViewUser(user)}
                            className="text-blue-600 hover:text-blue-900 mr-4"
                            title="View/Edit User"
                          >
                            <FaEye />
                          </button>
                          {currentUser?.role === ROLES.SUPER_ADMIN && (
                            <button
                              onClick={() => handleDeleteUser(user._id)}
                              className="text-red-600 hover:text-red-900"
                              title="Delete User (Super Admin Required)"
                            >
                              <FaTrash />
                            </button>
                          )}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>

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
            </>
          )}
        </div>

        {/* User Details Modal */}
        {showUserModal && selectedUser && (
          <div className="fixed inset-0 bg-gray-900 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border border-gray-600 w-full max-w-3xl shadow-lg rounded-md bg-gray-800">
              <div className="mt-3 text-center">
                <h3 className="text-lg font-medium text-white mb-4">
                  Edit User: {selectedUser.name}
                </h3>

                <div className="flex flex-wrap gap-2 justify-center mb-4">
                  <button
                    onClick={() => handleViewOfferHistory(selectedUser)}
                    className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded"
                  >
                    Open Offer Letter
                  </button>
                  <button
                    onClick={() => handleManageOfferLetter(selectedUser)}
                    className="px-3 py-1 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded"
                  >
                    Extend Offer
                  </button>
                   <button
                    onClick={() => handleIssueCertificateForUser(selectedUser)}
                    className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded"
                  >
                    Issue Certificate
                  </button>
                  {selectedUser.offerLetter && (
                    <>
                      <button
                        onClick={() => handleViewOfferContract(selectedUser, 'offer')}
                        className="px-3 py-1 text-xs bg-teal-600 hover:bg-teal-700 text-white rounded flex items-center"
                      >
                        <FaFileAlt className="mr-1" /> View Offer Details
                      </button>
                      <button
                        onClick={() => handleViewOfferContract(selectedUser, 'contract')}
                        className="px-3 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded flex items-center"
                      >
                        <FaFileContract className="mr-1" /> View Contract Details
                      </button>
                    </>
                  )}
                </div>

                {userDetailLoading && (
                  <div className="text-sm text-blue-300 mb-4">Loading user details...</div>
                )}
                
                <div className="space-y-4">
                  {/* User Info */}
                  <div className="text-left">
                    <p className="text-sm text-gray-300">Email: {selectedUser.email}</p>
                    <p className="text-sm text-gray-300">Phone: {selectedUser.phone || 'N/A'}</p>
                    <p className="text-sm text-gray-300">
                      Joined: {formatDate(selectedUser.createdAt)}
                    </p>
                    {selectedUser.terminatedAt && (
                      <p className="text-sm text-orange-300">
                        Terminated: {formatDate(selectedUser.terminatedAt)}
                        {selectedUser.terminationReason ? ` (${selectedUser.terminationReason})` : ''}
                      </p>
                    )}
                  </div>

                  <div className="text-left border border-gray-700 rounded-md p-3 bg-gray-900">
                    <p className="text-sm font-semibold text-white mb-2">Offer Letters</p>
                    {(selectedUser.offerLetters || []).length === 0 ? (
                      <p className="text-xs text-gray-400">No offer letters found for this user.</p>
                    ) : (
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {selectedUser.offerLetters.map((offer) => (
                          <div key={offer._id} className="text-xs text-gray-300 bg-gray-800 rounded p-2">
                            <div>Status: {offer.status} | Valid Until: {formatDate(offer.validUntil)}</div>
                            <div>Position: {offer.position} | Dept: {offer.department}</div>
                            <div>Extensions: {offer.extensionHistory?.length || 0}</div>
                            {offer.extensionHistory?.length > 0 && (
                              <div className="mt-1 space-y-1 border-t border-gray-700 pt-1">
                                {offer.extensionHistory.slice().reverse().map((entry, index) => (
                                  <div key={`${offer._id}-modal-ext-${index}`} className="text-[11px] text-gray-400">
                                    <div>
                                      {formatDate(entry.oldValidUntil)} → {formatDate(entry.newValidUntil)}
                                    </div>
                                    {entry.notes && <div>Notes: {entry.notes}</div>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="text-left border border-gray-700 rounded-md p-3 bg-gray-900">
                    <p className="text-sm font-semibold text-white mb-2">Certificates</p>
                    {(selectedUser.certificates || []).length === 0 ? (
                      <p className="text-xs text-gray-400">No certificates found for this user.</p>
                    ) : (
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {selectedUser.certificates.map((certificate) => (
                          <div key={certificate._id} className="text-xs text-gray-300 bg-gray-800 rounded p-2">
                            <div>Role: {certificate.jobrole}</div>
                            <div>Domain: {certificate.domain}</div>
                            <div>Duration: {formatDate(certificate.fromDate)} - {formatDate(certificate.toDate)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Edit Form */}
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Role
                      </label>
                      <select
                        value={editForm.role}
                        onChange={(e) => setEditForm({...editForm, role: e.target.value})}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:ring-2 focus:ring-blue-500"
                        disabled={!isSuperAdmin && editForm.role === ROLES.SUPER_ADMIN}
                      >
                        <option value={ROLES.USER}>User (Applicant)</option>
                        <option value={ROLES.EMPLOYEE}>Employee</option>
                        <option value={ROLES.ADMIN}>Admin</option>
                        {isSuperAdmin && <option value={ROLES.SUPER_ADMIN}>Super Admin</option>}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Status
                      </label>
                      <select
                        value={editForm.status}
                        onChange={(e) => setEditForm({...editForm, status: e.target.value})}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:ring-2 focus:ring-blue-500"
                      >
                        <option value={STATUS.ACTIVE}>Active</option>
                        <option value={STATUS.INACTIVE}>Inactive</option>
                        <option value={STATUS.FORMER}>Former</option>
                        <option value={STATUS.SUSPENDED}>Suspended</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                          Department
                        </label>
                        <select
                          value={editForm.department}
                          onChange={(e) => setEditForm({...editForm, department: e.target.value, position: ''})}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">None</option>
                          {Object.values(DEPARTMENTS).map(dept => (
                            <option key={dept} value={dept}>{dept}</option>
                          ))}
                          {editForm.department && !Object.values(DEPARTMENTS).includes(editForm.department) && (
                            <option value={editForm.department}>{editForm.department}</option>
                          )}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                          Position Level
                        </label>
                        <select
                          value={editForm.positionLevel || 'Junior'}
                          onChange={(e) => setEditForm({...editForm, positionLevel: e.target.value})}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:ring-2 focus:ring-blue-500"
                        >
                          {Object.values(POSITION_LEVELS).map(level => (
                            <option key={level} value={level}>{level}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Position
                      </label>
                      {editForm.department && DEPARTMENT_POSITIONS[editForm.department] ? (
                        <select
                          value={editForm.position}
                          onChange={(e) => setEditForm({...editForm, position: e.target.value})}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select Position</option>
                          {DEPARTMENT_POSITIONS[editForm.department].map(pos => (
                            <option key={pos} value={pos}>{pos}</option>
                          ))}
                          {editForm.position && !DEPARTMENT_POSITIONS[editForm.department].includes(editForm.position) && (
                            <option value={editForm.position}>{editForm.position}</option>
                          )}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={editForm.position}
                          onChange={(e) => setEditForm({...editForm, position: e.target.value})}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white placeholder-gray-400 rounded-md focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., Software Engineer, Manager"
                        />
                      )}
                    </div>

                    {/* End of selects */}
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setShowUserModal(false)}
                    className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdateUser}
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                  >
                    Update User
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CSV Export Modal */}
        {showCSVModal && (
          <div className="fixed inset-0 bg-gray-900 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border border-gray-600 w-[600px] shadow-lg rounded-md bg-gray-800">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-white mb-4 flex items-center">
                  <FaCog className="mr-2" />
                  Configure CSV Export
                </h3>
                
                <div className="space-y-4">
                  {/* Export Type Selection */}
                  <div className="border border-gray-600 p-4 rounded">
                    <h4 className="text-sm font-medium text-gray-300 mb-3">Choose Export Type:</h4>
                    
                    {/* Export All */}
                    <div className="space-y-3">
                      <button
                        onClick={handleExportAll}
                        className="w-full text-left px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded border-2 border-transparent hover:border-gray-500 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">Export All Employees</div>
                            <div className="text-xs text-gray-400 mt-1">
                              Download complete employee database
                            </div>
                          </div>
                          <FaUsers className="text-gray-400" />
                        </div>
                      </button>

                      {/* Multi-Filter Selection */}
                      <div className="bg-gray-800 p-4 rounded border border-gray-600">
                        <div className="font-medium text-gray-300 mb-3">Custom Filter Export:</div>
                        <div className="text-xs text-gray-400 mb-3">Combine multiple filters to create custom exports</div>
                        
                        {/* Role Selection */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-300 mb-2">Filter by Role (Optional):</label>
                          <div className="grid grid-cols-3 gap-2">
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="radio"
                                name="csvRole"
                                value=""
                                checked={csvFilterOptions.selectedRole === ''}
                                onChange={(e) => setCsvFilterOptions({...csvFilterOptions, selectedRole: e.target.value})}
                                className="text-blue-600"
                              />
                              <span className="text-sm text-gray-300">All Roles</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="radio"
                                name="csvRole"
                                value="admin"
                                checked={csvFilterOptions.selectedRole === 'admin'}
                                onChange={(e) => setCsvFilterOptions({...csvFilterOptions, selectedRole: e.target.value})}
                                className="text-blue-600"
                              />
                              <span className="text-sm text-gray-300">Admin</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="radio"
                                name="csvRole"
                                value="user"
                                checked={csvFilterOptions.selectedRole === 'user'}
                                onChange={(e) => setCsvFilterOptions({...csvFilterOptions, selectedRole: e.target.value})}
                                className="text-blue-600"
                              />
                              <span className="text-sm text-gray-300">User</span>
                            </label>
                          </div>
                        </div>

                        {/* Account Status Selection */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-300 mb-2">Filter by Account Status (Optional):</label>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="radio"
                                name="csvAccountStatus"
                                value=""
                                checked={csvFilterOptions.selectedAccountStatus === ''}
                                onChange={(e) => setCsvFilterOptions({...csvFilterOptions, selectedAccountStatus: e.target.value})}
                                className="text-blue-600"
                              />
                              <span className="text-sm text-gray-300">All Account Status</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="radio"
                                name="csvAccountStatus"
                                value="active"
                                checked={csvFilterOptions.selectedAccountStatus === 'active'}
                                onChange={(e) => setCsvFilterOptions({...csvFilterOptions, selectedAccountStatus: e.target.value})}
                                className="text-blue-600"
                              />
                              <span className="text-sm text-gray-300">Active</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="radio"
                                name="csvAccountStatus"
                                value="inactive"
                                checked={csvFilterOptions.selectedAccountStatus === 'inactive'}
                                onChange={(e) => setCsvFilterOptions({...csvFilterOptions, selectedAccountStatus: e.target.value})}
                                className="text-blue-600"
                              />
                              <span className="text-sm text-gray-300">Inactive</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="radio"
                                name="csvAccountStatus"
                                value="pending"
                                checked={csvFilterOptions.selectedAccountStatus === 'pending'}
                                onChange={(e) => setCsvFilterOptions({...csvFilterOptions, selectedAccountStatus: e.target.value})}
                                className="text-blue-600"
                              />
                              <span className="text-sm text-gray-300">Pending</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="radio"
                                name="csvAccountStatus"
                                value="suspended"
                                checked={csvFilterOptions.selectedAccountStatus === 'suspended'}
                                onChange={(e) => setCsvFilterOptions({...csvFilterOptions, selectedAccountStatus: e.target.value})}
                                className="text-blue-600"
                              />
                              <span className="text-sm text-gray-300">Suspended</span>
                            </label>
                          </div>
                        </div>

                        {/* Apply Filters and Clear Buttons */}
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => {
                              const filters = {};
                              if (csvFilterOptions.selectedRole) filters.role = csvFilterOptions.selectedRole;
                              if (csvFilterOptions.selectedEmploymentStatus) filters.employmentStatus = csvFilterOptions.selectedEmploymentStatus;
                              if (csvFilterOptions.selectedStatus) filters.status = csvFilterOptions.selectedStatus;
                              fetchAllUsers(filters);
                            }}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm flex items-center justify-center space-x-2"
                          >
                            <FaFilter />
                            <span>Apply Filters & Preview</span>
                          </button>
                          <button
                            onClick={() => {
                              setCsvFilterOptions({
                                selectedRole: '',
                                selectedEmploymentStatus: '',
                                selectedAccountStatus: '',
                                useCurrentFilters: false
                              });
                            }}
                            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm flex items-center justify-center space-x-2"
                          >
                            <FaTimes />
                            <span>Clear All</span>
                          </button>
                        </div>
                      </div>

                      {/* Export Current View */}
                      {(searchTerm || filterRole || filterStatus) && (
                        <button
                          onClick={handleExportCurrentView}
                          className="w-full text-left px-4 py-3 bg-blue-700 hover:bg-blue-600 text-white rounded border-2 border-transparent hover:border-blue-500 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">Export Current View</div>
                              <div className="text-xs text-blue-200 mt-1">
                                Export with current search/filter criteria
                              </div>
                            </div>
                            <FaFilter className="text-blue-300" />
                          </div>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Current Selection Display */}
                  {(csvExportFilters.role || csvExportFilters.status || csvExportFilters.search || csvFilterOptions.selectedRole || csvFilterOptions.selectedEmploymentStatus || csvFilterOptions.selectedAccountStatus) && (
                    <div className="bg-blue-900 bg-opacity-30 border border-blue-700 p-3 rounded">
                      <h4 className="text-sm font-medium text-blue-300 mb-2">Selected Export Filters:</h4>
                      <div className="space-y-1 text-xs text-blue-200">
                        {csvExportFilters.search && (
                          <div>• Search: "{csvExportFilters.search}"</div>
                        )}
                        {csvFilterOptions.selectedRole && (
                          <div>• Role: {csvFilterOptions.selectedRole}</div>
                        )}
                        {csvFilterOptions.selectedEmploymentStatus && (
                          <div>• Employment Status: {csvFilterOptions.selectedEmploymentStatus}</div>
                        )}
                        {csvFilterOptions.selectedAccountStatus && (
                          <div>• Account Status: {csvFilterOptions.selectedAccountStatus}</div>
                        )}
                        {csvExportFilters.role && (
                          <div>• Legacy Role Filter: {csvExportFilters.role}</div>
                        )}
                        {csvExportFilters.status && (
                          <div>• Legacy Status Filter: {csvExportFilters.status}</div>
                        )}
                        <div className="text-blue-300 font-medium">
                          • Total Matching: {allUsers.length} employees
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-300">Select columns to export:</span>
                    <div className="space-x-2">
                      <button
                        onClick={selectAllColumns}
                        className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      >
                        Select All
                      </button>
                      <button
                        onClick={deselectAllColumns}
                        className="text-xs px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                    {Object.entries(selectedColumns).map(([key, value]) => {
                      const labelMap = {
                        name: 'Full Name',
                        email: 'Email',
                        phone: 'Phone',
                        role: 'Role',
                        status: 'Status',
                        department: 'Department',
                        position: 'Position',
                        createdAt: 'Joined Date'
                      };

                      return (
                        <label key={key} className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={value}
                            onChange={() => handleColumnToggle(key)}
                            className="rounded border-gray-600 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                          />
                          <span className="text-sm text-gray-300">{labelMap[key]}</span>
                        </label>
                      );
                    })}
                  </div>

                  <div className="bg-gray-700 p-3 rounded">
                    <p className="text-xs text-gray-300">
                      <strong>Ready to Export:</strong> {allUsers.length} employees with {Object.values(selectedColumns).filter(Boolean).length} columns
                    </p>
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setShowCSVModal(false)}
                    className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  {allUsers.length > 0 && Object.values(selectedColumns).some(Boolean) && (
                    <CSVLink
                      data={generateCSVData()}
                      filename={generateCSVFilename()}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors inline-flex items-center space-x-2"
                      onClick={() => {
                        setShowCSVModal(false);
                        toast.success(`CSV export started! (${allUsers.length} employees)`);
                      }}
                    >
                      <FaDownload />
                      <span>Download CSV</span>
                    </CSVLink>
                  )}
                  {allUsers.length === 0 && (
                    <div className="px-4 py-2 bg-gray-600 text-gray-300 rounded-md">
                      No data to export
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {showBulkModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-75 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-gray-800 rounded-2xl max-w-2xl w-full border border-gray-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-gray-700 flex justify-between items-center bg-gradient-to-r from-gray-850 to-gray-800">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-500 bg-opacity-10 rounded-lg mr-3">
                    <FaDownload className="text-blue-500 transform rotate-180" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Bulk Employee Upload</h3>
                    <p className="text-xs text-gray-400">Import staff and onboarding data via CSV</p>
                  </div>
                </div>
                <button onClick={() => { setShowBulkModal(false); setSelectedFile(null); }} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-all">
                  <FaTimes className="h-5 w-5" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* 1. Download Sample Section */}
                <div className="bg-gray-750 border border-gray-700 rounded-xl p-4 flex items-center justify-between group hover:border-blue-500 transition-colors">
                  <div className="flex items-center">
                    <div className="p-3 bg-blue-600 bg-opacity-20 rounded-full mr-4 group-hover:scale-110 transition-transform">
                      <FaFileAlt className="text-blue-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white">New to bulk upload?</h4>
                      <p className="text-[11px] text-gray-400">Download our sample template with all 30+ supported headers.</p>
                    </div>
                  </div>
                  <button 
                    onClick={handleDownloadSample}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-lg shadow-blue-900/20 transition-all flex items-center"
                  >
                    <FaDownload className="mr-2 h-3 w-3" />
                    Download Sample
                  </button>
                </div>

                {/* 2. Upload Area */}
                <div className="space-y-3">
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest ml-1">Upload CSV File</label>
                  <div 
                    className={`relative border-2 border-dashed rounded-2xl p-8 transition-all flex flex-col items-center justify-center text-center cursor-pointer group bg-gray-850/50 ${
                      selectedFile ? 'border-blue-500 bg-blue-500/5' : 'border-gray-600 hover:border-blue-500 hover:bg-gray-800'
                    }`}
                  >
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          setSelectedFile(file);
                        }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      id="premium-csv-input"
                    />
                    
                    {!selectedFile ? (
                      <>
                        <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4 border border-gray-700 group-hover:scale-110 transition-transform shadow-lg">
                          <FaDownload className="h-6 w-6 text-gray-400 group-hover:text-blue-400 transform rotate-180" />
                        </div>
                        <p className="text-white font-semibold mb-1">Select your CSV file</p>
                        <p className="text-xs text-gray-500">Drag and drop or click to browse (Max 10MB)</p>
                      </>
                    ) : (
                      <div className="animate-in fade-in zoom-in duration-300 w-full">
                        <div className="w-16 h-16 bg-blue-500 bg-opacity-10 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/30 shadow-inner">
                          <FaCheck className="h-6 w-6 text-blue-500" />
                        </div>
                        <p className="text-blue-400 font-bold mb-1 truncate max-w-xs mx-auto">{selectedFile.name}</p>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest">
                          {Math.round(selectedFile.size / 1024)} KB • Ready to sync
                        </p>
                        <button 
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedFile(null); }}
                          className="mt-3 text-[10px] text-red-400 hover:text-red-300 font-bold p-1 underline underline-offset-4"
                        >
                          Change File
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Documentation (Accordion) */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Header Documentation</label>
                    <p className="text-[10px] text-gray-400 italic">Total 32 headers supported</p>
                  </div>
                  
                  <div className="border border-gray-700 rounded-xl overflow-hidden bg-gray-850/30">
                    {/* Required Section */}
                    <div className="border-b border-gray-700">
                      <button 
                        onClick={() => setExpandedSection(expandedSection === 'required' ? '' : 'required')}
                        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-800 transition-colors"
                      >
                        <span className="text-xs font-bold text-white flex items-center">
                          <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                          Required Basics
                        </span>
                        <FaChevronRight className={`text-gray-500 text-xs transition-transform ${expandedSection === 'required' ? 'rotate-90' : ''}`} />
                      </button>
                      {expandedSection === 'required' && (
                        <div className="px-5 pb-4 text-[11px] text-gray-400 bg-gray-800/50 pt-1">
                          <p className="mb-2">These headers must exist for a successful record creation:</p>
                          <div className="flex flex-wrap gap-2">
                            {['name', 'email'].map(h => <code key={h} className="bg-gray-900 border border-gray-700 px-2 py-0.5 rounded text-blue-300">{h}</code>)}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Staff Section */}
                    <div className="border-b border-gray-700">
                      <button 
                        onClick={() => setExpandedSection(expandedSection === 'staff' ? '' : 'staff')}
                        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-800 transition-colors"
                      >
                        <span className="text-xs font-bold text-white flex items-center">
                          <span className="w-2 h-2 bg-emerald-500 rounded-full mr-3"></span>
                          Staff Profile Details
                        </span>
                        <FaChevronRight className={`text-gray-500 text-xs transition-transform ${expandedSection === 'staff' ? 'rotate-90' : ''}`} />
                      </button>
                      {expandedSection === 'staff' && (
                        <div className="px-5 pb-4 text-[11px] text-gray-400 bg-gray-800/50 pt-1 animate-in slide-in-from-top-2 duration-200">
                          <div className="grid grid-cols-2 gap-y-2">
                            {['role', 'phoneNumber', 'department', 'position', 'reportingManager'].map(h => (
                               <div key={h} className="flex items-center">
                                 <code className="bg-gray-900 border border-gray-700 px-2 py-0.5 rounded text-emerald-400 mr-2">{h}</code>
                               </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Onboarding Section */}
                    <div className="">
                      <button 
                        onClick={() => setExpandedSection(expandedSection === 'onboarding' ? '' : 'onboarding')}
                        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-800 transition-colors"
                      >
                        <span className="text-xs font-bold text-white flex items-center">
                          <span className="w-2 h-2 bg-amber-500 rounded-full mr-3"></span>
                          Onboarding: Offer & Contract
                        </span>
                        <FaChevronRight className={`text-gray-500 text-xs transition-transform ${expandedSection === 'onboarding' ? 'rotate-90' : ''}`} />
                      </button>
                      {expandedSection === 'onboarding' && (
                        <div className="px-5 pb-4 text-[11px] text-gray-400 bg-gray-800/50 pt-1 animate-in slide-in-from-top-2 duration-200">
                          <p className="mb-3 text-[10px] text-amber-500/80 italic font-medium uppercase tracking-tight">Warning: Partial data will result in placeholder values.</p>
                          <div className="space-y-4">
                            <div>
                              <p className="text-[10px] text-gray-500 font-bold mb-1 uppercase tracking-tighter">Offer Data</p>
                              <div className="flex flex-wrap gap-2">
                                {['offerSalary', 'offerStartDate', 'offerWorkType', 'offerBenefits', 'offerComments'].map(h => <code key={h} className="bg-gray-900 border border-gray-700 px-2 py-0.5 rounded text-amber-400">{h}</code>)}
                              </div>
                            </div>
                            <div>
                              <p className="text-[10px] text-gray-500 font-bold mb-1 uppercase tracking-tighter">Contract, Banking & Emergency</p>
                              <div className="flex flex-wrap gap-2">
                                {['dob', 'nationality', 'bankAccountNumber', 'bankIfsc', 'idNumber', 'emergencyPhone'].map(h => <code key={h} className="bg-gray-900 border border-gray-700 px-2 py-0.5 rounded text-amber-400">{h}</code>)}
                                <span className="text-[9px] text-gray-500 self-center">+ 19 more</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Footer */}
              <div className="px-6 py-4 bg-gray-850 border-t border-gray-700 flex justify-end space-x-3">
                <button
                  onClick={() => { setShowBulkModal(false); setSelectedFile(null); }}
                  className="px-6 py-2.5 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-all font-semibold"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    if (selectedFile) handleUploadCSV(selectedFile);
                    else toast.warning('Please select a CSV file first');
                  }}
                  disabled={!selectedFile}
                  className={`px-8 py-2.5 text-sm rounded-xl font-bold transition-all shadow-xl ${
                    selectedFile 
                      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:shadow-blue-900/40 hover:-translate-y-0.5' 
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Start Import Sync
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Offer & Contract Modal */}
        {showOfferContractModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-75 flex items-center justify-center p-4">
            <div className="bg-gray-800 rounded-xl max-w-4xl w-full border border-gray-700 shadow-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-700 flex justify-between items-center bg-gray-850">
                <h3 className="text-xl font-bold text-white flex items-center">
                  <FaEye className="mr-2 text-blue-500" />
                  Onboarding Details: {selectedUser?.name}
                </h3>
                <button onClick={() => setShowOfferContractModal(false)} className="text-gray-400 hover:text-white transition-colors">
                  <FaTimes className="h-6 w-6" />
                </button>
              </div>

              <div className="p-6">
                {offerContractLoading ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader text="Loading details..." />
                  </div>
                ) : !offerContractData ? (
                  <div className="text-center py-12 text-gray-400">
                    <p>No offer or contract data found for this employee.</p>
                  </div>
                ) : (
                  <>
                    {/* Tabs */}
                    <div className="flex border-b border-gray-700 mb-6">
                      <button
                        className={`px-6 py-2 font-medium text-sm transition-colors relative ${
                          activeTab === 'offer' ? 'text-blue-400' : 'text-gray-400 hover:text-white'
                        }`}
                        onClick={() => setActiveTab('offer')}
                      >
                        Offer Acceptance
                        {activeTab === 'offer' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400"></div>}
                      </button>
                      <button
                        className={`px-6 py-2 font-medium text-sm transition-colors relative ${
                          activeTab === 'contract' ? 'text-blue-400' : 'text-gray-400 hover:text-white'
                        }`}
                        onClick={() => setActiveTab('contract')}
                      >
                        Contract Details
                        {activeTab === 'contract' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400"></div>}
                      </button>
                    </div>

                    <div className="max-h-[60vh] overflow-y-auto pr-2">
                      {activeTab === 'offer' ? (
                        <div className="space-y-6">
                          {/* Offer Letter Details */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-gray-750 p-4 rounded-lg border border-gray-700">
                              <h4 className="text-sm font-semibold text-blue-400 uppercase tracking-wider mb-4">Position Info</h4>
                              <div className="space-y-3">
                                <DetailItem label="Position" value={offerContractData.offer?.position} />
                                <DetailItem label="Department" value={offerContractData.offer?.department} />
                                <DetailItem label="Work Type" value={offerContractData.offer?.workType} />
                                <DetailItem label="Start Date" value={offerContractData.offer?.startDate && new Date(offerContractData.offer.startDate).toLocaleDateString()} />
                              </div>
                            </div>
                            <div className="bg-gray-750 p-4 rounded-lg border border-gray-700">
                              <h4 className="text-sm font-semibold text-blue-400 uppercase tracking-wider mb-4">Compensation & Terms</h4>
                              <div className="space-y-3">
                                <DetailItem label="Salary/Stipend" value={offerContractData.offer?.salary} />
                                <DetailItem label="Valid Until" value={offerContractData.offer?.validUntil && new Date(offerContractData.offer.validUntil).toLocaleDateString()} />
                                <DetailItem label="Status" value={offerContractData.offer?.status} badge />
                                <DetailItem label="Accepted At" value={offerContractData.offer?.acceptedAt && new Date(offerContractData.offer.acceptedAt).toLocaleString()} />
                              </div>
                            </div>
                          </div>

                          {offerContractData.offer?.benefits && offerContractData.offer.benefits.length > 0 && (
                            <div className="bg-gray-750 p-4 rounded-lg border border-gray-700">
                              <h4 className="text-sm font-semibold text-blue-400 uppercase tracking-wider mb-3">Benefits</h4>
                              <div className="flex flex-wrap gap-2">
                                {offerContractData.offer.benefits.map((benefit, i) => (
                                  <span key={i} className="px-3 py-1 bg-blue-900 bg-opacity-30 text-blue-300 border border-blue-800 rounded-full text-xs">
                                    {benefit}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {offerContractData.offer?.acceptanceComments && (
                            <div className="bg-gray-750 p-4 rounded-lg border border-gray-700">
                              <h4 className="text-sm font-semibold text-blue-400 uppercase tracking-wider mb-2">Acceptance Comments</h4>
                              <p className="text-gray-300 text-sm whitespace-pre-wrap italic">"{offerContractData.offer.acceptanceComments}"</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {!offerContractData.contract ? (
                            <div className="text-center py-12 text-gray-400 bg-gray-750 rounded-lg border border-gray-700">
                              <FaBan className="mx-auto h-12 w-12 mb-4 opacity-20" />
                              <p>No signed contract record found yet.</p>
                              <p className="text-xs mt-2">The candidate may have accepted the offer but not completed the contract workflow.</p>
                            </div>
                          ) : (
                            <>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-gray-750 p-4 rounded-lg border border-gray-700">
                                  <h4 className="text-sm font-semibold text-teal-400 uppercase tracking-wider mb-4">Personal Info</h4>
                                  <div className="space-y-3">
                                    <DetailItem label="Date of Birth" value={offerContractData.contract.personalInfo?.dateOfBirth && new Date(offerContractData.contract.personalInfo.dateOfBirth).toLocaleDateString()} />
                                    <DetailItem label="Nationality" value={offerContractData.contract.personalInfo?.nationality} />
                                    <DetailItem label="Permanent Address" value={formatAddress(offerContractData.contract.personalInfo?.address)} />
                                    <DetailItem label="ID Type" value={offerContractData.contract.personalInfo?.identificationDocuments?.idType} />
                                    <DetailItem label="ID Number" value={offerContractData.contract.personalInfo?.identificationDocuments?.idNumber} />
                                  </div>
                                </div>
                                <div className="bg-gray-750 p-4 rounded-lg border border-gray-700">
                                  <h4 className="text-sm font-semibold text-teal-400 uppercase tracking-wider mb-4">Banking Info</h4>
                                  <div className="space-y-3">
                                    <DetailItem label="Bank Name" value={offerContractData.contract.bankingInfo?.bankName} />
                                    <DetailItem label="Account Holder" value={offerContractData.contract.bankingInfo?.accountHolderName} />
                                    <DetailItem label="Account Number" value={offerContractData.contract.bankingInfo?.accountNumber} />
                                    <DetailItem label="IFSC Code" value={offerContractData.contract.bankingInfo?.ifscCode} />
                                    <DetailItem label="Branch" value={offerContractData.contract.bankingInfo?.branch} />
                                  </div>
                                </div>
                              </div>

                              <div className="bg-gray-750 p-4 rounded-lg border border-gray-700">
                                <h4 className="text-sm font-semibold text-teal-400 uppercase tracking-wider mb-4">Emergency Contact</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <DetailItem label="Name" value={offerContractData.contract.personalInfo?.emergencyContact?.name} />
                                  <DetailItem label="Relationship" value={offerContractData.contract.personalInfo?.emergencyContact?.relationship} />
                                  <DetailItem label="Phone" value={offerContractData.contract.personalInfo?.emergencyContact?.phone} />
                                  <DetailItem label="Email" value={offerContractData.contract.personalInfo?.emergencyContact?.email} />
                                </div>
                              </div>

                              {offerContractData.contract.documents && offerContractData.contract.documents.length > 0 && (
                                <div className="bg-gray-750 p-4 rounded-lg border border-gray-700">
                                  <h4 className="text-sm font-semibold text-teal-400 uppercase tracking-wider mb-4">Onboarding Documents</h4>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {offerContractData.contract.documents.map((doc, i) => (
                                      <a
                                        key={i}
                                        href={doc.fileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center p-3 bg-gray-800 rounded-md border border-gray-650 hover:border-teal-500 hover:bg-gray-700 transition-all group"
                                      >
                                        <FaEye className="mr-3 text-teal-500 group-hover:scale-110 transition-transform" />
                                        <div className="overflow-hidden">
                                          <div className="text-xs font-medium text-white truncate">{doc.documentType.replace('_', ' ')}</div>
                                          <div className="text-[10px] text-gray-500 truncate">{doc.fileName}</div>
                                        </div>
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
              
              <div className="px-6 py-4 bg-gray-850 border-t border-gray-700 flex justify-end">
                <button
                  onClick={() => setShowOfferContractModal(false)}
                  className="px-6 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Employee Modal (Super Admin Only) */}
        {isSuperAdmin && showAddEmployeeModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-850">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <FaUserPlus className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Add New Employee</h3>
                    <p className="text-xs text-gray-400">Onboard employee profile, set staff role, department, and HRMS records.</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddEmployeeModal(false)}
                  className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <FaTimes className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateEmployee}>
                <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                  {/* Employee ID & Name */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
                        Employee ID / Code
                      </label>
                      <input
                        type="text"
                        placeholder="Auto-generated (e.g. EMP001)"
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg py-2.5 px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder-gray-500"
                        value={addEmployeeForm.employeeId}
                        onChange={(e) => setAddEmployeeForm({ ...addEmployeeForm, employeeId: e.target.value })}
                      />
                      <p className="text-[11px] text-gray-500 mt-1">Leave empty to auto-generate next sequential code.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
                        Full Name <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. John Doe"
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg py-2.5 px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder-gray-500"
                        value={addEmployeeForm.name}
                        onChange={(e) => setAddEmployeeForm({ ...addEmployeeForm, name: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Email & Password */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
                        Email Address <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="employee@company.com"
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg py-2.5 px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder-gray-500"
                        value={addEmployeeForm.email}
                        onChange={(e) => setAddEmployeeForm({ ...addEmployeeForm, email: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
                        Initial Password <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="Minimum 6 characters"
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg py-2.5 px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder-gray-500"
                        value={addEmployeeForm.password}
                        onChange={(e) => setAddEmployeeForm({ ...addEmployeeForm, password: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Phone & Role */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        placeholder="+91 98765 43210"
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg py-2.5 px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder-gray-500"
                        value={addEmployeeForm.phoneNumber}
                        onChange={(e) => setAddEmployeeForm({ ...addEmployeeForm, phoneNumber: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
                        System Role
                      </label>
                      <select
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg py-2.5 px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer"
                        value={addEmployeeForm.role}
                        onChange={(e) => setAddEmployeeForm({ ...addEmployeeForm, role: e.target.value })}
                      >
                        <option value="employee">Employee</option>
                        <option value="admin">Admin</option>
                        <option value="hr-admin">HR Admin</option>
                        <option value="manager">Manager</option>
                        <option value="recruiter">Recruiter</option>
                        <option value="finance">Finance</option>
                        <option value="payroll-admin">Payroll Admin</option>
                        <option value="super-admin">Super Admin</option>
                      </select>
                    </div>
                  </div>

                  {/* Department & Position */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
                        Department
                      </label>
                      <select
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg py-2.5 px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer"
                        value={addEmployeeForm.department}
                        onChange={(e) => {
                          const dept = e.target.value;
                          const positions = DEPARTMENT_POSITIONS[dept] || [];
                          setAddEmployeeForm({
                            ...addEmployeeForm,
                            department: dept,
                            position: positions[0] || ''
                          });
                        }}
                      >
                        {Object.values(DEPARTMENTS).map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
                        Designation / Position
                      </label>
                      {DEPARTMENT_POSITIONS[addEmployeeForm.department]?.length > 0 ? (
                        <select
                          className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg py-2.5 px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer"
                          value={addEmployeeForm.position}
                          onChange={(e) => setAddEmployeeForm({ ...addEmployeeForm, position: e.target.value })}
                        >
                          {DEPARTMENT_POSITIONS[addEmployeeForm.department].map((pos) => (
                            <option key={pos} value={pos}>{pos}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          placeholder="e.g. Software Engineer"
                          className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg py-2.5 px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder-gray-500"
                          value={addEmployeeForm.position}
                          onChange={(e) => setAddEmployeeForm({ ...addEmployeeForm, position: e.target.value })}
                        />
                      )}
                    </div>
                  </div>

                  {/* Employment Type & Status */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
                        Employment Type
                      </label>
                      <select
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg py-2.5 px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer"
                        value={addEmployeeForm.employmentType}
                        onChange={(e) => setAddEmployeeForm({ ...addEmployeeForm, employmentType: e.target.value })}
                      >
                        <option value="full_time">Full-time</option>
                        <option value="part_time">Part-time</option>
                        <option value="contract">Contract</option>
                        <option value="intern">Intern</option>
                        <option value="consultant">Consultant</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
                        Employment Status
                      </label>
                      <select
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg py-2.5 px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer"
                        value={addEmployeeForm.status}
                        onChange={(e) => setAddEmployeeForm({ ...addEmployeeForm, status: e.target.value })}
                      >
                        <option value="active">Active</option>
                        <option value="onboarding">Onboarding</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>

                  {/* Joining Date, Reporting Manager & Location */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
                        Joining Date
                      </label>
                      <input
                        type="date"
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg py-2.5 px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        value={addEmployeeForm.joiningDate}
                        onChange={(e) => setAddEmployeeForm({ ...addEmployeeForm, joiningDate: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
                        Reporting Manager
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Jane Smith"
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg py-2.5 px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder-gray-500"
                        value={addEmployeeForm.reportingManager}
                        onChange={(e) => setAddEmployeeForm({ ...addEmployeeForm, reportingManager: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
                        Work Location
                      </label>
                      <select
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg py-2.5 px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer"
                        value={addEmployeeForm.workLocation}
                        onChange={(e) => setAddEmployeeForm({ ...addEmployeeForm, workLocation: e.target.value })}
                      >
                        <option value="Office">Office</option>
                        <option value="Remote">Remote</option>
                        <option value="Hybrid">Hybrid</option>
                      </select>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-xs text-emerald-300">
                    <span className="font-semibold">Super Admin Note:</span> This creates the employee user account with pre-verified status and automatically generates the linked HRMS employee profile record.
                  </div>
                </div>

                <div className="p-5 border-t border-gray-800 bg-gray-850 flex justify-end items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddEmployeeModal(false)}
                    className="px-4 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addEmployeeLoading}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-all shadow-md shadow-emerald-950/30 flex items-center gap-2 cursor-pointer"
                  >
                    {addEmployeeLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Creating Employee...</span>
                      </>
                    ) : (
                      <>
                        <FaUserPlus className="w-4 h-4" />
                        <span>Create Employee</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper Components
const DetailItem = ({ label, value, badge = false }) => (
  <div>
    <p className="text-[11px] text-gray-500 uppercase font-bold tracking-tighter mb-0.5">{label}</p>
    {badge ? (
      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
        value === 'Accepted' || value === 'Approved' ? 'bg-green-900 text-green-300' :
        value === 'Pending' ? 'bg-yellow-900 text-yellow-300' :
        'bg-red-900 text-red-300'
      }`}>
        {value || 'N/A'}
      </span>
    ) : (
      <p className="text-sm text-gray-200 font-medium">{value || 'Not provided'}</p>
    )}
  </div>
);

const formatAddress = (addr) => {
  if (!addr) return 'N/A';
  return `${addr.street}, ${addr.city}, ${addr.state} - ${addr.zipCode}, ${addr.country}`;
};

export default EmployeeManagement;
