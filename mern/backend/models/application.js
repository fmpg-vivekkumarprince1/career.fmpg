const mongoose = require("mongoose");

const slugBase = (value) => {
  return (value || 'application')
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'application';
};

const alphaSuffix = (index) => {
  if (index <= 0) return '';
  let n = index;
  let out = '';
  while (n > 0) {
    n -= 1;
    out = String.fromCharCode(97 + (n % 26)) + out;
    n = Math.floor(n / 26);
  }
  return out;
};

const ensureUniqueSlug = async (model, base, selfId) => {
  let attempt = 0;
  while (true) {
    const suffix = alphaSuffix(attempt);
    const candidate = suffix ? `${base}-${suffix}` : base;
    const conflict = await model.findOne({
      slug: candidate,
      _id: { $ne: selfId }
    }).select('_id');
    if (!conflict) return candidate;
    attempt += 1;
  }
};

const applicationSchema = new mongoose.Schema({
  slug: { type: String, unique: true, sparse: true, index: true },
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true }, // Reference to the user who applied
  fullName: { type: String, required: true },
  email: { type: String, required: true, index: true },
  phone: { type: String, required: true },
  resume: { type: String }, // Path to uploaded resume (legacy)
  resumeUrl: { type: String }, // URL to access the resume
  cloudinaryPublicId: { type: String }, // Cloudinary public ID for resume
  experience: String,
  education: String,
  skills: [String],
  coverLetter: String,
  // Referral fields
  isReferred: { type: Boolean, default: false },
  // Recommendation reference for employee recommendations
  recommendationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Recommendation"
  },
  // Add field for question answers
  questionAnswers: [{
    questionId: { type: mongoose.Schema.Types.ObjectId },
    questionText: { type: String },
    questionType: { type: String, enum: ["text", "multipleChoice", "checkbox", "file", "rating"] },
    answer: { type: mongoose.Schema.Types.Mixed }, // Can store different types of answers
    fileUrl: { type: String }, // For file type questions
    cloudinaryPublicId: { type: String } // Cloudinary public ID for file uploads
  }],
  status: { 
    type: String, 
    enum: ["pending", "reviewing", "shortlisted", "rejected", "offered", "hired"], 
    default: "pending",
    index: true
  },
  offerLetter: { type: String }, // Path to generated offer letter (legacy)
  offerLetterId: { type: mongoose.Schema.Types.ObjectId, ref: "OfferLetter" }, // Reference to offer letter record
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now }
});

// Compound indexes for fast status, user, and job queries
applicationSchema.index({ status: 1, createdAt: -1 });
applicationSchema.index({ jobId: 1, status: 1 });
applicationSchema.index({ userId: 1, createdAt: -1 });
applicationSchema.index({ userId: 1, jobId: 1 });
applicationSchema.index({ jobId: 1, createdAt: -1 });

applicationSchema.pre('validate', async function() {
  if (!this.slug || this.isModified('fullName')) {
    const base = slugBase(this.fullName);
    this.slug = await ensureUniqueSlug(this.constructor, base, this._id);
  }
});

module.exports = mongoose.model("Application", applicationSchema);