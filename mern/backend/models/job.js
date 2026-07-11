const mongoose = require("mongoose");

const slugBase = (value) => {
  return (value || 'job')
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'job';
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

const jobSchema = new mongoose.Schema({
  slug: { type: String, unique: true, sparse: true, index: true },
  title: { type: String, required: true },
  company: { type: String, required: true },
  description: { type: String, required: true },
  requirements: [String],
  responsibilities: [String],
  location: String,
  type: { type: String, enum: ["Full-time", "Part-time", "Contract", "Internship"] },
  salary: { type: String },
  department: { type: String },
  position: { type: String },
  reportingManager: { type: String },
  // Cloudinary image fields
  imageUrl: { type: String }, // Cloudinary URL to access the image
  cloudinaryPublicId: { type: String }, // Cloudinary public ID for deletion
  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  isActive: { type: Boolean, default: true, index: true },
  isPublished: { type: Boolean, default: false, index: true },
  hrContact: {
    name: { type: String },
    email: { type: String },
    phone: { type: String },
  },
  // Adding questions field for application form
  questions: [{
    questionText: { type: String, required: true },
    questionType: {
      type: String,
      enum: ["text", "multipleChoice", "checkbox", "file", "rating"],
      required: true
    },
    required: { type: Boolean, default: false },
    options: [String], // For multiple choice or checkbox questions
    maxRating: { type: Number, default: 5 }, // For rating questions
    order: { type: Number, default: 0 } // To control question display order
  }],
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now }
});

// Compound index for active jobs sorting by date
jobSchema.index({ isActive: 1, createdAt: -1 });
jobSchema.index({ isActive: 1, isPublished: 1, createdAt: -1 });
// Indexes for filtering
jobSchema.index({ location: 'text', title: 'text', description: 'text' });
jobSchema.index({ department: 1 });
jobSchema.index({ type: 1 });

jobSchema.pre('validate', async function () {
  if (!this.slug || this.isModified('title') || this.isModified('position')) {
    const base = slugBase(this.title || this.position);
    this.slug = await ensureUniqueSlug(this.constructor, base, this._id);
  }
});

module.exports = mongoose.model("Job", jobSchema);