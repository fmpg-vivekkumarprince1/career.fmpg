const jwt = require("jsonwebtoken");
const User = require("../models/user");
const OfferLetter = require("../models/offerLetter");
const Job = require("../models/job");
const Application = require("../models/application");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { authConfig } = require("../config/authConfig");
const { ROLES, DEPARTMENTS } = require("../utils/constants");

const isVerboseAuthLogging = process.env.VERBOSE_AUTH_LOGS === 'true';
const authLog = (...args) => {
    if (isVerboseAuthLogging) {
        console.log(...args);
    }
};

const auth = async (req, res, next) => {
    authLog("Auth: processing");
    const authHeader = req.header("Authorization");
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        authLog("Auth: no token");
        return res.status(401).json({ message: "Access denied. No token provided." });
    }

    try {
        authLog("Auth: verifying");
        const decoded = jwt.verify(token, authConfig.jwtSecret);
        authLog(`Auth: valid for ${decoded.userId}`);

        // Fetch full user details to populate permissions and assignedJobs
        const user = await User.findById(decoded.userId);

        if (!user) {
            authLog("Auth: user not found");
            return res.status(401).json({ message: "User not found. Authentication failed." });
        }

        // Attach user to request object as a plain JS object for more robust property access
        req.user = {
            ...user.toObject(),
            userId: user._id.toString() // For compatibility with existing code
        };

        next();
    } catch (error) {
        console.error("Auth: verification failed:", error.message);
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: "Token has expired. Please login again." });
        } else if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: "Invalid token." });
        } else {
            return res.status(401).json({ message: "Authentication failed." });
        }
    }
};

// Attach the authenticated user when a valid token is present, while keeping
// public read endpoints accessible to anonymous visitors.
const optionalAuth = async (req, res, next) => {
    const authHeader = req.header("Authorization");
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) return next();

    try {
        const decoded = jwt.verify(token, authConfig.jwtSecret);
        const user = await User.findById(decoded.userId);
        if (user) {
            req.user = {
                ...user.toObject(),
                userId: user._id.toString()
            };
        }
    } catch (error) {
        authLog("OptionalAuth: ignoring invalid token", error.message);
    }

    next();
};

const verifyAdmin = async (req, res, next) => {
    authLog("Admin: processing");
    try {
        //check for token
        const token = req.header("Authorization")?.split(" ")[1];
        if (!token) {
            authLog("Admin: no token");
            return res.status(401).json({ message: "Unauthorized: No token provided." });
        }        //decode token
        authLog("Admin: decoding");
        const decoded = jwt.verify(token, authConfig.jwtSecret);

        //fetch user details
        authLog(`Admin: finding ${decoded.userId}`);
        const user = await User.findById(decoded.userId);
        if (!user) {
            authLog("Admin: user not found");
            return res.status(404).json({ message: "User not found" });
        }

        //check role
        authLog(`Admin: role ${user.role}`);
        if (user.role !== ROLES.ADMIN && user.role !== ROLES.SUPER_ADMIN) {
            authLog("Admin: not admin");
            return res.status(403).json({ message: "Access denied. Admins only." });
        }
        console.log("Admin: granted");
        authLog("Admin: granted");
        req.user = user;
        next();
    } catch (error) {
        console.error("Admin: error:", error.message);
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: "Token has expired. Please login again." });
        } else if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: "Invalid token." });
        } else {
            return res.status(500).json({ message: "Server error", error: error.message });
        }
    }
}

const verifyReviewEligibility = async (req, res, next) => {
    authLog("ReviewEligibility: processing");
    try {
        // Check for token
        const token = req.header("Authorization")?.split(" ")[1];
        if (!token) {
            authLog("ReviewEligibility: no token");
            return res.status(401).json({ message: "Unauthorized: No token provided." });
        }

        // Decode token
        authLog("ReviewEligibility: decoding");
        const decoded = jwt.verify(token, authConfig.jwtSecret);

        // Fetch user details
        authLog(`ReviewEligibility: finding ${decoded.userId}`);
        const user = await User.findById(decoded.userId);
        if (!user) {
            authLog("ReviewEligibility: user not found");
            return res.status(404).json({ message: "User not found" });
        }        // Strictly allow only users with 'employee' role
        // This excludes 'user', 'admin', and 'super-admin' as per user request
        if (user.role === ROLES.EMPLOYEE) {
            // Must be active or former to review
            if (user.status === 'active' || user.status === 'former') {
                authLog("ReviewEligibility: valid employee user");
                req.user = user;
                req.reviewerType = 'employee';
                return next();
            }
        }

        authLog("ReviewEligibility: access denied for this role/status");
        return res.status(403).json({
            message: "Access denied. Only current employees can access this feature."
        });

        // Note: Offer recipient logic remains for backward compatibility with applications 
        // that still use the offerLetter status logic below.

        // Check if user has received an offer letter (backup check)
        const offerLetter = await OfferLetter.findOne({
            $or: [
                { userId: user._id },
                { email: user.email }
            ],
            status: { $in: ['Accepted', 'Pending'] }
        });

        if (offerLetter) {
            authLog("ReviewEligibility: offer letter recipient");
            req.user = user;
            req.reviewerType = offerLetter.status === 'Accepted' ? 'employee' : 'offer_recipient';
            return next();
        }

        // If no offer letter found, deny access
        authLog("ReviewEligibility: not eligible");
        return res.status(403).json({
            message: "Access denied. Only employees or offer letter recipients can write reviews."
        });

    } catch (error) {
        console.error("ReviewEligibility: error:", error.message);
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: "Token has expired. Please login again." });
        } else if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: "Invalid token." });
        } else {
            return res.status(500).json({ message: "Server error", error: error.message });
        }
    }
};

// Middleware to verify user is authenticated
const authenticateToken = async (req, res, next) => {
    authLog("AuthenticateToken: processing");
    try {
        const token = req.header("Authorization")?.split(" ")[1];
        if (!token) {
            authLog("AuthenticateToken: no token");
            return res.status(401).json({ message: "Unauthorized: No token provided." });
        }

        const decoded = jwt.verify(token, authConfig.jwtSecret);
        const user = await User.findById(decoded.userId);

        if (!user) {
            authLog("AuthenticateToken: user not found");
            return res.status(404).json({ message: "User not found" });
        }

        // Add both id and _id for compatibility
        req.user = {
            ...user.toObject(),
            id: user._id,
            _id: user._id,
            userId: user._id.toString()
        };
        authLog(`AuthenticateToken: authenticated ${user.email} (ID: ${user._id})`);
        next();
    } catch (error) {
        console.error("AuthenticateToken: error:", error.message);
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: "Token has expired. Please login again." });
        } else if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: "Invalid token." });
        } else {
            return res.status(500).json({ message: "Server error", error: error.message });
        }
    }
};

// Middleware to verify user is admin
const isAdmin = (req, res, next) => {
    if (req.user.role !== ROLES.ADMIN && req.user.role !== ROLES.SUPER_ADMIN) {
        return res.status(403).json({ message: "Access denied. Admins only." });
    }
    next();
};

// Middleware to verify user is employee/intern (has employeeId and is employee)
const isEmployee = (req, res, next) => {
    if (req.user.role === ROLES.ADMIN || req.user.role === ROLES.SUPER_ADMIN) return next();

    const hasEmployeeAccess = req.user.role === ROLES.EMPLOYEE ||
        req.user.status === 'active';

    if (!hasEmployeeAccess) {
        return res.status(403).json({
            message: "Access denied. Only current employees/interns can access this resource."
        });
    }
    next();
};

// Middleware to verify user is only an employee (not intern/offer recipient)
const isEmployeeOnly = (req, res, next) => {
    if (req.user.role === ROLES.ADMIN || req.user.role === ROLES.SUPER_ADMIN) return next();

    const isFullEmployee = req.user.role === ROLES.EMPLOYEE ||
        req.user.status === 'active';

    if (!isFullEmployee) {
        return res.status(403).json({
            message: "Access denied. Only current employees can make job recommendations."
        });
    }
    next();
};

// Middleware to verify user is Super Admin (for critical operations like changing roles and deleting records)
const verifySuperAdmin = async (req, res, next) => {
    authLog("SuperAdmin: processing");
    try {
        // If auth middleware already populated req.user
        if (req.user) {
            const role = (req.user.role || '').toLowerCase();
            if (role === ROLES.SUPER_ADMIN) {
                authLog("SuperAdmin: granted via req.user");
                return next();
            }
            authLog("SuperAdmin: access denied - not super-admin");
            return res.status(403).json({
                message: "Access denied. Super Admin role required for this operation."
            });
        }

        const token = req.header("Authorization")?.split(" ")[1];
        if (!token) {
            authLog("SuperAdmin: no token");
            return res.status(401).json({ message: "Unauthorized: No token provided." });
        }

        const decoded = jwt.verify(token, authConfig.jwtSecret);
        authLog("SuperAdmin: decoded user ID:", decoded.userId);

        const user = await User.findById(decoded.userId);

        if (!user) {
            authLog("SuperAdmin: user not found");
            return res.status(404).json({ message: "User not found" });
        }

        // Check if user has super-admin role
        const role = (user.role || '').toLowerCase();
        if (role !== ROLES.SUPER_ADMIN) {
            authLog("SuperAdmin: access denied - not super-admin");
            return res.status(403).json({
                message: "Access denied. Super Admin role required for this operation."
            });
        }

        authLog("SuperAdmin: granted");
        req.user = {
            ...user.toObject(),
            userId: user._id.toString()
        };
        next();
    } catch (error) {
        console.error("SuperAdmin: error:", error.message);
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: "Token has expired. Please login again." });
        } else if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: "Invalid token." });
        } else {
            return res.status(500).json({ message: "Server error", error: error.message });
        }
    }
};

const isHR = (req, res, next) => {
    const userRole = (req.user.role || '').toLowerCase();
    const userDept = (req.user.department || '').toLowerCase();

    const isHRUser = userDept === 'hr' ||
        userDept === 'human resources' ||
        userRole === 'hr' ||
        userRole === 'admin' ||
        userRole === 'super-admin';

    if (!isHRUser) {
        return res.status(403).json({ message: "Access denied. HR or Admin access required." });
    }
    next();
};

// Middleware to check specific permission for HR/Admin
const hasPermission = (permission) => {
    return (req, res, next) => {
        const userRole = (req.user.role || '').toLowerCase();
        const userDept = (req.user.department || '').toLowerCase();

        // Admins and Super-Admins have all permissions
        if (userRole === 'admin' || userRole === 'super-admin') {
            return next();
        }

        const isHRDept = userDept === 'hr' ||
            userDept === 'human resources' ||
            userRole === 'hr';

        console.log(`Permission Check: "${permission}" for user ${req.user.email}`);
        console.log(`- Role: ${req.user.role}, Dept: ${req.user.department}, isHRDept: ${isHRDept}`);
        console.log(`- Permissions:`, JSON.stringify(req.user.permissions));

        if (isHRDept) {
            // Default permissions for HR department if not explicitly set
            const userPermissions = req.user.permissions || {};

            // Critical permissions that HR should have by default in the new system
            const defaultHRPermissions = ['canViewApplicants', 'canCreateJob', 'canManageReviews'];

            const hasExplicitPerm = userPermissions[permission] === true;
            const hasDefaultPerm = defaultHRPermissions.includes(permission) && userPermissions[permission] !== false;

            console.log(`- hasExplicitPerm: ${hasExplicitPerm}, hasDefaultPerm: ${hasDefaultPerm}`);

            if (hasExplicitPerm || hasDefaultPerm) {
                console.log(`- Permission GRANTED`);
                return next();
            }

            console.log(`- Permission DENIED (HR Dept)`);
            return res.status(403).json({
                message: `Access denied. You do not have permission: ${permission}`
            });
        }

        console.log(`- Permission DENIED (Not HR Dept/Admin)`);

        return res.status(403).json({ message: "Access denied. Unauthorized role or department." });
    };
};

// Middleware to check if HR is assigned to a specific job
const checkJobAssignment = async (req, res, next) => {
    const rawJobOrEntityId = req.params.jobId || req.body.jobId || req.params.id || req.params.applicationId;

    if (!rawJobOrEntityId) {
        return next();
    }

    let resolvedJobId = rawJobOrEntityId;

    if (!mongoose.Types.ObjectId.isValid(rawJobOrEntityId)) {
        const jobDoc = await Job.findOne({ slug: rawJobOrEntityId }).select('_id');
        if (jobDoc) {
            resolvedJobId = jobDoc._id.toString();
        } else {
            const appDoc = await Application.findOne({ slug: rawJobOrEntityId }).select('jobId');
            if (appDoc?.jobId) {
                resolvedJobId = appDoc.jobId.toString();
            }
        }
    }

    const userRole = (req.user.role || '').toLowerCase();
    const userDept = (req.user.department || '').toLowerCase();

    if (userRole === 'admin' || userRole === 'super-admin') {
        return next();
    }

    const isHRDept = userDept === 'hr' ||
        userDept === 'human resources' ||
        userRole === 'hr';

    if (isHRDept) {
        const isAssigned = req.user.assignedJobs && req.user.assignedJobs.some(id => id.toString() === resolvedJobId.toString());
        if (isAssigned) {
            return next();
        }
        return res.status(403).json({ message: "Access denied. You are not assigned to this job." });
    }

    return res.status(403).json({ message: "Access denied." });
};

module.exports = {
    auth,
    optionalAuth,
    verifyAdmin,
    verifyReviewEligibility,
    authenticateToken,
    isAdmin,
    isHR,
    hasPermission,
    checkJobAssignment,
    isEmployee,
    isEmployeeOnly,
    verifySuperAdmin
}
