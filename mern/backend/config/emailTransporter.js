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

  if (mailHost) {
    return nodemailer.createTransport({
      host: mailHost,
      port: mailPort,
      secure: mailSecure,
      auth: { user, pass },
    });
  }

  return nodemailer.createTransport({
    service: mailService || "gmail",
    auth: { user, pass },
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
  const transporter = getTransporter();
  try {
    if (!mailOptions.replyTo) {
      mailOptions.replyTo = process.env.REPLY_TO_EMAIL || process.env.EMAIL_USER;
    }
    if (!mailOptions.from) {
      mailOptions.from = process.env.EMAIL_USER;
    }
    return await transporter.sendMail(mailOptions);
  } catch (error) {
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