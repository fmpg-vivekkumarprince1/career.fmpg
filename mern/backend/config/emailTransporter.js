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

const sendMailViaResend = async (mailOptions, apiKey) => {
  const to = Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to];
  const from = process.env.RESEND_FROM || (process.env.EMAIL_USER ? `FMPG Careers <${process.env.EMAIL_USER}>` : "FMPG Careers <contact@fmpg.in>");
  const replyTo = mailOptions.replyTo || process.env.REPLY_TO_EMAIL || "fmpg974@gmail.com";

  const payload = {
    from,
    to,
    subject: mailOptions.subject,
    html: mailOptions.html || mailOptions.text
  };

  if (replyTo) {
    payload.reply_to = replyTo;
  }

  if (mailOptions.attachments && mailOptions.attachments.length > 0) {
    const fs = require("fs");
    payload.attachments = mailOptions.attachments.map((att) => {
      let content = att.content;
      if (!content && att.path) {
        try {
          content = fs.readFileSync(att.path).toString("base64");
        } catch (e) {
          console.error("Failed to read attachment from path:", att.path, e);
        }
      } else if (Buffer.isBuffer(content)) {
        content = content.toString("base64");
      } else if (typeof content === "string") {
        content = Buffer.from(content).toString("base64");
      }
      return {
        filename: att.filename,
        content
      };
    });
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey.trim()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Resend Email API error: ${data.message || JSON.stringify(data)}`);
  }

  return { messageId: data.id, provider: "resend" };
};

const sendMailViaBrevo = async (mailOptions, apiKey) => {
  const to = Array.isArray(mailOptions.to)
    ? mailOptions.to.map(email => ({ email }))
    : [{ email: mailOptions.to }];
  const sender = {
    email: process.env.BREVO_FROM || process.env.EMAIL_USER || "careers@fmpg.in",
    name: "FMPG Careers"
  };
  const replyTo = {
    email: mailOptions.replyTo || process.env.REPLY_TO_EMAIL || process.env.EMAIL_USER || "careers@fmpg.in"
  };

  const payload = {
    sender,
    to,
    replyTo,
    subject: mailOptions.subject,
    htmlContent: mailOptions.html || mailOptions.text
  };

  if (mailOptions.attachments && mailOptions.attachments.length > 0) {
    payload.attachment = mailOptions.attachments.map((att) => {
      let content = att.content;
      if (Buffer.isBuffer(content)) {
        content = content.toString("base64");
      } else if (typeof content === "string") {
        content = Buffer.from(content).toString("base64");
      }
      return {
        name: att.filename,
        content
      };
    });
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey.trim(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Brevo Email API error: ${data.message || JSON.stringify(data)}`);
  }

  return { messageId: data.messageId, provider: "brevo" };
};

const sendMail = async (mailOptions) => {
  // 1. High priority: Check for HTTP Email APIs (Resend / Brevo) which work reliably in serverless environments (Vercel)
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    console.log("Dispatching email via Resend HTTP API (port 443)...");
    return await sendMailViaResend(mailOptions, resendApiKey);
  }

  const brevoApiKey = process.env.BREVO_API_KEY;
  if (brevoApiKey) {
    console.log("Dispatching email via Brevo HTTP API (port 443)...");
    return await sendMailViaBrevo(mailOptions, brevoApiKey);
  }

  // 2. Standard SMTP fallback (requires open outbound SMTP ports)
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
    console.error("sendMail SMTP error:", error.message || error);
    // If connection was dropped or socket timed out, reset cached transporter so next call gets a clean connection
    if (error?.code === "ETIMEDOUT" || error?.code === "ESOCKET" || error?.code === "ECONNRESET") {
      cachedTransporter = null;
    }

    const isBlockedOrTimeout =
      error?.code === "ETIMEDOUT" ||
      error?.code === "ESOCKET" ||
      error?.code === "ECONNRESET" ||
      error?.code === "ECONNREFUSED" ||
      (error?.message && error.message.toLowerCase().includes("timeout"));

    if (isBlockedOrTimeout) {
      const errorMsg =
        "Email delivery failed: Outbound SMTP connection timed out or was refused. " +
        "When deploying on Vercel or cloud environments, consider adding RESEND_API_KEY (free at https://resend.com) " +
        "or BREVO_API_KEY for HTTP-based email delivery over port 443.";
      const helpfulError = new Error(errorMsg);
      helpfulError.code = "SMTP_PORTS_BLOCKED";
      throw helpfulError;
    }

    throw buildMailAuthError(error);
  }
};

const verifyEmailTransport = async () => {
  if (process.env.RESEND_API_KEY) {
    return { ok: true, provider: "resend" };
  }
  if (process.env.BREVO_API_KEY) {
    return { ok: true, provider: "brevo" };
  }
  try {
    const transporter = getTransporter();
    await transporter.verify();
    return { ok: true, provider: "smtp" };
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