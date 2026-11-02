const mongoose = require("mongoose");
const auditService = require("../services/auditService");

/**
 * Helper to match an ID whether stored as MongoDB ObjectId or String
 */
const resolveIdQuery = async (col, id) => {
  if (mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === String(id)) {
    const objId = new mongoose.Types.ObjectId(id);
    const exists = await col.findOne({ _id: objId });
    if (exists) return { _id: objId };
  }
  return { _id: id };
};

/**
 * Get all collections with document counts and basic stats
 */
exports.getCollections = async (req, res) => {
  try {
    const db = mongoose.connection.db;
    if (!db) {
      return res.status(500).json({ message: "Database connection not ready" });
    }

    const rawCollections = await db.listCollections().toArray();
    const filtered = rawCollections.filter(c => !c.name.startsWith("system."));

    const collectionsWithStats = await Promise.all(
      filtered.map(async (c) => {
        try {
          const col = db.collection(c.name);
          const count = await col.estimatedDocumentCount().catch(() => col.countDocuments({}));
          return {
            name: c.name,
            type: c.type || "collection",
            count
          };
        } catch {
          return {
            name: c.name,
            type: c.type || "collection",
            count: 0
          };
        }
      })
    );

    collectionsWithStats.sort((a, b) => a.name.localeCompare(b.name));

    // Calculate total documents across all collections
    const totalDocs = collectionsWithStats.reduce((acc, curr) => acc + (curr.count || 0), 0);

    res.status(200).json({
      databaseName: db.databaseName,
      totalCollections: collectionsWithStats.length,
      totalDocuments: totalDocs,
      collections: collectionsWithStats
    });
  } catch (error) {
    console.error("Database Studio - Error listing collections:", error);
    res.status(500).json({ message: "Failed to list collections", error: error.message });
  }
};

/**
 * Get paginated documents for a specific collection with search and JSON filter
 */
exports.getDocuments = async (req, res) => {
  try {
    const { collectionName } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const search = (req.query.search || "").trim();
    const sortField = req.query.sortField || "_id";
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

    let filter = {};
    if (req.query.filter) {
      try {
        filter = typeof req.query.filter === "string" ? JSON.parse(req.query.filter) : req.query.filter;
      } catch (e) {
        return res.status(400).json({ message: `Invalid JSON filter: ${e.message}` });
      }
    }

    const db = mongoose.connection.db;
    const col = db.collection(collectionName);

    // Handle search query
    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      
      // Sample a document to inspect string field keys
      const sample = await col.findOne({});
      const candidateKeys = sample
        ? Object.keys(sample).filter(k => typeof sample[k] === "string" || k === "_id")
        : ["name", "email", "title", "role", "status", "slug", "code"];

      const orClauses = [];

      for (const key of candidateKeys) {
        if (key === "_id") {
          if (mongoose.Types.ObjectId.isValid(search) && String(new mongoose.Types.ObjectId(search)) === search) {
            orClauses.push({ _id: new mongoose.Types.ObjectId(search) });
          } else {
            orClauses.push({ _id: search });
          }
        } else {
          orClauses.push({ [key]: { $regex: searchRegex } });
        }
      }

      if (orClauses.length > 0) {
        if (Object.keys(filter).length > 0) {
          filter = { $and: [filter, { $or: orClauses }] };
        } else {
          filter = { $or: orClauses };
        }
      }
    }

    const total = await col.countDocuments(filter);
    const documents = await col
      .find(filter)
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(limit)
      .toArray();

    res.status(200).json({
      collection: collectionName,
      documents,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error("Database Studio - Error fetching documents:", error);
    res.status(500).json({ message: "Failed to fetch documents", error: error.message });
  }
};

/**
 * Get a single document by ID
 */
exports.getDocumentById = async (req, res) => {
  try {
    const { collectionName, id } = req.params;
    const db = mongoose.connection.db;
    const col = db.collection(collectionName);

    const idQuery = await resolveIdQuery(col, id);
    const document = await col.findOne(idQuery);

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    res.status(200).json({ collection: collectionName, document });
  } catch (error) {
    console.error("Database Studio - Error fetching document:", error);
    res.status(500).json({ message: "Failed to fetch document", error: error.message });
  }
};

/**
 * Create / Insert a new document into collection
 */
exports.createDocument = async (req, res) => {
  try {
    const { collectionName } = req.params;
    let doc = req.body.document;

    if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
      return res.status(400).json({ message: "Document data must be an object" });
    }

    // Handle _id if specified
    if (doc._id) {
      if (typeof doc._id === "string" && mongoose.Types.ObjectId.isValid(doc._id)) {
        doc._id = new mongoose.Types.ObjectId(doc._id);
      }
    } else {
      delete doc._id;
    }

    // Auto-add createdAt / updatedAt if standard
    if (!doc.createdAt) {
      doc.createdAt = new Date();
    }
    if (!doc.updatedAt) {
      doc.updatedAt = new Date();
    }

    const db = mongoose.connection.db;
    const col = db.collection(collectionName);
    const result = await col.insertOne(doc);

    // Audit Log
    await auditService.logAudit({
      req,
      action: "CREATE",
      resourceEntity: collectionName,
      resourceId: result.insertedId,
      changes: { new: doc }
    });

    res.status(201).json({
      message: "Document created successfully",
      insertedId: result.insertedId,
      document: { ...doc, _id: result.insertedId }
    });
  } catch (error) {
    console.error("Database Studio - Error creating document:", error);
    res.status(500).json({ message: "Failed to create document", error: error.message });
  }
};

/**
 * Update an existing document by ID
 */
exports.updateDocument = async (req, res) => {
  try {
    const { collectionName, id } = req.params;
    let doc = req.body.document;

    if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
      return res.status(400).json({ message: "Updated document data must be an object" });
    }

    const db = mongoose.connection.db;
    const col = db.collection(collectionName);

    const idQuery = await resolveIdQuery(col, id);
    const oldDoc = await col.findOne(idQuery);

    if (!oldDoc) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Avoid updating immutable _id
    const updatePayload = { ...doc };
    delete updatePayload._id;
    updatePayload.updatedAt = new Date();

    const replaceMode = req.body.replace === true;
    if (replaceMode) {
      await col.replaceOne(idQuery, updatePayload);
    } else {
      await col.updateOne(idQuery, { $set: updatePayload });
    }

    const updatedDoc = await col.findOne(idQuery);

    // Audit Log
    await auditService.logAudit({
      req,
      action: "UPDATE",
      resourceEntity: collectionName,
      resourceId: oldDoc._id,
      changes: { old: oldDoc, new: updatedDoc }
    });

    res.status(200).json({
      message: "Document updated successfully",
      document: updatedDoc
    });
  } catch (error) {
    console.error("Database Studio - Error updating document:", error);
    res.status(500).json({ message: "Failed to update document", error: error.message });
  }
};

/**
 * Delete a document by ID
 */
exports.deleteDocument = async (req, res) => {
  try {
    const { collectionName, id } = req.params;
    const db = mongoose.connection.db;
    const col = db.collection(collectionName);

    const idQuery = await resolveIdQuery(col, id);
    const oldDoc = await col.findOne(idQuery);

    if (!oldDoc) {
      return res.status(404).json({ message: "Document not found" });
    }

    await col.deleteOne(idQuery);

    // Audit Log
    await auditService.logAudit({
      req,
      action: "DELETE",
      resourceEntity: collectionName,
      resourceId: oldDoc._id,
      changes: { deleted: oldDoc }
    });

    res.status(200).json({
      message: "Document deleted successfully",
      deletedId: id
    });
  } catch (error) {
    console.error("Database Studio - Error deleting document:", error);
    res.status(500).json({ message: "Failed to delete document", error: error.message });
  }
};

/**
 * Execute raw Mongo query (find, count, aggregate)
 */
exports.executeQuery = async (req, res) => {
  try {
    const { collectionName, operation, query = {}, options = {} } = req.body;

    if (!collectionName) {
      return res.status(400).json({ message: "Collection name is required" });
    }

    const db = mongoose.connection.db;
    const col = db.collection(collectionName);

    const startTime = Date.now();
    let result = null;

    switch (operation) {
      case "find": {
        const limit = Math.min(100, options.limit || 50);
        const skip = options.skip || 0;
        const sort = options.sort || { _id: -1 };
        result = await col.find(query).sort(sort).skip(skip).limit(limit).toArray();
        break;
      }
      case "count": {
        result = await col.countDocuments(query);
        break;
      }
      case "aggregate": {
        if (!Array.isArray(query)) {
          return res.status(400).json({ message: "Aggregate pipeline must be an array of stages" });
        }
        result = await col.aggregate(query).toArray();
        break;
      }
      case "distinct": {
        if (!options.field) {
          return res.status(400).json({ message: "Field name is required for distinct operation" });
        }
        result = await col.distinct(options.field, query);
        break;
      }
      default:
        return res.status(400).json({ message: `Unsupported operation: ${operation}. Allowed: find, count, aggregate, distinct` });
    }

    const executionTimeMs = Date.now() - startTime;

    res.status(200).json({
      collection: collectionName,
      operation,
      executionTimeMs,
      resultCount: Array.isArray(result) ? result.length : 1,
      result
    });
  } catch (error) {
    console.error("Database Studio - Error running query:", error);
    res.status(500).json({ message: "Query execution failed", error: error.message });
  }
};
