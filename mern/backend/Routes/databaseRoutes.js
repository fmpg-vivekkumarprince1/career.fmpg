const express = require("express");
const router = express.Router();
const databaseController = require("../Controllers/databaseController");
const { auth, verifySuperAdmin } = require("../middleware/authMiddleware");

// All database studio routes require super-admin authentication
router.use(auth, verifySuperAdmin);

// Collection operations
router.get("/collections", databaseController.getCollections);

// Document CRUD operations for a specific collection
router.get("/collections/:collectionName/documents", databaseController.getDocuments);
router.get("/collections/:collectionName/documents/:id", databaseController.getDocumentById);
router.post("/collections/:collectionName/documents", databaseController.createDocument);
router.put("/collections/:collectionName/documents/:id", databaseController.updateDocument);
router.delete("/collections/:collectionName/documents/:id", databaseController.deleteDocument);

// Advanced Query Runner
router.post("/execute-query", databaseController.executeQuery);

module.exports = router;
