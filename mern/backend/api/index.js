const express = require("express");
const cors = require("cors");
const logger = require("../utils/logger");
const path = require("path");
const compression = require("compression");
require("dotenv").config();
const connectDB = require("../config/database");
const { validateConfig, authConfig } = require("../config/authConfig");
const authRoutes = require("../Routes/authRoute");
const certificationRoutes = require("../Routes/CertificationRoute");
const jobRoutes = require("../Routes/jobRoutes");
const applicationRoutes = require("../Routes/applicationRoutes");
const reviewRoutes = require("../Routes/reviewRoutes");
const userRoutes = require("../Routes/userRoutes");
const recommendationRoutes = require("../Routes/recommendationRoutes");
const contractRoutes = require("../Routes/contractRoutes");
const notificationRoutes = require("../Routes/notificationRoutes");
const hrRoutes = require("../Routes/hrRoutes");
const auditRoutes = require("../Routes/auditRoutes");
const sitemapRoutes = require("../Routes/sitemapRoutes");
const hrmsRoutes = require("../Routes/hrmsRoutes");

logger.info("Starting API server...");

validateConfig();

// --- PRODUCTION READINESS: MANUAL SECURITY & RELIABILITY ---

// 1. Basic Rate Limiter (Manual Implementation)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 100; // 100 requests per window

const basicRateLimiter = (req, res, next) => {
  if (process.env.NODE_ENV === 'development') return next();
  
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const now = Date.now();
  
  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, { count: 1, firstRequest: now });
    return next();
  }
  
  const userData = rateLimitMap.get(ip);
  if (now - userData.firstRequest > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { count: 1, firstRequest: now });
    return next();
  }
  
  userData.count += 1;
  if (userData.count > MAX_REQUESTS) {
    return res.status(429).json({ message: "Too many requests, please try again later." });
  }
  
  next();
};

// 2. Manual Security Headers (Helmet alternative)
const securityHeaders = (req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.setHeader("Content-Security-Policy", "default-src 'self'");
  next();
};
const app = express();
app.use(compression());
logger.info("Init Express app");
const isVercel = process.env.VERCEL === "1";
let dbConnectionPromise = null;

const ensureDbConnection = async () => {
  if (!dbConnectionPromise) {
    dbConnectionPromise = connectDB().catch((error) => {
      dbConnectionPromise = null;
      throw error;
    });
  }

  await dbConnectionPromise;
};

// Configure CORS to allow specific origins in production
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5175',
  process.env.FRONTEND_URL,
  'https://career-fmpg.vercel.app',
  'https://fmpg.vercel.app'
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin || isVercel) return callback(null, true);
    try {
      const hostname = new URL(origin).hostname;
      if (
        allowedOrigins.includes(origin) ||
        process.env.NODE_ENV === 'development' ||
        hostname.endsWith('.vercel.app')
      ) {
        return callback(null, true);
      }
    } catch {
      // Ignore URL parsing errors for non-standard origins
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  optionsSuccessStatus: 200
};

app.use(securityHeaders);
app.use(basicRateLimiter);

app.use(cors(corsOptions));
logger.info("CORS enabled with options");
app.use(express.json());
logger.info("JSON parser enabled");

app.use(async (req, res, next) => {
  try {
    await ensureDbConnection();
    next();
  } catch (error) {
    logger.error("Database connection failed", error);
    res.status(500).json({ message: "Database connection failed" });
  }
});

logger.info("Static serving: /uploads (disabled for serverless compatibility)");


app.get("/", (req, res) => {
  logger.info("Root accessed");
  res.send("Welcome to the FMPG API!");
});
app.get("/api", (req, res) => {
  res.status(200).json({ message: "Welcome to the FMPG API!" });
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    message: "Server is running"
  });
});
app.use("/api/auth", authRoutes);
app.use("/api/certification", certificationRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/users", userRoutes);
app.use("/api/recommendations", recommendationRoutes);
app.use("/api/contracts", contractRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/hr", hrRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/employees", hrmsRoutes.employees);
app.use("/api/departments", hrmsRoutes.departments);
app.use("/api/designations", hrmsRoutes.designations);
app.use("/api/interviews", hrmsRoutes.interviews);
app.use("/api/attendance", hrmsRoutes.attendance);
app.use("/api/leaves", hrmsRoutes.leaves);
app.use("/api/payroll", hrmsRoutes.payroll);
app.use("/api/payslips", hrmsRoutes.payslips);
app.use("/api/documents", hrmsRoutes.documents);
app.use("/api/resignations", hrmsRoutes.resignations);
app.use("/api/terminations", hrmsRoutes.terminations);
app.use("/api/exits", hrmsRoutes.exits);
app.use("/api/assets", hrmsRoutes.assets);
app.use("/api/verify", hrmsRoutes.verify);

// Sitemap Route (accessible at /api/sitemap.xml)
app.use("/api", sitemapRoutes);

// --- GLOBAL ERROR HANDLER ---
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  logger.error(`${req.method} ${req.url}`, err);
  
  res.status(statusCode).json({
    status: 'error',
    message: statusCode === 500 ? 'Internal Server Error' : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

const PORT = authConfig.port;

if (!isVercel) {
  app.listen(PORT, "0.0.0.0", () => {
    logger.info(`✅ Server running: http://localhost:${PORT}`);
  });

  ensureDbConnection().catch((err) => {
    logger.error("Background database connection failed", err);
  });
}

module.exports = app;
