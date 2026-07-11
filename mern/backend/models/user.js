const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phoneNumber: { type: String },
  password: { type: String, required: true, select: false },
  role: {
    type: String,
    default: "user",
    enum: ["user", "admin", "employee", "super-admin"]
  },
  permissions: {
    canGenerateCertificate: { type: Boolean, default: false },
    canGenerateOfferLetter: { type: Boolean, default: false },
    canCreateJob: { type: Boolean, default: false },
    canManageJobs: { type: Boolean, default: false },
    canViewApplicants: { type: Boolean, default: false },
    canManageReviews: { type: Boolean, default: false },
    canManageEmployees: { type: Boolean, default: false },
    canManageRecommendations: { type: Boolean, default: false },
    canAccessDashboard: { type: Boolean, default: false }
  },
  assignedJobs: [{ type: mongoose.Schema.Types.ObjectId, ref: "Job" }],
  status: {
    type: String,
    enum: ["active", "inactive", "former", "suspended"],
    default: "active"
  },
  positionLevel: {
    type: String,
    enum: ["Junior", "Senior", "Lead", "Manager", "Director"],
    default: "Junior"
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationOTP: {
    type: String,
    default: null
  },
  emailVerificationOTPExpiry: {
    type: Date,
    default: null
  },
  passwordResetOTP: {
    type: String,
    default: null
  },
  passwordResetOTPExpiry: {
    type: Date,
    default: null
  },
  moreInfo: { type: mongoose.Schema.Types.ObjectId, ref: "UserMoreInfo" },
  offerLetter: { type: mongoose.Schema.Types.ObjectId, ref: "OfferLetter" },
  department: { type: String },
  position: { type: String },
  reportingManager: { type: String },
  // Employee ID for current employees/interns
  employeeId: {
    type: String,
    unique: true,
    sparse: true // Only required for employees, allows null values 
  },
  terminatedAt: {
    type: Date,
    default: null
  },
  terminationReason: {
    type: String,
    default: null
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("User", userSchema);
