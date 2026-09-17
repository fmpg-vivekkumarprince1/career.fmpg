const express = require('express');
const router = express.Router();
const { auth, hasPermission, verifySuperAdmin, isAdmin } = require('../middleware/authMiddleware');
const {
    getAllUsers,
    getUserById,
    updateUserStatus,
    updateAccountStatus,
    terminateEmployee,
    bulkUpdateUserStatusFromApplications,
    deleteUser,
    updateUserRole,
    bulkUploadEmployees,
    createUser,
    createEmployee
} = require('../Controllers/userController');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Admin only routes for user management
router.post('/bulk-upload', auth, hasPermission('canManageEmployees'), upload.single('file'), bulkUploadEmployees);
router.get('/', auth, hasPermission('canManageEmployees'), getAllUsers);
router.get('/:userId', auth, hasPermission('canManageEmployees'), getUserById);
router.put('/:userId/status', auth, hasPermission('canManageEmployees'), updateUserStatus);
router.put('/:userId/account-status', auth, hasPermission('canManageEmployees'), updateAccountStatus);
router.put('/:userId/terminate', auth, hasPermission('canManageEmployees'), terminateEmployee);
router.put('/bulk/update-status', auth, hasPermission('canManageEmployees'), bulkUpdateUserStatusFromApplications);

// Special authority (Super Admin) required routes for critical operations
router.post('/', auth, verifySuperAdmin, createUser);
router.post('/employee', auth, verifySuperAdmin, createEmployee);
router.put('/:userId/role', auth, verifySuperAdmin, updateUserRole);
router.delete('/:userId', verifySuperAdmin, deleteUser);

module.exports = router;
