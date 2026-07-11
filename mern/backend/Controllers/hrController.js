const User = require("../models/user");
const { logAudit } = require("../services/auditService");
const Job = require("../models/job");

// Get all users in HR department or with legacy HR role
exports.getAllHRs = async (req, res) => {
  try {
    const hrs = await User.find({ 
      $or: [{ department: "HR" }, { role: "hr" }] 
    }).select("-password");
    res.json(hrs);
  } catch (error) {
    res.status(500).json({ message: "Error fetching HRs", error: error.message });
  }
};

// Update HR permissions and job assignments
exports.updateHRPermissions = async (req, res) => {
  const { hrId } = req.params;
  const { permissions, assignedJobs } = req.body;

  try {
    const hr = await User.findById(hrId);
    if (!hr) {
      return res.status(404).json({ message: "HR user not found" });
    }

    if (hr.department !== "HR" && hr.role !== "hr") {
      return res.status(400).json({ message: "User is not in the HR department" });
    }

    const previousState = {
      permissions: hr.permissions,
      assignedJobs: hr.assignedJobs
    };

    hr.permissions = { ...hr.permissions, ...permissions };
    if (assignedJobs) {
      hr.assignedJobs = assignedJobs;
    }

    await hr.save();

    // Log the change
    await logAudit({
      req,
      action: "UPDATE_PERMISSIONS",
      resourceEntity: "User",
      resourceId: hr._id,
      changes: {
        from: previousState,
        to: { permissions: hr.permissions, assignedJobs: hr.assignedJobs }
      }
    });

    res.json({ message: "Permissions updated successfully", hr });
  } catch (error) {
    res.status(500).json({ message: "Error updating permissions", error: error.message });
  }
};

// Create or promote a user to HR role
exports.createHR = async (req, res) => {
  const { userId, email, permissions, assignedJobs } = req.body;
  console.log("CreateHR: processing", { userId, email });

  try {
    let user;
    if (userId) {
      user = await User.findById(userId);
    } else if (email) {
      user = await User.findOne({ email });
    }

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // If user is a regular user, promote to employee and set department to HR
    if (user.role === "user") {
      user.role = "employee";
    }
    user.department = "HR";
    user.permissions = permissions || user.permissions;
    user.assignedJobs = assignedJobs || user.assignedJobs;

    await user.save();

    await logAudit({
      req,
      action: "ASSIGN",
      resourceEntity: "User",
      resourceId: user._id,
      changes: { role: "hr", permissions, assignedJobs }
    });

    res.json({ message: "User promoted to HR role", user });
  } catch (error) {
    res.status(500).json({ message: "Error creating HR", error: error.message });
  }
};

// Revoke HR role from a user
exports.revokeHR = async (req, res) => {
  const { hrId } = req.params;
  console.log("RevokeHR: processing", hrId);

  try {
    const user = await User.findById(hrId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.department !== "HR" && user.role !== "hr") {
      return res.status(400).json({ message: "User is not in the HR department" });
    }

    const previousState = {
      role: user.role,
      permissions: user.permissions,
      assignedJobs: user.assignedJobs
    };

    // Reset department and permissions
    // We don't necessarily demote to 'user' role if they were an 'employee' or 'admin' 
    // but if they were 'hr' role (legacy), we move them back to 'user' or 'employee'
    if (user.role === "hr") {
      user.role = "employee";
    }
    user.department = "General Management/Administration"; // Default or other
    user.permissions = {
      canGenerateCertificate: false,
      canGenerateOfferLetter: false,
      canCreateJob: false,
      canManageJobs: false,
      canViewApplicants: false,
      canManageReviews: false,
      canManageEmployees: false,
      canManageRecommendations: false,
      canAccessDashboard: false
    };
    user.assignedJobs = [];

    await user.save();

    // Log the change
    await logAudit({
      req,
      action: "REVOKE",
      resourceEntity: "User",
      resourceId: user._id,
      changes: {
        from: previousState,
        to: { role: "user", permissions: user.permissions, assignedJobs: [] }
      }
    });

    res.json({ message: "HR role revoked successfully", user });
  } catch (error) {
    res.status(500).json({ message: "Error revoking HR role", error: error.message });
  }
};

// Get audit logs for permission changes
const AuditLog = require("../models/auditLog");
exports.getAuditLogs = async (req, res) => {
  try {
    const logs = await AuditLog.find({ action: { $in: ["UPDATE_PERMISSIONS", "ASSIGN", "REVOKE"] } })
      .populate("actor", "name email")
      .populate("resourceId", "name email")
      .sort({ createdAt: -1 });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: "Error fetching audit logs", error: error.message });
  }
};

// Get all available jobs for assignment
exports.getAvailableJobs = async (req, res) => {
    try {
        const jobs = await Job.find({ isActive: true }).select("title company _id");
        res.json(jobs);
    } catch (error) {
        res.status(500).json({ message: "Error fetching jobs", error: error.message });
    }
};
