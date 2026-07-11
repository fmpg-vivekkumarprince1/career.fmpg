const Job = require("../models/job");
const mongoose = require("mongoose");
const fs = require('fs');
const path = require('path');
const { uploadImage, deleteImage, extractPublicId } = require('../config/cloudinary');
const { createJobUpdateNotifications } = require('./notificationController');
const { logAudit } = require('../services/auditService');

const publicJobFilter = {
  isActive: true,
  $or: [
    { isPublished: true },
    { isPublished: { $exists: false } }
  ]
};

const isAdminUser = (user) => ['admin', 'super-admin'].includes((user?.role || '').toLowerCase());

const canManageJob = (user, job) => {
  if (isAdminUser(user)) return true;
  if (user?.permissions?.canManageJobs !== true) return false;

  const isHR = ['hr', 'human resources'].includes((user.department || '').toLowerCase()) ||
    (user.role || '').toLowerCase() === 'hr';
  return isHR && Array.isArray(user.assignedJobs) &&
    user.assignedJobs.some((id) => id.toString() === job._id.toString());
};

const isPubliclyVisible = (job) => job.isActive && job.isPublished !== false;

const findJobByIdentifier = async (identifier) => {
  if (!identifier) return null;
  if (mongoose.Types.ObjectId.isValid(identifier)) {
    const byId = await Job.findById(identifier).lean();
    if (byId) return byId;
  }
  return Job.findOne({ slug: identifier }).lean();
};

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

const ensureUniqueJobSlug = async (base, selfId) => {
  let attempt = 0;
  while (true) {
    const suffix = alphaSuffix(attempt);
    const candidate = suffix ? `${base}-${suffix}` : base;
    const conflict = await Job.findOne({
      slug: candidate,
      _id: { $ne: selfId }
    }).select('_id');
    if (!conflict) return candidate;
    attempt += 1;
  }
};

// Create job
exports.createJob = async (req, res) => {
  console.log("Job: new");
  try {
    const { title, company, description, requirements, responsibilities, position, department, location, type, salary, questions, hrContact, isPublished } = req.body;
    console.log(`Job: ${title}`);

    if (!title || !description) {
      console.log("Missing fields");
      return res.status(400).json({ message: "Title and description are required" });
    }

    console.log('ReqBody:', req.body);

    // Parse questions if string
    let parsedQuestions = [];
    if (questions) {
      if (typeof questions === 'string') {
        try {
          parsedQuestions = JSON.parse(questions);
          console.log("Questions: parsed");
        } catch (err) {
          console.error("Parse err:", err);
          return res.status(400).json({ message: "Invalid questions format. Please provide a valid JSON array." });
        }
      } else {
        parsedQuestions = questions;
      }
    }

    let parsedHrContact = {};
    if (hrContact) {
      if (typeof hrContact === 'string') {
        try {
          parsedHrContact = JSON.parse(hrContact);
        } catch (err) {
          console.error("Parse hrContact err:", err);
        }
      } else {
        parsedHrContact = hrContact;
      }
    }

    // Create job
    const job = new Job({
      title,
      company,
      description,
      requirements: requirements || [],
      responsibilities: responsibilities || [],
      location,
      position,
      department,
      type,
      salary,
      questions: parsedQuestions,
      hrContact: parsedHrContact,
      postedBy: req.user._id,
      isPublished: isPublished === true || isPublished === 'true'
    });

    // Handle image upload to Cloudinary
    if (req.file) {
      console.log("Uploading image to Cloudinary...");
      console.log(`Image details: ${req.file.originalname}, Size: ${(req.file.size / 1024 / 1024).toFixed(2)}MB`);

      let uploadAttempt = 0;
      const maxRetries = 3;

      while (uploadAttempt < maxRetries) {
        try {
          // Upload directly from buffer to Cloudinary
          const cloudinaryResult = await uploadImage(req.file.buffer, 'job-images');

          // Store Cloudinary URL and public ID
          job.imageUrl = cloudinaryResult.secure_url;
          job.cloudinaryPublicId = cloudinaryResult.public_id;
          console.log("Image uploaded to Cloudinary successfully:", cloudinaryResult.secure_url);
          break; // Success, exit retry loop

        } catch (uploadError) {
          uploadAttempt++;
          console.error(`Cloudinary upload attempt ${uploadAttempt} failed:`, uploadError.message);

          if (uploadAttempt >= maxRetries) {
            console.error("All upload attempts failed");
            return res.status(500).json({
              message: "Failed to upload image after multiple attempts",
              error: uploadError.message
            });
          }

          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 2000 * uploadAttempt));
        }
      }
    }

    console.log("Saving job");
    const savedJob = await job.save();
    console.log(`Created: ${savedJob._id}`);

    if (!isAdminUser(req.user)) {
      const User = require("../models/user");
      await User.findByIdAndUpdate(req.user._id, { $addToSet: { assignedJobs: savedJob._id } });
    }

    // Log the action
    await logAudit({
      req,
      action: "CREATE",
      resourceEntity: "Job",
      resourceId: savedJob._id,
      changes: { new: savedJob.toObject() }
    });

    res.status(201).json({
      message: "Job posted successfully",
      job: savedJob
    });

  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Featured jobs
exports.getFeaturedJobs = async (req, res) => {
  console.log("Jobs: featured");
  try {
    // Active jobs
    const featuredJobs = await Job.find(publicJobFilter)
      .sort({ createdAt: -1 }) // Newest first
      .limit(5) // 5 max
      .lean();

    console.log(`Found: ${featuredJobs.length}`);
    res.status(200).json(featuredJobs);
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// All active jobs
exports.getJobs = async (req, res) => {
  console.log("Jobs: active");
  try {
    let query = publicJobFilter;

    if (isAdminUser(req.user)) {
      query = {};
    } else if (req.user?.permissions?.canManageJobs === true &&
      ['hr', 'human resources'].includes((req.user.department || '').toLowerCase())) {
      const assignedJobIds = Array.isArray(req.user.assignedJobs)
        ? req.user.assignedJobs.map(id => id.toString())
        : [];

      if (assignedJobIds.length > 0) {
        query = {
          $or: [
            publicJobFilter,
            { _id: { $in: assignedJobIds } }
          ]
        };
      }
    }

    const jobs = await Job.find(query).populate('postedBy', 'name email').sort({ createdAt: -1 }).lean();

    if (req.user) {
      const Application = require("../models/application");
      const applications = await Application.find({ userId: req.user._id }).select('jobId status');
      const applicationMap = new Map(applications.map(app => [app.jobId.toString(), app.status]));

      const jobsWithStatus = jobs.map(job => ({
        ...job,
        applicationStatus: applicationMap.get(job._id.toString())
      }));

      console.log(`Found: ${jobsWithStatus.length} (with status)`);
      return res.status(200).json(jobsWithStatus);
    }

    console.log(`Found: ${jobs.length}`);
    res.status(200).json(jobs);
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Job by ID
exports.getJobById = async (req, res) => {
  console.log(`Job: ${req.params.id}`);
  try {
    const job = await findJobByIdentifier(req.params.id);
    if (!job) {
      console.log(`Not found: ${req.params.id}`);
      return res.status(404).json({ message: "Job not found" });
    }
    if (!isPubliclyVisible(job) && !canManageJob(req.user, job)) {
      return res.status(403).json({ message: "Access denied. This job is not published." });
    }
    console.log(`Found: ${job.title}`);
    res.status(200).json(job);
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update job
exports.updateJob = async (req, res) => {
  console.log(`Update: ${req.params.id}`);
  try {
    // Get existing job data to compare for changes
    const existingJob = await findJobByIdentifier(req.params.id);
    if (!existingJob) {
      console.log(`Not found: ${req.params.id}`);
      return res.status(404).json({ message: "Job not found" });
    }

    // Store original job data for notification comparison
    const oldJobData = {
      title: existingJob.title,
      requirements: existingJob.requirements,
      responsibilities: existingJob.responsibilities,
      description: existingJob.description,
      department: existingJob.department,
      position: existingJob.position
    };

    const updates = req.body;
    updates.updatedAt = Date.now();
    console.log(`Fields: ${Object.keys(updates).join(', ')}`);

    // Parse questions if string
    if (typeof updates.questions === 'string') {
      try {
        updates.questions = JSON.parse(updates.questions);
        console.log("Questions: parsed");
      } catch (err) {
        console.error("Parse err:", err);
        return res.status(400).json({ message: "Invalid questions format. Please provide a valid JSON array." });
      }
    }

    // Parse hrContact if string
    if (typeof updates.hrContact === 'string') {
      try {
        updates.hrContact = JSON.parse(updates.hrContact);
      } catch (err) {
        console.error("Parse hrContact err:", err);
      }
    }

    if (typeof updates.isPublished === 'string') {
      updates.isPublished = updates.isPublished === 'true';
    }

    if (typeof updates.title === 'string' && updates.title.trim()) {
      updates.slug = await ensureUniqueJobSlug(slugBase(updates.title), existingJob._id);
    }

    // Handle image upload to Cloudinary
    if (req.file) {
      console.log("Uploading new image to Cloudinary...");
      console.log(`Image details: ${req.file.originalname}, Size: ${(req.file.size / 1024 / 1024).toFixed(2)}MB`);

      let uploadAttempt = 0;
      const maxRetries = 3;

      while (uploadAttempt < maxRetries) {
        try {
          // Upload directly from buffer to Cloudinary
          const cloudinaryResult = await uploadImage(req.file.buffer, 'job-images');

          // Delete old image from Cloudinary if it exists
          if (existingJob.cloudinaryPublicId) {
            try {
              await deleteImage(existingJob.cloudinaryPublicId);
              console.log("Old image deleted from Cloudinary");
            } catch (deleteError) {
              console.warn("Failed to delete old image from Cloudinary:", deleteError.message);
            }
          }

          // Update with new Cloudinary data
          updates.imageUrl = cloudinaryResult.secure_url;
          updates.cloudinaryPublicId = cloudinaryResult.public_id;
          console.log("New image uploaded to Cloudinary successfully:", cloudinaryResult.secure_url);
          break; // Success, exit retry loop

        } catch (uploadError) {
          uploadAttempt++;
          console.error(`Cloudinary upload attempt ${uploadAttempt} failed:`, uploadError.message);

          if (uploadAttempt >= maxRetries) {
            console.error("All upload attempts failed");
            return res.status(500).json({
              message: "Failed to upload image after multiple attempts",
              error: uploadError.message
            });
          }

          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 2000 * uploadAttempt));
        }
      }
    } else {
      // Keep existing images if no new image uploaded
      delete updates.imageUrl;
      delete updates.cloudinaryPublicId;
    }

    // Update job
    const job = await Job.findOneAndUpdate(
      { _id: existingJob._id },
      { $set: updates },
      { new: true, runValidators: true }
    );

    // Log the update action
    await logAudit({
      req,
      action: "UPDATE",
      resourceEntity: "Job",
      resourceId: job._id,
      changes: {
        oldData: oldJobData,
        newData: job.toObject()
      }
    });

    console.log(`Updated: ${job.title}`);
    console.log("Images:", {
      image: job.image || 'none',
      imageUrl: job.imageUrl || 'none'
    });

    // Create notifications for job requirement updates asynchronously
    // Don't block the response for notification creation
    setImmediate(async () => {
      try {
        await createJobUpdateNotifications(existingJob._id, oldJobData, job.toObject());
      } catch (notificationError) {
        console.error("Error creating job update notifications:", notificationError);
        // Don't fail the job update if notification creation fails
      }
    });

    res.status(200).json({
      message: "Job updated successfully",
      job
    });
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Delete job
exports.deleteJob = async (req, res) => {
  console.log(`Delete: ${req.params.id}`);
  try {
    const existingJob = await findJobByIdentifier(req.params.id);
    if (!existingJob) {
      console.log(`Not found: ${req.params.id}`);
      return res.status(404).json({ message: "Job not found" });
    }

    const job = await Job.findByIdAndUpdate(
      existingJob._id,
      { isActive: false },
      { new: true }
    );

    if (!job) {
      console.log(`Not found: ${req.params.id}`);
      return res.status(404).json({ message: "Job not found" });
    }

    // Log the delete action
    await logAudit({
      req,
      action: "DELETE",
      resourceEntity: "Job",
      resourceId: job._id,
      changes: {
        oldData: { isActive: true },
        newData: { isActive: false }
      }
    });

    console.log(`Deactivated: ${job.title}`);
    res.status(200).json({
      message: "Job deleted successfully"
    });
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get all jobs
exports.getAllJobs = async (req, res) => {
  console.log("Admin: all jobs");
  try {
    let query = {};
    if (req.user.role === 'hr' || req.user.department === 'HR') {
      query = { _id: { $in: req.user.assignedJobs } };
    }
    const jobs = await Job.find(query).sort({ createdAt: -1 }).lean();
    console.log(`Found: ${jobs.length}`);
    res.status(200).json(jobs);
  } catch (error) {
    handleError(res, error, "getAllJobs");
  }
};

// Search jobs
exports.searchJobs = async (req, res) => {
  console.log("Search jobs");
  try {
    const { query } = req.query;

    if (!query) {
      console.log("No query");
      return res.status(400).json({ message: "Search query is required" });
    }

    console.log(`Query: "${query}"`);

    const jobs = await Job.find({
      $and: [
        publicJobFilter,
        {
          $or: [
            { title: { $regex: query, $options: 'i' } },
            { description: { $regex: query, $options: 'i' } },
            { location: { $regex: query, $options: 'i' } }
          ]
        }
      ]
    }).sort({ createdAt: -1 }).lean();

    console.log(`Found: ${jobs.length}`);
    res.status(200).json(jobs);
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Filter jobs
exports.filterJobs = async (req, res) => {
  console.log("Filter jobs");
  try {
    const { location, type, minSalary, maxSalary } = req.query;
    const filter = { ...publicJobFilter };

    if (location) {
      filter.location = { $regex: location, $options: 'i' };
    }

    if (type) {
      filter.type = type;
    }

    if (minSalary || maxSalary) {
      filter.salary = {};
      if (minSalary) filter.salary.$gte = parseInt(minSalary);
      if (maxSalary) filter.salary.$lte = parseInt(maxSalary);
    }

    console.log("Criteria:", filter);

    const jobs = await Job.find(filter).sort({ createdAt: -1 }).lean();

    console.log(`Found: ${jobs.length}`);
    res.status(200).json(jobs);
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Sort jobs
exports.sortJobs = async (req, res) => {
  console.log("Sort jobs");
  try {
    const { sortBy, order } = req.query;
    const sortOrder = order?.toLowerCase() === 'desc' ? -1 : 1;

    let sortCriteria = { createdAt: -1 }; // Default

    if (sortBy) {
      sortCriteria = {};
      sortCriteria[sortBy] = sortOrder;
    }

    console.log(`Sort: ${Object.keys(sortCriteria)[0]}, ${sortOrder === 1 ? 'asc' : 'desc'}`);

    const jobs = await Job.find(publicJobFilter).sort(sortCriteria).lean();

    console.log(`Sorted: ${jobs.length}`);
    res.status(200).json(jobs);
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Add question
exports.addJobQuestion = async (req, res) => {
  console.log(`Add Q: ${req.params.jobId}`);
  try {
    const { jobId } = req.params;
    const { questionText, questionType, required, options, maxRating, order } = req.body;

    // Validate
    if (!questionText || !questionType) {
      console.log("Missing fields");
      return res.status(400).json({ message: "Question text and type are required" });
    }

    // Check type
    const validTypes = ["text", "multipleChoice", "checkbox", "file", "rating"];
    if (!validTypes.includes(questionType)) {
      console.log(`Invalid type: ${questionType}`);
      return res.status(400).json({
        message: "Invalid question type. Must be one of: text, multipleChoice, checkbox, file, rating"
      });
    }

    // Check options
    if ((questionType === "multipleChoice" || questionType === "checkbox") &&
      (!options || !Array.isArray(options) || options.length === 0)) {
      console.log("Options required");
      return res.status(400).json({
        message: "Options are required for multiple choice or checkbox questions"
      });
    }

    const job = await findJobByIdentifier(jobId);
    if (!job) {
      console.log(`Job not found: ${jobId}`);
      return res.status(404).json({ message: "Job not found" });
    }
    if (!isPubliclyVisible(job) && !canManageJob(req.user, job)) {
      return res.status(403).json({ message: "Access denied. This job is not published." });
    }

    // Create question
    const newQuestion = {
      questionText,
      questionType,
      required: required || false,
      options: options || [],
      maxRating: maxRating || 5,
      order: order || (job.questions.length > 0 ? Math.max(...job.questions.map(q => q.order)) + 1 : 0)
    };

    // Add to job
    job.questions.push(newQuestion);
    job.updatedAt = Date.now();

    await job.save();
    console.log(`Q added: ${jobId}`);

    res.status(201).json({
      message: "Question added successfully",
      job
    });
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update question
exports.updateJobQuestion = async (req, res) => {
  console.log(`Update Q: ${req.params.jobId}`);
  try {
    const { jobId } = req.params;
    const { questionId } = req.params;
    const { questionText, questionType, required, options, maxRating, order } = req.body;

    const job = await findJobByIdentifier(jobId);
    if (!job) {
      console.log(`Job not found: ${jobId}`);
      return res.status(404).json({ message: "Job not found" });
    }

    // Find question
    const questionIndex = job.questions.findIndex(q => q._id.toString() === questionId);
    if (questionIndex === -1) {
      console.log(`Q not found: ${questionId}`);
      return res.status(404).json({ message: "Question not found" });
    }

    // Update fields
    if (questionText) job.questions[questionIndex].questionText = questionText;
    if (questionType) job.questions[questionIndex].questionType = questionType;
    if (required !== undefined) job.questions[questionIndex].required = required;
    if (options) job.questions[questionIndex].options = options;
    if (maxRating) job.questions[questionIndex].maxRating = maxRating;
    if (order !== undefined) job.questions[questionIndex].order = order;

    job.updatedAt = Date.now();
    await job.save();
    console.log(`Q updated: ${jobId}`);

    res.status(200).json({
      message: "Question updated successfully",
      job
    });
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Delete question
exports.deleteJobQuestion = async (req, res) => {
  console.log(`Delete Q: ${req.params.jobId}`);
  try {
    const { jobId, questionId } = req.params;

    const job = await findJobByIdentifier(jobId);
    if (!job) {
      console.log(`Job not found: ${jobId}`);
      return res.status(404).json({ message: "Job not found" });
    }

    // Remove question
    const initialLength = job.questions.length;
    job.questions = job.questions.filter(q => q._id.toString() !== questionId);

    if (job.questions.length === initialLength) {
      console.log(`Q not found: ${questionId}`);
      return res.status(404).json({ message: "Question not found" });
    }

    job.updatedAt = Date.now();
    await job.save();
    console.log(`Q deleted: ${jobId}`);

    res.status(200).json({
      message: "Question deleted successfully",
      job
    });
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Reorder questions
exports.reorderJobQuestions = async (req, res) => {
  console.log(`Reorder Q: ${req.params.jobId}`);
  try {
    const { jobId } = req.params;
    const { questionOrder } = req.body;

    if (!questionOrder || !Array.isArray(questionOrder)) {
      console.log("Invalid order");
      return res.status(400).json({ message: "Question order must be an array of question IDs" });
    }

    const job = await findJobByIdentifier(jobId);
    if (!job) {
      console.log(`Job not found: ${jobId}`);
      return res.status(404).json({ message: "Job not found" });
    }

    // Map for lookup
    const questionsMap = {};
    job.questions.forEach(q => {
      questionsMap[q._id.toString()] = q;
    });

    // Reorder questions
    const reorderedQuestions = [];
    for (let i = 0; i < questionOrder.length; i++) {
      const qId = questionOrder[i];
      if (questionsMap[qId]) {
        const question = questionsMap[qId];
        question.order = i;
        reorderedQuestions.push(question);
        delete questionsMap[qId];
      }
    }

    // Add remaining
    Object.values(questionsMap).forEach(q => {
      reorderedQuestions.push(q);
    });

    job.questions = reorderedQuestions;
    job.updatedAt = Date.now();
    await job.save();
    console.log(`Q reordered: ${jobId}`);

    res.status(200).json({
      message: "Questions reordered successfully",
      job
    });
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get questions
exports.getJobQuestions = async (req, res) => {
  console.log(`Get Q: ${req.params.jobId}`);
  try {
    const { jobId } = req.params;

    const job = await findJobByIdentifier(jobId);
    if (!job) {
      console.log(`Job not found: ${jobId}`);
      return res.status(404).json({ message: "Job not found" });
    }
    if (!isPubliclyVisible(job) && !canManageJob(req.user, job)) {
      return res.status(403).json({ message: "Access denied. This job is not published." });
    }

    // Sort by order
    const sortedQuestions = [...job.questions].sort((a, b) => a.order - b.order);

    console.log(`Found: ${sortedQuestions.length}`);
    res.status(200).json(sortedQuestions);
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};