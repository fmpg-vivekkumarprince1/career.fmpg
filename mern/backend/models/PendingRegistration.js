const mongoose = require("mongoose");

const pendingRegistrationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phoneNumber: {
      type: String,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      default: "user",
    },
    emailVerificationOTP: {
      type: String,
      required: true,
    },
    emailVerificationOTPExpiry: {
      type: Date,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 900, // MongoDB TTL index: document will automatically expire & delete after 15 minutes
    },
  },
  {
    timestamps: false,
  }
);

module.exports = mongoose.model("PendingRegistration", pendingRegistrationSchema);
