const Employee = require('../models/Employee');
const ROLE_PERMISSIONS = {
  'super-admin': ['*'], admin: ['*'], 'hr-admin': ['employees:view','employees:manage','interviews:manage','attendance:view','attendance:manage','leave:approve','leave:manage','documents:issue','documents:revoke','exits:manage','assets:manage'], recruiter: ['jobs:create','jobs:update','applications:view','applications:update','interviews:manage'], manager: ['employees:view','attendance:view','leave:approve'], finance: ['salary:view','payroll:approve','payroll:pay'], 'payroll-admin': ['salary:view','salary:manage','payroll:run','payroll:approve','payroll:pay'], employee: [], candidate: [], verifier: []
};
const can = (user, permission) => (ROLE_PERMISSIONS[user.role] || []).includes('*') || (ROLE_PERMISSIONS[user.role] || []).includes(permission) || user.permissions?.[permission] === true;
exports.requirePermission = (permission) => (req, res, next) => can(req.user, permission) ? next() : res.status(403).json({ message: `Missing permission: ${permission}` });
exports.requireSelfOrPermission = (permission) => async (req, res, next) => { const employee = await Employee.findOne({ userId: req.user._id || req.user.userId }); if (employee && String(req.params.employeeId || req.body.employeeId || '') === String(employee._id)) return next(); return can(req.user, permission) ? next() : res.status(403).json({ message: `Missing permission: ${permission}` }); };
exports.ROLE_PERMISSIONS = ROLE_PERMISSIONS;
