const templates = require('../utils/emailTemplates');
const { sendMail } = require('../config/emailTransporter');
require('dotenv').config();

const transporter = {
  sendMail: (options) => sendMail(options)
};

console.log("Email service initialized with centralized emailTransporter and templates");

exports.sendOfferLetter = async (application, jobDetails, offerLetterPdf, acceptanceLink, validUntil, hrContact) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: application.email,
      replyTo: process.env.REPLY_TO_EMAIL || process.env.EMAIL_USER,
      subject: `Offer Letter for ${jobDetails.title}`,
      html: templates.getOfferLetterTemplate(application.name, jobDetails.title, acceptanceLink, validUntil, hrContact),
      attachments: [{
        filename: 'offer_letter.pdf',
        content: offerLetterPdf,
        contentType: 'application/pdf'
      }]
    };
    
    return await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Send offer letter failed:', error);
    throw error;
  }
};

exports.sendWelcomeEmail = async (candidateDetails) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: candidateDetails.email,
      replyTo: process.env.REPLY_TO_EMAIL || process.env.EMAIL_USER,
      subject: 'Welcome to FMPG!',
      html: templates.getWelcomeTemplate(candidateDetails.name)
    };
    
    return await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Send welcome email failed:', error);
    throw error;
  }
};

exports.sendApplicationConfirmation = async (applicantDetails, jobTitle) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: applicantDetails.email,
      replyTo: process.env.REPLY_TO_EMAIL || process.env.EMAIL_USER,
      subject: `Application Received for ${jobTitle}`,
      html: templates.getApplicationConfirmationTemplate(applicantDetails.fullName, jobTitle)
    };
    
    return await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Send application confirmation failed:', error);
    throw error;
  }
};

exports.sendContractStatusUpdate = async (contractDetails, adminComments) => {
  try {
    const statusMessages = {
      'Under_Review': {
        subject: 'Contract Under Review',
        message: 'Your employment contract is currently under review by our HR team. We will notify you once the review is complete.'
      },
      'Approved': {
        subject: 'Contract Approved - Welcome to FMPG!',
        message: 'Congratulations! Your employment contract has been approved. Welcome to the FMPG team! Our HR team will contact you soon with your next steps and onboarding information.'
      },
      'Rejected': {
        subject: 'Contract Review Update',
        message: 'After reviewing your contract, we need to discuss some details with you. Please contact our HR team for further information.'
      },
      'Requires_Clarification': {
        subject: 'Contract Requires Clarification',
        message: 'We need some additional information or clarification regarding your employment contract. Please review the comments below and contact our HR team.'
      }
    };

    const statusInfo = statusMessages[contractDetails.status] || {
      subject: 'Contract Status Update',
      message: 'There has been an update to your employment contract status.'
    };

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: contractDetails.email,
      replyTo: process.env.REPLY_TO_EMAIL || process.env.EMAIL_USER,
      subject: statusInfo.subject,
      html: templates.getContractStatusTemplate(
        contractDetails.candidateName,
        contractDetails.position,
        contractDetails.status,
        statusInfo.message,
        adminComments
      )
    };
    
    return await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Failed to send contract status email:', error);
    throw error;
  }
};

exports.sendContractSubmissionConfirmation = async (contractDetails) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: contractDetails.email,
      replyTo: process.env.REPLY_TO_EMAIL || process.env.EMAIL_USER,
      subject: 'Contract Submitted Successfully',
      html: templates.getContractSubmissionTemplate(contractDetails.candidateName, contractDetails.position)
    };
    
    return await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Failed to send contract submission confirmation:', error);
    throw error;
  }
};

exports.sendEmailVerificationOTP = async (email, otp, name) => {
  console.log(`\n==============================================`);
  console.log(`[OTP DISPATCH] Recipient: ${email} | Code: ${otp}`);
  console.log(`==============================================\n`);
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      replyTo: process.env.REPLY_TO_EMAIL || process.env.EMAIL_USER,
      subject: 'Email Verification - FMPG',
      html: templates.getOTPTemplate(name, otp, 'Email Verification')
    };
    
    return await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Failed to send verification OTP:', error.message || error);
    throw error;
  }
};

exports.sendPasswordResetOTP = async (email, otp, name) => {
  console.log(`\n==============================================`);
  console.log(`[RESET OTP DISPATCH] Recipient: ${email} | Code: ${otp}`);
  console.log(`==============================================\n`);
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      replyTo: process.env.REPLY_TO_EMAIL || process.env.EMAIL_USER,
      subject: 'Password Reset - FMPG',
      html: templates.getOTPTemplate(name, otp, 'Password Reset Request')
    };
    
    return await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Failed to send password reset OTP:', error.message || error);
    throw error;
  }
};

exports.sendTerminationEmail = async ({ email, name, reason }) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      replyTo: process.env.REPLY_TO_EMAIL || process.env.EMAIL_USER,
      subject: 'Employment Status Update - FMPG',
      html: templates.getTerminationTemplate(name, reason)
    };

    return await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Failed to send termination email:', error);
    throw error;
  }
};

exports.sendBulkEmployeeWelcome = async (employeeDetails, tempPassword) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: employeeDetails.email,
      replyTo: process.env.REPLY_TO_EMAIL || process.env.EMAIL_USER,
      subject: 'Welcome to FMPG - Your Account Credentials',
      html: templates.getBulkWelcomeTemplate(
        employeeDetails.name,
        employeeDetails.email,
        tempPassword,
        employeeDetails.role
      )
    };

    return await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Failed to send bulk welcome email:', error);
    throw error;
  }
};