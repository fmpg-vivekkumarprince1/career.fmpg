const User = require("../models/user");
const Employee = require("../models/Employee");
const Application = require("../models/application");
const OfferLetter = require("../models/offerLetter");
const EmploymentContract = require("../models/offerContract");
const Certificate = require("../models/certificate");
const emailService = require("../services/emailService");
const bcrypt = require("bcryptjs");
const { ROLES, STATUS, DEPARTMENTS, DEPARTMENT_POSITIONS, POSITION_LEVELS } = require("../utils/constants");
const { logAudit } = require("../services/auditService");

// Helper function to determine the best user status based on application statuses
const getBestUserStatus = (applicationStatuses) => {
    // Priority order: hired > offered > shortlisted > reviewing > pending > rejected
    const statusPriority = {
        "hired": 6,
        "offered": 5,
        "shortlisted": 4,
        "reviewing": 3,
        "pending": 2,
        "rejected": 1
    };

    const applicationStatusToUserStatus = {
        "hired": STATUS.ACTIVE,
        "offered": STATUS.ACTIVE, 
        "shortlisted": STATUS.INACTIVE,
        "reviewing": STATUS.INACTIVE,
        "pending": STATUS.INACTIVE,
        "rejected": STATUS.INACTIVE
    };

    // Find the highest priority status
    let bestApplicationStatus = null;
    let highestPriority = 0;

    for (const status of applicationStatuses) {
        const priority = statusPriority[status] || 0;
        if (priority > highestPriority) {
            highestPriority = priority;
            bestApplicationStatus = status;
        }
    }

    return bestApplicationStatus ? applicationStatusToUserStatus[bestApplicationStatus] : STATUS.ACTIVE;
};

// Get all users (admin only)
const getAllUsers = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 10, 
            search, 
            role, 
            status,
            view, // 'staff' or 'users'
            sortBy = 'createdAt', 
            sortOrder = 'desc' 
        } = req.query;

        const filter = {};
        
        // View filter
        if (view === 'staff') {
            filter.role = { $in: ['admin', 'employee', 'super-admin'] };
        } else if (view === 'users') {
            filter.role = 'user';
        }

        // Search filter
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phoneNumber: { $regex: search, $options: 'i' } },
                { department: { $regex: search, $options: 'i' } },
                { position: { $regex: search, $options: 'i' } }
            ];
        }

        // Role filter (can override view filter if provided)
        if (role && role !== 'all') {
            filter.role = role;
        }

        // Status filter
        if (status && status !== 'all') {
            if (view === 'users') {
                // If filtering by application status in users view
                if (status === 'Not Applied') {
                    const usersWithApps = await Application.distinct('userId');
                    filter._id = { $nin: usersWithApps };
                } else {
                    // Find users whose LATEST application matches the status
                    const usersWithMatchingApp = await Application.aggregate([
                        { $sort: { createdAt: -1 } },
                        { $group: { 
                            _id: "$userId", 
                            latestStatus: { $first: "$status" } 
                        } },
                        { $match: { latestStatus: status } }
                    ]);
                    const userIds = usersWithMatchingApp.map(item => item._id);
                    filter._id = { $in: userIds };
                }
            } else {
                // Regular status filter for staff or default
                filter.status = status;
            }
        }

        const sort = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

        const users = await User.find(filter)
            .select('-password') // Exclude password field
            .sort(sort)
            .limit(limit * 1)
            .skip((page - 1) * limit);

        // ... existing offer letter logic ...
        // (I'll keep the offer letter logic as is, but I need to make sure I don't break it)
        // Actually, let's just replace the whole block carefully.

        const userIds = users.map(user => user._id);
        const userEmails = users.map(user => user.email).filter(Boolean);

        // Fetch latest application for each user if view is 'users'
        let latestApplications = [];
        if (view === 'users') {
            latestApplications = await Application.find({ userId: { $in: userIds } })
                .select('userId status createdAt')
                .sort({ createdAt: -1 });
        }

        const latestAppByUserId = new Map();
        latestApplications.forEach(app => {
            if (!latestAppByUserId.has(app.userId.toString())) {
                latestAppByUserId.set(app.userId.toString(), app.status);
            }
        });

        const offerLetters = userEmails.length > 0
            ? await OfferLetter.find({ email: { $in: userEmails } })
                .select('email status validUntil position department startDate updatedAt')
                .sort({ updatedAt: -1, createdAt: -1 })
            : [];

        const latestOfferByEmail = new Map();
        offerLetters.forEach((offerLetter) => {
            const normalizedEmail = offerLetter.email?.toLowerCase();
            if (normalizedEmail && !latestOfferByEmail.has(normalizedEmail)) {
                latestOfferByEmail.set(normalizedEmail, offerLetter);
            }
        });

        const now = new Date();
        const usersWithOfferMeta = users.map((user) => {
            const userObj = user.toObject();
            const latestOffer = latestOfferByEmail.get(userObj.email?.toLowerCase());
            const latestAppStatus = latestAppByUserId.get(userObj._id.toString());
            
            const hasExpiredOffer = Boolean(
                latestOffer &&
                latestOffer.validUntil &&
                new Date(latestOffer.validUntil) < now &&
                latestOffer.status !== 'Rejected'
            );

            return {
                ...userObj,
                applicationStatus: latestAppStatus || 'Not Applied',
                latestOffer: latestOffer
                    ? {
                        _id: latestOffer._id,
                        status: latestOffer.status,
                        validUntil: latestOffer.validUntil,
                        startDate: latestOffer.startDate,
                        position: latestOffer.position,
                        department: latestOffer.department
                    }
                    : null,
                hasExpiredOffer
            };
        });

        const total = await User.countDocuments(filter);

        // Get statistics
        const statsAggregation = await User.aggregate([
            {
                $group: {
                    _id: null,
                    totalUsers: { $sum: { $cond: [{ $eq: ["$role", "user"] }, 1, 0] } },
                    totalAdmins: { $sum: { $cond: [{ $eq: ["$role", "admin"] }, 1, 0] } },
                    totalSuperAdmins: { $sum: { $cond: [{ $eq: ["$role", "super-admin"] }, 1, 0] } },
                    totalEmployees: { $sum: { $cond: [{ $eq: ["$role", "employee"] }, 1, 0] } },
                    activeStaff: { 
                        $sum: { 
                            $cond: [
                                { 
                                    $and: [
                                        { $in: ["$role", ["admin", "employee", "super-admin"]] },
                                        { $eq: [{ $ifNull: ["$status", "active"] }, "active"] }
                                    ] 
                                }, 
                                1, 0
                            ] 
                        } 
                    },
                    activeUsers: { 
                        $sum: { 
                            $cond: [
                                { 
                                    $and: [
                                        { $eq: ["$role", "user"] },
                                        { $eq: [{ $ifNull: ["$status", "active"] }, "active"] }
                                    ] 
                                }, 
                                1, 0
                            ] 
                        } 
                    },
                    totalActiveAccounts: { $sum: { $cond: [{ $eq: [{ $ifNull: ["$status", "active"] }, "active"] }, 1, 0] } },
                    inactiveAccounts: { $sum: { $cond: [{ $eq: ["$status", "inactive"] }, 1, 0] } },
                    formerEmployees: { $sum: { $cond: [{ $eq: ["$status", "former"] }, 1, 0] } },
                    suspendedAccounts: { $sum: { $cond: [{ $eq: ["$status", "suspended"] }, 1, 0] } }
                }
            }
        ]);

        const finalStats = statsAggregation[0] || {
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
        };

        res.status(200).json({
            users: usersWithOfferMeta,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit)
            },
            stats: finalStats
        });

    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ 
            message: "Failed to fetch users", 
            error: error.message 
        });
    }
};

// Get user by ID (admin only)
const getUserById = async (req, res) => {
    try {
        const { userId } = req.params;
        
        const user = await User.findById(userId).select('-password').populate('offerLetter');
        
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const normalizedEmail = user.email?.toLowerCase();
        const now = new Date();

        const [offerLetters, certificates] = await Promise.all([
            OfferLetter.find({ email: user.email })
                .sort({ createdAt: -1 })
                .populate('userId', 'name email'),
            Certificate.find({
                $or: [
                    { recipientEmail: user.email },
                    { name: user.name }
                ]
            }).sort({ createdAt: -1 })
        ]);

        const latestOffer = offerLetters.length > 0 ? offerLetters[0] : null;
        const hasExpiredOffer = Boolean(
            latestOffer &&
            latestOffer.validUntil &&
            new Date(latestOffer.validUntil) < now &&
            latestOffer.status !== 'Rejected'
        );

        const userWithMeta = {
            ...user.toObject(),
            latestOffer: latestOffer
                ? {
                    _id: latestOffer._id,
                    status: latestOffer.status,
                    validUntil: latestOffer.validUntil,
                    startDate: latestOffer.startDate,
                    position: latestOffer.position,
                    department: latestOffer.department
                }
                : null,
            hasExpiredOffer
        };

        res.status(200).json({
            user: userWithMeta,
            offerLetters,
            certificates
        });

    } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ 
            message: "Failed to fetch user", 
            error: error.message 
        });
    }
};

// Update user status (admin only)
const updateUserStatus = async (req, res) => {
    try {
        const { userId } = req.params;
        const { status, department, position, positionLevel, role, autoUpdateStatus = true } = req.body;

        // Validate status
        const validStatuses = [
            STATUS.ACTIVE, STATUS.INACTIVE, 
            STATUS.FORMER, STATUS.SUSPENDED
        ];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ 
                message: "Invalid status" 
            });
        }

        // Validate department and position
        if (department || position) {
            const user = await User.findById(userId);
            const targetDept = department || user.department;
            const targetPos = position || user.position;

            if (targetDept && targetDept !== 'None') {
                const deptKey = Object.keys(DEPARTMENTS).find(key => DEPARTMENTS[key] === targetDept);
                if (!deptKey) {
                    return res.status(400).json({ message: "Invalid department" });
                }

                if (targetPos) {
                    // Check if position exists in the department's allowed list
                    // Note: We might allow custom positions but let's check hierarchy if possible
                    const allowedPositions = DEPARTMENT_POSITIONS[targetDept];
                    // If we want strict validation:
                    /*
                    if (allowedPositions && !allowedPositions.includes(targetPos)) {
                        return res.status(400).json({ 
                            message: `Invalid position for ${targetDept} department. Allowed: ${allowedPositions.join(', ')}` 
                        });
                    }
                    */
                }
            }
        }

        // Validate role
        const validRoles = [ROLES.USER, ROLES.ADMIN, ROLES.EMPLOYEE, ROLES.SUPER_ADMIN];
        if (role && !validRoles.includes(role)) {
            return res.status(400).json({ 
                message: "Invalid role" 
            });
        }


        const updateData = {};
        
        // Auto-update status based on applications if not explicitly provided
        if (autoUpdateStatus && !status) {
            try {
                // Fetch all applications for this user
                const userApplications = await Application.find({ userId }).select('status');
                
                if (userApplications.length > 0) {
                    const applicationStatuses = userApplications.map(app => app.status);
                    const bestEmployeeStatus = getBestEmployeeStatus(applicationStatuses);
                    updateData.status = bestEmployeeStatus;
                }
            } catch (applicationError) {
                console.warn("Error fetching applications for auto-status update:", applicationError);
            }
        } else if (status) {
            updateData.status = status;
        }
        
        if (department) updateData.department = department;
        if (position) updateData.position = position;
        if (positionLevel !== undefined) updateData.positionLevel = positionLevel;
        
        // ONLY Super Admin can change roles
        if (role) {
            console.log(`Role update attempt: by ${req.user.email} (${req.user.role}) for user ${userId} to ${role}`);
            if (req.user.role === ROLES.SUPER_ADMIN) {
                updateData.role = role;
            } else {
                console.warn(`Non-SuperAdmin ${req.user.email} attempted to change role for user ${userId}`);
                return res.status(403).json({ 
                    message: "Access denied. Only Super Admin can change user roles." 
                });
            }
        }

        const user = await User.findByIdAndUpdate(
            userId,
            updateData,
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json({
            message: "User updated successfully",
            user,
            autoUpdated: autoUpdateStatus && !status ? updateData.status : null
        });

    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ 
            message: "Failed to update user", 
            error: error.message 
        });
    }
};

// Update user account status (admin only)
const updateAccountStatus = async (req, res) => {
    try {
        const { userId } = req.params;
        const { status } = req.body;

        const validStatuses = [STATUS.ACTIVE, STATUS.INACTIVE, STATUS.SUSPENDED];
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({ 
                message: "Valid status is required (active, inactive, suspended)" 
            });
        }

        // Prevent admin from suspending themselves
        if (userId === req.user._id.toString() && status === STATUS.SUSPENDED) {
            return res.status(400).json({ 
                message: "You cannot suspend your own account" 
            });
        }

        const user = await User.findByIdAndUpdate(
            userId,
            { status },
            { new: false, runValidators: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const updatedUser = await User.findById(userId).select('-password');

        await logAudit({
            req,
            action: "UPDATE",
            resourceEntity: "User",
            resourceId: userId,
            changes: {
                oldData: { status: user.status },
                newData: { status: updatedUser.status }
            }
        });

        res.status(200).json({
            message: "Account status updated successfully",
            user: updatedUser
        });

    } catch (error) {
        console.error("Error updating account status:", error);
        res.status(500).json({ 
            message: "Failed to update account status", 
            error: error.message 
        });
    }
};

// Terminate employee (admin only)
const terminateEmployee = async (req, res) => {
    try {
        const { userId } = req.params;
        const { reason } = req.body;

        const user = await User.findById(userId).select('-password');

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const updateData = {
            status: STATUS.FORMER,
            terminatedAt: new Date(),
            terminationReason: reason?.trim() || null
        };

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            updateData,
            { new: true, runValidators: true }
        ).select('-password');

        await logAudit({
            req,
            action: "UPDATE",
            resourceEntity: "User",
            resourceId: userId,
            changes: {
                oldData: { status: user.status },
                newData: updateData
            }
        });

        if (updatedUser.email) {
            try {
                await emailService.sendTerminationEmail({
                    email: updatedUser.email,
                    name: updatedUser.name,
                    reason: updateData.terminationReason
                });
            } catch (emailError) {
                console.error('Termination email failed:', emailError.message);
            }
        }

        res.status(200).json({
            message: "Employee terminated successfully",
            user: updatedUser
        });
    } catch (error) {
        console.error("Error terminating employee:", error);
        res.status(500).json({
            message: "Failed to terminate employee",
            error: error.message
        });
    }
};

// Update user role (special authority only)
const updateUserRole = async (req, res) => {
    console.log("updateUserRole: starting");
    try {
        const { userId } = req.params;
        const { role } = req.body;

        console.log("updateUserRole: params and body:", {
            userId,
            role,
            requestingUser: {
                id: req.user ? (req.user._id || req.user.id) : 'MISSING',
                email: req.user ? req.user.email : 'MISSING',
                role: req.user ? req.user.role : 'MISSING'
            }
        });
        console.log("updateUserRole: comparing roles:", {
            userRole: req.user ? req.user.role : 'N/A',
            requiredRole: ROLES.SUPER_ADMIN,
            isMatch: req.user ? (req.user.role === ROLES.SUPER_ADMIN) : false
        });

        // Validate role
        const validRoles = [ROLES.USER, ROLES.ADMIN, ROLES.EMPLOYEE, ROLES.SUPER_ADMIN];
        if (!role || !validRoles.includes(role)) {
            console.log("updateUserRole: invalid role");
            return res.status(400).json({ 
                message: `Valid role is required (${validRoles.join(', ')})` 
            });
        }

        // DOUBLE CHECK: Strictly require Super Admin
        if (req.user.role !== ROLES.SUPER_ADMIN) {
            console.log(`updateUserRole: access denied - not super-admin (${req.user.role})`);
            return res.status(403).json({ 
                message: "Access denied. Super Admin role required to change roles." 
            });
        }

        // Prevent user from changing their own role
        if (userId === req.user._id.toString()) {
            console.log("updateUserRole: cannot change own role");
            return res.status(400).json({ 
                message: "You cannot change your own role" 
            });
        }

        console.log("updateUserRole: updating user role");
        const oldUser = await User.findById(userId);
        const user = await User.findByIdAndUpdate(
            userId,
            { role },
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            console.log("updateUserRole: user not found");
            return res.status(404).json({ message: "User not found" });
        }

        try {
            await logAudit({
                req,
                action: "UPDATE",
                resourceEntity: "User",
                resourceId: user._id,
                changes: {
                    oldData: { role: oldUser ? oldUser.role : undefined },
                    newData: { role: user.role }
                }
            });
        } catch (err) {
            console.error("updateUserRole: audit error:", err);
        }

        console.log("updateUserRole: success", {
            userId: user._id,
            newRole: user.role
        });

        res.status(200).json({
            message: "User role updated successfully",
            user
        });

    } catch (error) {
        console.error("updateUserRole: error:", error);
        res.status(500).json({ 
            message: "Failed to update user role", 
            error: error.message 
        });
    }
};

// updateSpecialAuthority removed as field is deprecated

// Bulk update all users' employee status based on their applications (admin only)
const bulkUpdateUserStatusFromApplications = async (req, res) => {
    try {
        const usersUpdated = [];
        const usersWithErrors = [];

        // Get all users
        const users = await User.find({});

        for (const user of users) {
            try {
                // Fetch all applications for this user
                const userApplications = await Application.find({ userId: user._id }).select('status');
                
                if (userApplications.length > 0) {
                    const applicationStatuses = userApplications.map(app => app.status);
                    const bestEmployeeStatus = getBestEmployeeStatus(applicationStatuses);
                    
                    // Only update if the status is different
                    if (user.status !== bestEmployeeStatus) {
                        await User.findByIdAndUpdate(
                            user._id,
                            { status: bestEmployeeStatus },
                            { runValidators: true }
                        );
                        
                        usersUpdated.push({
                            userId: user._id,
                            name: user.name,
                            email: user.email,
                            oldStatus: user.status,
                            newStatus: bestEmployeeStatus,
                            applicationStatuses
                        });
                    }
                }
            } catch (userError) {
                usersWithErrors.push({
                    userId: user._id,
                    name: user.name,
                    email: user.email,
                    error: userError.message
                });
            }
        }

        res.status(200).json({
            message: "Bulk update completed",
            summary: {
                totalUsersProcessed: users.length,
                usersUpdated: usersUpdated.length,
                usersWithErrors: usersWithErrors.length
            },
            usersUpdated,
            usersWithErrors
        });

    } catch (error) {
        console.error("Error in bulk update:", error);
        res.status(500).json({ 
            message: "Failed to perform bulk update", 
            error: error.message 
        });
    }
};

// Delete user (special authority only)
const deleteUser = async (req, res) => {
    console.log("deleteUser: starting");
    try {
        const { userId } = req.params;

        console.log("deleteUser: params:", {
            userId,
            requestingUser: {
                id: req.user._id,
                email: req.user.email
            }
        });

        // Prevent admin from deleting themselves
        if (userId === req.user._id.toString()) {
            console.log("deleteUser: cannot delete own account");
            return res.status(400).json({ 
                message: "You cannot delete your own account" 
            });
        }

        console.log("deleteUser: deleting user");
        const user = await User.findByIdAndDelete(userId);

        if (!user) {
            console.log("deleteUser: user not found");
            return res.status(404).json({ message: "User not found" });
        }

        console.log("deleteUser: success", {
            deletedUserId: userId,
            deletedUserEmail: user.email
        });

        res.status(200).json({
            message: "User deleted successfully"
        });

    } catch (error) {
        console.error("deleteUser: error:", error);
        res.status(500).json({ 
            message: "Failed to delete user", 
            error: error.message 
        });
    }
};


// Bulk upload employees via CSV
const bulkUploadEmployees = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "Please upload a CSV file" });
        }

        const csvData = req.file.buffer.toString('utf8');
        const lines = csvData.split(/\r?\n/);
        
        if (lines.length < 2) {
            return res.status(400).json({ message: "CSV file is empty or missing data" });
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const expectedHeaders = [
            'name', 'email', 'phonenumber', 'role', 'department', 'position', 'reportingmanager',
            'offersalary', 'offerstartdate', 'offerworktype', 'offerbenefits', 'offercomments',
            'dob', 'nationality', 'street', 'city', 'state', 'zip', 'country', 
            'idtype', 'idnumber', 'bankname', 'bankaccountname', 'bankaccountnumber', 'bankifsc', 'bankbranch',
            'emergencyname', 'emergencyrelation', 'emergencyphone', 'emergencyemail'
        ];
        
        // Basic header validation (at least name and email)
        if (!headers.includes('name') || !headers.includes('email')) {
            return res.status(400).json({ message: "CSV must include 'name' and 'email' columns" });
        }

        const results = {
            success: 0,
            failed: 0,
            errors: []
        };

        const bcrypt = require('bcryptjs');
        const crypto = require('crypto');

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const values = line.split(',').map(v => v.trim());
            const rowData = {};
            headers.forEach((header, index) => {
                rowData[header] = values[index];
            });

            try {
                // Skip if email is missing
                if (!rowData.email) {
                    results.failed++;
                    results.errors.push(`Line ${i + 1}: Email is missing`);
                    continue;
                }

                // Check if user already exists
                const existingUser = await User.findOne({ email: rowData.email });
                if (existingUser) {
                    results.failed++;
                    results.errors.push(`Line ${i + 1}: User with email ${rowData.email} already exists`);
                    continue;
                }

                // Generate random temporary password
                const tempPassword = crypto.randomBytes(4).toString('hex'); // 8 characters
                const hashedPassword = await bcrypt.hash(tempPassword, 10);

                // Determine role (default to employee if invalid)
                let role = rowData.role || 'employee';
                if (!['admin', 'employee', 'super-admin'].includes(role)) {
                    role = 'employee';
                }

                // Create user
                const newUser = new User({
                    name: rowData.name,
                    email: rowData.email,
                    phoneNumber: rowData.phonenumber || rowData.phone || '',
                    password: hashedPassword,
                    role: role,
                    status: 'active',
                    department: rowData.department || '',
                    position: rowData.position || '',
                    reportingManager: rowData.reportingmanager || ''
                });

                await newUser.save();

                // Send welcome email
                try {
                    await emailService.sendBulkEmployeeWelcome({
                        name: rowData.name,
                        email: rowData.email,
                        role: role
                    }, tempPassword);
                } catch (emailError) {
                    console.error(`Failed to send email to ${rowData.email}:`, emailError);
                    results.errors.push(`Line ${i + 1}: User created but email failed to send`);
                }

                // --- Handle Offer & Contract Creation ---
                const hasOfferData = rowData.offersalary || rowData.offerstartdate;
                const hasContractData = rowData.dob || rowData.bankaccountnumber;

                if (hasOfferData || hasContractData) {
                    try {
                        // 1. Create Offer Letter (Accepted)
                        const offerData = {
                            userId: newUser._id,
                            candidateName: rowData.name,
                            email: rowData.email,
                            position: rowData.position || rowData.offerposition || 'Employee',
                            department: rowData.department || rowData.offerdepartment || 'Staff',
                            salary: rowData.offersalary || '0',
                            startDate: rowData.offerstartdate ? new Date(rowData.offerstartdate) : new Date(),
                            workType: rowData.offerworktype || 'Full-time',
                            benefits: rowData.offerbenefits ? rowData.offerbenefits.split(';').map(b => b.trim()) : [],
                            acceptanceComments: rowData.offercomments || 'Imported via bulk upload',
                            status: 'Accepted',
                            acceptedAt: new Date(),
                            validUntil: rowData.offerstartdate ? new Date(rowData.offerstartdate) : new Date()
                        };

                        const offerLetter = new OfferLetter(offerData);
                        await offerLetter.save();

                        // 2. Create Employment Contract (Approved)
                        if (hasContractData) {
                            const contractData = {
                                offerLetterId: offerLetter._id,
                                candidateName: rowData.name,
                                email: rowData.email,
                                personalInfo: {
                                    dateOfBirth: rowData.dob ? new Date(rowData.dob) : null,
                                    nationality: rowData.nationality || '',
                                    address: {
                                        street: rowData.street || '',
                                        city: rowData.city || '',
                                        state: rowData.state || '',
                                        zipCode: rowData.zip || '',
                                        country: rowData.country || 'India'
                                    },
                                    identificationDocuments: {
                                        idType: rowData.idtype || 'Aadhar',
                                        idNumber: rowData.idnumber || ''
                                    },
                                    emergencyContact: {
                                        name: rowData.emergencyname || '',
                                        relationship: rowData.emergencyrelation || '',
                                        phone: rowData.emergencyphone || '',
                                        email: rowData.emergencyemail || ''
                                    }
                                },
                                bankingInfo: {
                                    bankName: rowData.bankname || '',
                                    accountHolderName: rowData.bankaccountname || rowData.name,
                                    accountNumber: rowData.bankaccountnumber || '',
                                    ifscCode: rowData.bankifsc || '',
                                    branch: rowData.bankbranch || ''
                                },
                                employmentDetails: {
                                    position: offerData.position,
                                    department: offerData.department,
                                    salary: offerData.salary,
                                    startDate: offerData.startDate,
                                    workType: offerData.workType
                                },
                                status: 'Approved',
                                contractHash: crypto.randomBytes(20).toString('hex')
                            };

                            const contract = new EmploymentContract(contractData);
                            await contract.save();
                            
                            offerLetter.contractId = contract._id;
                            await offerLetter.save();
                        }

                        // 3. Link back to User
                        newUser.offerLetter = offerLetter._id;
                        
                        // Generate Employee ID
                        const employeeCount = await User.countDocuments({ 
                            role: { $in: ['employee', 'admin', 'super-admin'] },
                            employeeId: { $exists: true }
                        });
                        newUser.employeeId = `EMP${String(employeeCount + 1).padStart(3, '0')}`;
                        
                        await newUser.save();
                    } catch (offerError) {
                        console.error(`Failed to create onboarding records for ${rowData.email}:`, offerError);
                        results.errors.push(`Line ${i + 1}: User created but onboarding data failed: ${offerError.message}`);
                    }
                }

                results.success++;
            } catch (rowError) {
                console.error(`Error processing CSV line ${i + 1}:`, rowError);
                results.failed++;
                results.errors.push(`Line ${i + 1}: ${rowError.message}`);
            }
        }

        res.status(200).json({
            message: `Bulk upload completed. Success: ${results.success}, Failed: ${results.failed}`,
            results
        });

    } catch (error) {
        console.error("Bulk upload error:", error);
        res.status(500).json({ message: "Internal server error during bulk upload" });
    }
};

// Create single user (Super Admin only)
const createUser = async (req, res) => {
    try {
        const {
            name,
            email,
            password,
            phoneNumber,
            role = 'user',
            status = 'active',
            department,
            position,
            permissions
        } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: "Name, email, and password are required." });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Check if user already exists
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            return res.status(400).json({ message: "A user with this email already exists." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Assign default permissions if not explicitly provided
        let userPermissions = permissions || {};
        if (role === 'admin' || role === 'super-admin') {
            userPermissions = {
                canGenerateCertificate: true,
                canGenerateOfferLetter: true,
                canCreateJob: true,
                canManageJobs: true,
                canViewApplicants: true,
                canManageReviews: true,
                canManageEmployees: true,
                canManageRecommendations: true,
                canAccessDashboard: true,
                ...permissions
            };
        } else if (role === 'hr-admin') {
            userPermissions = {
                canGenerateCertificate: true,
                canGenerateOfferLetter: true,
                canViewApplicants: true,
                canManageReviews: true,
                canManageEmployees: true,
                canManageRecommendations: true,
                canAccessDashboard: true,
                ...permissions
            };
        }

        const newUser = new User({
            name: name.trim(),
            email: normalizedEmail,
            phoneNumber: phoneNumber ? phoneNumber.trim() : undefined,
            password: hashedPassword,
            role,
            status,
            department: department ? department.trim() : undefined,
            position: position ? position.trim() : undefined,
            permissions: userPermissions,
            isEmailVerified: true // Pre-verified since created by Super Admin
        });

        await newUser.save();

        await logAudit({
            req,
            action: 'CREATE',
            resourceEntity: 'User',
            resourceId: newUser._id,
            changes: {
                new: {
                    name: newUser.name,
                    email: newUser.email,
                    role: newUser.role,
                    status: newUser.status,
                    department: newUser.department,
                    position: newUser.position
                }
            }
        });

        const createdUser = newUser.toObject();
        delete createdUser.password;

        res.status(201).json({
            message: "User created successfully",
            user: createdUser
        });
    } catch (error) {
        console.error("Error creating user:", error);
        res.status(500).json({ message: error.message || "Failed to create user" });
    }
};

// Create single employee (Super Admin only)
const createEmployee = async (req, res) => {
    try {
        const {
            name,
            email,
            password,
            phoneNumber,
            role = 'employee',
            status = 'active',
            department,
            position,
            employeeId,
            joiningDate,
            employmentType = 'full_time',
            workLocation,
            reportingManager
        } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: "Name, email, and password are required." });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Check if user already exists
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            return res.status(400).json({ message: "A user with this email already exists." });
        }

        // Determine employee code
        let finalEmployeeCode = employeeId ? employeeId.trim() : null;
        if (finalEmployeeCode) {
            const existingCode = await User.findOne({ employeeId: finalEmployeeCode });
            if (existingCode) {
                return res.status(400).json({ message: `Employee ID ${finalEmployeeCode} is already assigned to another user.` });
            }
        } else {
            // Auto generate EMPxxx
            const count = await User.countDocuments({
                $or: [
                    { employeeId: { $exists: true, $ne: null } },
                    { role: { $in: ['employee', 'admin', 'super-admin', 'hr-admin', 'manager'] } }
                ]
            });
            let nextNum = count + 1;
            let candidateCode = `EMP${String(nextNum).padStart(3, '0')}`;
            while (await User.findOne({ employeeId: candidateCode })) {
                nextNum++;
                candidateCode = `EMP${String(nextNum).padStart(3, '0')}`;
            }
            finalEmployeeCode = candidateCode;
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Determine permissions for employee
        let permissions = {};
        if (role === 'admin' || role === 'super-admin') {
            permissions = {
                canGenerateCertificate: true,
                canGenerateOfferLetter: true,
                canCreateJob: true,
                canManageJobs: true,
                canViewApplicants: true,
                canManageReviews: true,
                canManageEmployees: true,
                canManageRecommendations: true,
                canAccessDashboard: true
            };
        } else if (role === 'hr-admin') {
            permissions = {
                canGenerateCertificate: true,
                canGenerateOfferLetter: true,
                canViewApplicants: true,
                canManageReviews: true,
                canManageEmployees: true,
                canManageRecommendations: true,
                canAccessDashboard: true
            };
        } else {
            permissions = {
                canAccessDashboard: true
            };
        }

        const newUser = new User({
            name: name.trim(),
            email: normalizedEmail,
            password: hashedPassword,
            phoneNumber: phoneNumber ? phoneNumber.trim() : undefined,
            role: role || 'employee',
            status: status || 'active',
            department: department ? department.trim() : undefined,
            position: position ? position.trim() : undefined,
            reportingManager: reportingManager ? reportingManager.trim() : undefined,
            employeeId: finalEmployeeCode,
            permissions,
            isEmailVerified: true
        });

        await newUser.save();

        // Also create/sync linked HRMS Employee record
        let newEmployee = null;
        try {
            newEmployee = await Employee.create({
                userId: newUser._id,
                employeeCode: finalEmployeeCode,
                employmentType: employmentType || 'full_time',
                employmentStatus: status === 'inactive' || status === 'former' ? 'relieved' : 'active',
                joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
                workLocation: workLocation || 'Office'
            });
        } catch (empErr) {
            console.warn("Could not create linked HRMS Employee model record:", empErr.message);
        }

        await logAudit({
            req,
            action: 'CREATE',
            resourceEntity: 'Employee',
            resourceId: newUser._id,
            changes: {
                new: {
                    name: newUser.name,
                    email: newUser.email,
                    employeeId: finalEmployeeCode,
                    role: newUser.role,
                    department: newUser.department,
                    position: newUser.position,
                    joiningDate
                }
            }
        });

        const createdUser = newUser.toObject();
        delete createdUser.password;

        res.status(201).json({
            message: "Employee created successfully",
            user: createdUser,
            employee: newEmployee
        });
    } catch (error) {
        console.error("Error creating employee:", error);
        res.status(500).json({ message: error.message || "Failed to create employee" });
    }
};

module.exports = {
    getAllUsers,
    getUserById,
    updateUserStatus,
    updateAccountStatus,
    updateUserRole,
    terminateEmployee,
    bulkUpdateUserStatusFromApplications,
    deleteUser,
    bulkUploadEmployees,
    createUser,
    createEmployee
};
