const nodemailer = require("nodemailer");
require("dotenv").config();

const parseBoolean = (value, fallback = false) => {
  if (typeof value !== "string") return fallback;
  return ["true", "1", "yes"].includes(value.trim().toLowerCase());
};

const getEmailCredentials = () => {
  const user = (
    process.env.EMAIL_USER ||
    process.env.MAIL_USER ||
    process.env.SMTP_USER ||
    ""
  ).trim();

  let rawPassword =
    process.env.EMAIL_PASS || process.env.MAIL_PASS || process.env.SMTP_PASS || "";

  // Strip surrounding quotes if present
  rawPassword = rawPassword.replace(/^["']|["']$/g, "").trim();

  const isGmailUser = /@gmail\.com$/i.test(user) || process.env.MAIL_SERVICE === "gmail";
  const pass = isGmailUser
    ? rawPassword.replace(/\s+/g, "").trim()
    : rawPassword.trim();

  return { user, pass };
};

const createTransporter = () => {
  const { user, pass } = getEmailCredentials();

  const mailHost = process.env.MAIL_HOST || process.env.SMTP_HOST;
  const mailPort = Number(process.env.MAIL_PORT || process.env.SMTP_PORT || 587);
  const mailSecure = parseBoolean(process.env.MAIL_SECURE || process.env.SMTP_SECURE, mailPort === 465);
  const mailService = process.env.MAIL_SERVICE;

  // Socket and connection timeouts to prevent hanging on cloud/production environments
  const timeoutOptions = {
    connectionTimeout: 12000, // 12 seconds max to connect
    greetingTimeout: 8000,    // 8 seconds max for greeting
    socketTimeout: 25000,     // 25 seconds max for inactivity
    pool: true,               // Connection pooling to keep socket warm
    maxConnections: 3,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: 5,
  };

  if (mailHost) {
    return nodemailer.createTransport({
      host: mailHost,
      port: mailPort,
      secure: mailSecure,
      auth: { user, pass },
      tls: {
        rejectUnauthorized: false
      },
      ...timeoutOptions
    });
  }

  // If custom service specified (e.g. sendgrid, mailgun)
  if (mailService && mailService.toLowerCase() !== "gmail") {
    return nodemailer.createTransport({
      service: mailService,
      auth: { user, pass },
      ...timeoutOptions
    });
  }

  // Default to smtp.gmail.com with port 587 (STARTTLS) or 465 based on configuration
  // Port 587 is universally open on cloud hosting (Vercel, AWS, GCP) unlike 465
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: mailPort || 587,
    secure: mailSecure,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: false
    },
    ...timeoutOptions
  });
};

const buildMailAuthError = (error) => {
  if (error?.code !== "EAUTH" && error?.responseCode !== 535) {
    return error;
  }

  const wrappedError = new Error(
    "Gmail SMTP Authentication Failed (535 Bad Credentials). Ensure 2-Step Verification is active on Google and generate a new 16-character App Password at https://myaccount.google.com/apppasswords."
  );

  wrappedError.code = error.code || "EAUTH";
  wrappedError.responseCode = error.responseCode || 535;
  wrappedError.command = error.command;
  wrappedError.cause = error;

  return wrappedError;
};

let cachedTransporter = null;
let lastUser = null;
let lastPass = null;

const getTransporter = () => {
  const { user, pass } = getEmailCredentials();
  if (!cachedTransporter || user !== lastUser || pass !== lastPass) {
    cachedTransporter = createTransporter();
    lastUser = user;
    lastPass = pass;
  }
  return cachedTransporter;
};

const sendMail = async (mailOptions) => {
  const { user, pass } = getEmailCredentials();
  if (!user || !pass) {
    console.warn("⚠️ No email credentials configured (EMAIL_USER or EMAIL_PASS missing). Skipping email dispatch.");
    return { skipped: true, message: "Email credentials not configured" };
  }

  const transporter = getTransporter();
  try {
    if (!mailOptions.replyTo) {
      mailOptions.replyTo = process.env.REPLY_TO_EMAIL || user;
    }
    if (!mailOptions.from) {
      mailOptions.from = user;
    }

    // Safety timeout: 25 seconds max so email dispatch can never hang an HTTP request indefinitely
    const emailPromise = transporter.sendMail(mailOptions);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Email dispatch timed out after 25 seconds")), 25000)
    );

    return await Promise.race([emailPromise, timeoutPromise]);
  } catch (error) {
    console.error("sendMail error:", error.message || error);
    // If connection was dropped or socket timed out, reset cached transporter so next call gets a clean connection
    if (error?.code === "ETIMEDOUT" || error?.code === "ESOCKET" || error?.code === "ECONNRESET") {
      cachedTransporter = null;
    }
    throw buildMailAuthError(error);
  }
};

const verifyEmailTransport = async () => {
  try {
    const transporter = getTransporter();
    await transporter.verify();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: buildMailAuthError(error) };
  }
};

module.exports = {
  createTransporter,
  getTransporter,
  sendMail,
  verifyEmailTransport,
  buildMailAuthError,
  getEmailCredentials,
};