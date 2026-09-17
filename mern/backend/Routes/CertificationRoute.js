const express = require("express");
const router = express.Router();
const CertificationController = require("../Controllers/CertificateController");
const OfferLetterController = require("../Controllers/OfferLetterController");
const { auth, hasPermission, isHR, verifySuperAdmin } = require("../middleware/authMiddleware");

// Certificate routes
router.post("/issue", auth, hasPermission('canGenerateCertificate'), CertificationController.issue);
router.get("/verify/:id", CertificationController.verifyCertificate);
router.get("/", auth, isHR, CertificationController.getAllCertificates);
router.get("/download/:id", CertificationController.downloadCertificate);
router.post("/:id/send-email", auth, hasPermission('canGenerateCertificate'), CertificationController.sendCertificateEmail);
router.delete("/:id", auth, verifySuperAdmin, CertificationController.deleteCertificate);

const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

// Offer Letter routes (keeping the existing issue-offer route and adding new ones)
router.post("/issue-offer", auth, hasPermission('canGenerateOfferLetter'), OfferLetterController.issueOfferLetter);
router.post("/bulk-issue-offer", auth, hasPermission('canGenerateOfferLetter'), upload.single('file'), OfferLetterController.bulkIssueOfferLetters);
router.get("/bulk-sample-csv", auth, hasPermission('canGenerateOfferLetter'), OfferLetterController.downloadOfferSampleCSV);
router.get("/offer-letters", auth, isHR, OfferLetterController.getAllOfferLetters);
router.get("/verify-offer/:id", OfferLetterController.verifyOfferLetter);
router.get("/offer-letters/:id", auth, isHR, OfferLetterController.getOfferLetterById);
router.patch("/offer-letters/:id/status", auth, isHR, OfferLetterController.updateOfferLetterStatus);
router.patch("/offer-letters/:id/extend", auth, hasPermission('canGenerateOfferLetter'), OfferLetterController.extendOfferLetter);
router.get("/offer-letters/:id/download", auth, OfferLetterController.downloadOfferLetter);
router.post("/offer-letters/:id/send-email", auth, hasPermission('canGenerateOfferLetter'), OfferLetterController.sendOfferLetterEmail);
router.post("/offer-letters/:id/regenerate-token", auth, hasPermission('canGenerateOfferLetter'), OfferLetterController.regenerateAcceptanceToken);
router.post("/offer-letters/add-tokens", auth, hasPermission('canGenerateOfferLetter'), OfferLetterController.addAcceptanceTokensToExisting);
router.delete("/offer-letters/:id", auth, verifySuperAdmin, OfferLetterController.deleteOfferLetter);

module.exports = router;
