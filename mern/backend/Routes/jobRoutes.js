const express = require("express");
const router = express.Router();
const jobController = require("../Controllers/jobController");
const { auth, optionalAuth, isHR, hasPermission, checkJobAssignment, verifySuperAdmin } = require("../middleware/authMiddleware");
const multer = require("multer");
const path = require("path");
const { uploadImage, deleteImage, extractPublicId } = require('../config/cloudinary');


// Configure multer for job image uploads (memory storage for Cloudinary)
const jobImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB file size limit
  },
  fileFilter: function (req, file, cb) {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Public routes
router.get("/featured", jobController.getFeaturedJobs); // Add this route for featured jobs
router.get("/search", jobController.searchJobs);
router.get("/filter", jobController.filterJobs);
router.get("/sort", jobController.sortJobs);
router.get("/", optionalAuth, jobController.getJobs);
router.get("/:id", optionalAuth, jobController.getJobById);
router.get("/:jobId/questions", optionalAuth, jobController.getJobQuestions);

// Admin/HR routes
router.post("/", auth, hasPermission('canCreateJob'), hasPermission('canManageJobs'), jobImageUpload.single('image'), jobController.createJob);
router.put("/:id", auth, isHR, hasPermission('canManageJobs'), checkJobAssignment, jobImageUpload.single('image'), jobController.updateJob);
router.delete("/:id", auth, verifySuperAdmin, jobController.deleteJob);

// Admin/HR routes for question management
router.post("/:jobId/questions", auth, isHR, hasPermission('canManageJobs'), checkJobAssignment, jobController.addJobQuestion);
router.put("/:jobId/questions/:questionId", auth, isHR, hasPermission('canManageJobs'), checkJobAssignment, jobController.updateJobQuestion);
router.delete("/:jobId/questions/:questionId", auth, isHR, hasPermission('canManageJobs'), checkJobAssignment, jobController.deleteJobQuestion);
router.put("/:jobId/questions-reorder", auth, isHR, hasPermission('canManageJobs'), checkJobAssignment, jobController.reorderJobQuestions);

module.exports = router;