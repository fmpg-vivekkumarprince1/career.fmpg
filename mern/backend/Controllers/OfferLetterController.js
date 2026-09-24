const { logAudit } = require('../services/auditService');
const { getOfferLetterTemplate, getExtendedOfferTemplate } = require("../utils/emailTemplates");
const OfferLetter = require("../models/offerLetter");
const User = require("../models/user");
const { issueOfferLetterSchema, extendOfferLetterSchema } = require("../Validators/OfferLetterValidator");
const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");
const PDFDocument = require("pdfkit");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const { formatCurrencyValue } = require("../utils/currencyFormatter");
const csv = require('csv-parser');
const { Readable } = require('stream');
const mongoose = require('mongoose');

// Pre-load assets into memory to avoid repetitive I/O
let cachedLogo = null;
try {
    const logoPath = path.join(__dirname, '..', 'assets', 'logo_dryukr.png');
    if (fs.existsSync(logoPath)) {
        cachedLogo = fs.readFileSync(logoPath);
        console.log("✅ PDF Logo pre-loaded into memory");
    }
} catch (err) {
    console.error("❌ Failed to pre-load PDF logo:", err.message);
}

function normalizeOfferLetterLookupId(rawId = "") {
    // Cleans prefixes like FMPG-OFF-, FMPG-, OM-OFF-, OM-
    return String(rawId).trim().replace(/^(FMPG-OFF-|FMPG-|OM-OFF-|OM-)/i, "");
}

async function findOfferLetterByIdentifier(identifier, populate = "userId") {
    if (!identifier) return null;

    const offerLetterId = normalizeOfferLetterLookupId(identifier);
    let offerLetter;

    if (mongoose.Types.ObjectId.isValid(offerLetterId)) {
        offerLetter = await OfferLetter.findById(offerLetterId).populate(populate);
    } else {
        // Efficient lookup using shortId index
        offerLetter = await OfferLetter.findOne({
            shortId: offerLetterId.toUpperCase()
        }).populate(populate);

        // Fallback to slow regex ONLY if shortId not found (for legacy records)
        if (!offerLetter && offerLetterId.length >= 4) {
            offerLetter = await OfferLetter.findOne({
                $expr: {
                    $regexMatch: {
                        input: { $toString: "$_id" },
                        regex: offerLetterId + "$",
                        options: "i"
                    }
                }
            }).populate(populate);
        }
    }
    return offerLetter;
}

// Email setup
const { sendMail } = require("../config/emailTransporter");
const { checkCooldown, recordSend } = require("../utils/cooldownManager");
const transporter = {
    sendMail: (options) => sendMail(options)
};

exports.issueOfferLetter = async (req, res) => {
    console.log("OfferLetter: new");
    try {

        const validation = issueOfferLetterSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ 
                message: "Validation failed", 
                errors: validation.error.errors.map(err => ({ field: err.path.join('.'), message: err.message })) 
            });
        }

        // Use validated data
        const validatedData = validation.data;
        const {
            candidateName,
            email,
            position,
            department,
            salary,
            startDate,
            endDate,
            duration,
            joiningLocation,
            workType,
            benefits,
            reportingManager,
            hrContactName,
            hrContactEmail,
            hrContactPhone,
            validUntil,
            additionalNotes,
            offerType,
            payoutFrequency
        } = validatedData;

        const userId = req.user.userId;
        console.log(`Issuer: ${userId}`);

        const parsedStartDate = new Date(startDate);
        const parsedEndDate = endDate ? new Date(endDate) : null;
        const parsedValidUntil = new Date(validUntil);

        // Logic for duration:
        // 1. If explicit duration provided, use it.
        // 2. If no duration but endDate provided, calculate from dates.
        // 3. Fallback to calculation using validUntil if endDate is missing.
        // 4. Ultimate fallback text.
        let resolvedDuration = '';
        if (typeof duration === 'string' && duration.trim()) {
            resolvedDuration = duration.trim();
        } else {
            const calculationEndDate = parsedEndDate || parsedValidUntil;
            resolvedDuration = calculateDurationText(parsedStartDate, calculationEndDate);
        }

        if (!resolvedDuration) {
            resolvedDuration = 'Until project completion or 3 months (whichever is longer)';
        }

        console.log("Creating offer letter");
        const offerLetter = new OfferLetter({
            userId,
            candidateName,
            email,
            position,
            department,
            salary,
            startDate: parsedStartDate,
            endDate: parsedEndDate,
            duration: resolvedDuration,
            joiningLocation,
            workType: workType || 'On-site',
            benefits: benefits || [],
            reportingManager,
            hrContactName,
            hrContactEmail,
            hrContactPhone,
            validUntil: parsedValidUntil,
            additionalNotes,
            offerType: offerType || 'Job',
            payoutFrequency: payoutFrequency || ''
        });

        // Set shortId for efficient lookup (last 6 chars of ObjectId)
        offerLetter.shortId = offerLetter._id.toString().slice(-6).toUpperCase();

        const savedOfferLetter = await offerLetter.save();
        console.log(`Saved: ${savedOfferLetter._id}`);

        try {
            await logAudit({
                req,
                action: "ISSUE",
                resourceEntity: "OfferLetter",
                resourceId: savedOfferLetter._id,
                changes: { new: { candidateName, position, status: 'Draft' } }
            });
        } catch (e) { }

        res.status(201).json({
            message: "Offer letter issued successfully",
            offerLetterId: savedOfferLetter._id,
            offerLetterUrl: `/offer-letters/${savedOfferLetter._id}.pdf`
        });

    } catch (error) {
        console.error("Error:", error.message);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

exports.getAllOfferLetters = async (req, res) => {
    console.log("OfferLetters: all");
    try {
        const offerLetters = await OfferLetter.find().populate("userId", "name email").sort({ createdAt: -1 }).lean();
        console.log(`Found: ${offerLetters.length}`);
        res.status(200).json(offerLetters);
    } catch (error) {
        console.error("Error:", error.message);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

exports.getOfferLetterById = async (req, res) => {
    console.log(`Get offer letter: ${req.params.id}`);
    try {
        const offerLetter = await findOfferLetterByIdentifier(req.params.id, "userId");

        if (!offerLetter) {
            console.log(`Not found: ${req.params.id}`);
            return res.status(404).json({ message: "Offer letter not found" });
        }

        console.log(`Found: ${offerLetter.candidateName}`);
        res.status(200).json(offerLetter);
    } catch (error) {
        console.error("Error:", error.message);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

exports.verifyOfferLetter = async (req, res) => {
    console.log(`Verify Offer: ${req.params.id}`);
    try {
        const offerLetter = await findOfferLetterByIdentifier(req.params.id, "userId");

        if (!offerLetter) {
            console.log(`Not found: ${req.params.id}`);
            return res.status(404).json({ message: "Offer letter not found" });
        }

        console.log(`Verified Offer: ${offerLetter.candidateName}`);
        res.status(200).json({
            message: "Offer letter verified successfully",
            offerLetter
        });
    } catch (error) {
        console.error("Error:", error.message);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

exports.updateOfferLetterStatus = async (req, res) => {
    console.log(`Update offer letter status: ${req.params.id}`);
    try {
        const { status } = req.body;
        const oldLetter = await findOfferLetterByIdentifier(req.params.id, null);

        if (!status || !['Pending', 'Accepted', 'Rejected'].includes(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }

        if (!oldLetter) {
            return res.status(404).json({ message: "Offer letter not found" });
        }

        const effectiveId = oldLetter._id;

        const updateData = { status };
        if (status === 'Accepted') {
            updateData.acceptedAt = new Date();
            updateData.rejectedAt = undefined;
        }
        if (status === 'Rejected') {
            updateData.rejectedAt = new Date();
            updateData.acceptedAt = undefined;
        }
        if (status === 'Pending') {
            updateData.acceptedAt = undefined;
            updateData.rejectedAt = undefined;
        }

        const offerLetter = await OfferLetter.findByIdAndUpdate(
            effectiveId,
            updateData,
            { new: true }
        );

        if (!offerLetter) {
            return res.status(404).json({ message: "Offer letter not found" });
        }

        try {
            if (oldLetter) {
                await logAudit({
                    req,
                    action: "STATUS_CHANGE",
                    resourceEntity: "OfferLetter",
                    resourceId: offerLetter._id,
                    changes: { oldStatus: oldLetter.status, newStatus: offerLetter.status }
                });
            }
        } catch (e) { }

        const linkedUser = await User.findOne({ email: offerLetter.email });
        if (linkedUser) {
            const userUpdate = { offerLetter: offerLetter._id };
            if (status === 'Accepted') {
                userUpdate.status = 'active';
            } else if (status === 'Rejected' && linkedUser.status === 'active') {
                userUpdate.status = 'active'; // Still active as a candidate/user
            }

            await User.findByIdAndUpdate(linkedUser._id, userUpdate, { runValidators: true });
        }

        res.status(200).json({
            message: "Offer letter status updated successfully",
            offerLetter
        });
    } catch (error) {
        console.error("Error:", error.message);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

exports.extendOfferLetter = async (req, res) => {
    console.log(`Extend offer letter: ${req.params.id}`);
    try {
        const validation = extendOfferLetterSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ 
                message: "Validation failed", 
                errors: validation.error.errors.map(err => ({ field: err.path.join('.'), message: err.message })) 
            });
        }

        const { newValidUntil, newStartDate, newEndDate, newDuration, additionalNotes } = validation.data;
        const offerLetterId = normalizeOfferLetterLookupId(req.params.id);

        if (!mongoose.Types.ObjectId.isValid(offerLetterId)) {
            return res.status(400).json({ message: "Invalid offer letter ID" });
        }

        // Find the offer letter
        const offerLetter = await OfferLetter.findById(offerLetterId);

        if (!offerLetter) {
            return res.status(404).json({ message: "Offer letter not found" });
        }

        // Check if offer letter is accepted
        if (offerLetter.status !== 'Accepted') {
            return res.status(400).json({ message: "Only accepted offer letters can be extended" });
        }

        // Validate new dates
        const newValidDate = new Date(newValidUntil);
        const currentValidDate = new Date(offerLetter.validUntil);

        if (newValidDate <= currentValidDate) {
            return res.status(400).json({ message: "New valid until date must be after the current valid until date" });
        }

        // If new start date is provided, validate it
        if (newStartDate) {
            const newStartDateObj = new Date(newStartDate);
            if (newStartDateObj >= newValidDate) {
                return res.status(400).json({ message: "New start date must be before the new valid until date" });
            }
        }

        // Build extension history entry
        const extensionHistoryEntry = {
            oldValidUntil: offerLetter.validUntil,
            newValidUntil: newValidDate,
            oldStartDate: offerLetter.startDate,
            newStartDate: newStartDate ? new Date(newStartDate) : offerLetter.startDate,
            notes: additionalNotes || null,
            previousOfferSnapshot: {
                position: offerLetter.position,
                department: offerLetter.department,
                salary: offerLetter.salary,
                joiningLocation: offerLetter.joiningLocation,
                workType: offerLetter.workType,
                reportingManager: offerLetter.reportingManager,
                validUntil: offerLetter.validUntil,
                startDate: offerLetter.startDate
            },
            updatedOfferSnapshot: {
                position: offerLetter.position,
                department: offerLetter.department,
                salary: offerLetter.salary,
                joiningLocation: offerLetter.joiningLocation,
                workType: offerLetter.workType,
                reportingManager: offerLetter.reportingManager,
                validUntil: newValidDate,
                startDate: newStartDate ? new Date(newStartDate) : offerLetter.startDate
            },
            extendedAt: new Date(),
            extendedBy: req.user.userId
        };

        // Update the offer letter
        const updateData = {
            $set: {
                validUntil: newValidDate,
                updatedAt: new Date(),
                pdfBuffer: undefined,
                pdfGeneratedAt: undefined
            },
            $push: {
                extensionHistory: extensionHistoryEntry
            }
        };

        if (newStartDate) {
            updateData.$set.startDate = new Date(newStartDate);
        }

        if (newEndDate) {
            updateData.$set.endDate = new Date(newEndDate);
        }

        const effectiveStartDate = newStartDate ? new Date(newStartDate) : offerLetter.startDate;
        const effectiveEndDate = newEndDate ? new Date(newEndDate) : offerLetter.endDate;

        if (newDuration && typeof newDuration === 'string' && newDuration.trim()) {
            updateData.$set.duration = newDuration.trim();
        } else if (newEndDate || (newStartDate && offerLetter.endDate)) {
            updateData.$set.duration = calculateDurationText(effectiveStartDate, effectiveEndDate)
                || offerLetter.duration;
        }

        if (additionalNotes) {
            updateData.$set.additionalNotes = additionalNotes;
        }

        const updatedOfferLetter = await OfferLetter.findByIdAndUpdate(
            offerLetterId,
            updateData,
            { new: true }
        ).populate("userId", "name email");

        console.log(`Offer letter extended successfully for: ${updatedOfferLetter.candidateName}`);

        try {
            await logAudit({
                req,
                action: "UPDATE",
                resourceEntity: "OfferLetter",
                resourceId: updatedOfferLetter._id,
                changes: { extensionHistory: true }
            });
        } catch (e) { }

        // Send extension email notification
        try {
            const acceptanceUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/offer/accept/job/${updatedOfferLetter._id}`;
            const pdfBuffer = await generateOfferLetterPDFInMemory(updatedOfferLetter);

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: updatedOfferLetter.email,
                replyTo: process.env.REPLY_TO_EMAIL || process.env.EMAIL_USER,
                subject: `Offer Validity Extended - ${updatedOfferLetter.position} at FMPG`,
                html: getExtendedOfferTemplate(
                    updatedOfferLetter.candidateName,
                    updatedOfferLetter.position,
                    acceptanceUrl,
                    updatedOfferLetter.validUntil,
                    {
                        name: updatedOfferLetter.hrContactName || 'HR Team',
                        email: updatedOfferLetter.hrContactEmail || 'contact@gmail.com',
                        phone: updatedOfferLetter.hrContactPhone || '1234567890'
                    }
                ),
                attachments: [
                    {
                        filename: `Offer_Letter_Extended_${updatedOfferLetter.candidateName.replace(/\s+/g, '_')}.pdf`,
                        content: pdfBuffer,
                        contentType: 'application/pdf'
                    }
                ]
            };

            await transporter.sendMail(mailOptions);
            console.log(`Extension email sent to: ${updatedOfferLetter.email}`);
        } catch (emailError) {
            console.error("Failed to send extension email:", emailError.message);
        }

        res.status(200).json({
            message: "Offer letter extended successfully",
            offerLetter: updatedOfferLetter
        });
    } catch (error) {
        console.error("Error extending offer letter:", error.message);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

exports.downloadOfferLetter = async (req, res) => {
    console.log(`Download request for offer letter: ${req.params.id}`);
    try {
        const offerLetter = await findOfferLetterByIdentifier(req.params.id, null);

        if (!offerLetter) {
            console.log(`Offer letter not found: ${req.params.id}`);
            return res.status(404).json({ message: "Offer letter not found" });
        }

        const offerLetterId = offerLetter._id;

        console.log(`Generating PDF in memory for: ${offerLetter.candidateName}`);

        const filename = `offer-letter-${offerLetterId}.pdf`;

        // Generate PDF in memory (Cache disabled for iteration)
        console.log(`Generating fresh PDF: ${offerLetterId}`);
        const pdfBuffer = await generateOfferLetterPDFInMemory(offerLetter);

        // Send file directly from memory
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', pdfBuffer.length);

        try {
            // Avoid blocking download if log fails
            await logAudit({
                req,
                action: "DOWNLOAD",
                resourceEntity: "OfferLetter",
                resourceId: offerLetter._id,
                changes: { file: "PDF" }
            });
        } catch (e) { }

        res.end(pdfBuffer);
        console.log(`PDF sent: ${filename}`);

    } catch (error) {
        console.error("Error:", error.message);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

exports.sendOfferLetterEmail = async (req, res) => {
    console.log(`Send offer letter email: ${req.params.id}`);
    try {
        const offerLetterId = normalizeOfferLetterLookupId(req.params.id);
        const { recipientEmail } = req.body;

        if (!mongoose.Types.ObjectId.isValid(offerLetterId)) {
            return res.status(400).json({ message: "Invalid offer letter ID" });
        }

        const offerLetter = await OfferLetter.findById(offerLetterId);

        if (!offerLetter) {
            return res.status(404).json({ message: "Offer letter not found" });
        }

        // Find application to get its slug for the URL
        const Application = require("../models/application");
        const application = offerLetter.applicationId
            ? await Application.findById(offerLetter.applicationId).populate('jobId')
            : null;

        const filename = `offer-letter-${offerLetterId}.pdf`;

        // Generate PDF in memory
        const pdfBuffer = await generateOfferLetterPDFInMemory(offerLetter);

        const emailRecipient = recipientEmail || offerLetter.email;

        // Enforce 30-second cooldown per candidate to prevent accidental multiple dispatches
        const cooldown = checkCooldown(emailRecipient, 30);
        if (!cooldown.allowed) {
            return res.status(429).json({
                message: `Please wait ${cooldown.remainingSeconds} seconds before sending another email to this candidate.`,
                remainingSeconds: cooldown.remainingSeconds
            });
        }

        // If there's an application, use the application-based acceptance URL
        // Otherwise, use a direct offer letter acceptance URL
        let acceptanceUrl = '';
        if (application) {
            const jobSlug = application.jobId?.slug || 'job';
            const applicationSlug = application.slug || application._id;
            acceptanceUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/offer/accept/${jobSlug}/${applicationSlug}`;
        } else {
            // For manual offers, we'll use a direct acceptance link with the offer ID
            // We need to ensure the frontend supports this
            acceptanceUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/offer/accept/manual/${offerLetterId}`;
        }

        // Determine if this is an internship
        const isInternship = (offerLetter.offerType && offerLetter.offerType.toLowerCase() === 'internship') ||
            (offerLetter.position && offerLetter.position.toLowerCase().includes('intern')) ||
            (offerLetter.salary === 0 || offerLetter.salary === "0");

        // Format date
        const formatEmailDate = (date) => {
            return new Date(date).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        };

        const isExtended = offerLetter.extensionHistory && offerLetter.extensionHistory.length > 0;
        const template = isExtended ? getExtendedOfferTemplate : getOfferLetterTemplate;

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: emailRecipient,
            replyTo: process.env.REPLY_TO_EMAIL || process.env.EMAIL_USER,
            subject: isExtended
                ? `Offer Validity Extended - ${offerLetter.position} at ${offerLetter.companyName || 'FMPG'}`
                : (isInternship
                    ? `Internship Offer - ${offerLetter.position} at ${offerLetter.companyName || 'FMPG'}`
                    : `Job Offer - ${offerLetter.position} at ${offerLetter.companyName || 'FMPG'}`),
            html: template(
                offerLetter.candidateName,
                offerLetter.position,
                acceptanceUrl,
                offerLetter.validUntil,
                {
                    name: offerLetter.hrContactName || 'HR Team',
                    email: offerLetter.hrContactEmail || 'contact@gmail.com',
                    phone: offerLetter.hrContactPhone || '1234567890'
                }
            ),
            attachments: [
                {
                    filename: filename,
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }
            ]
        };

        await transporter.sendMail(mailOptions);
        recordSend(emailRecipient);
        console.log(`Offer letter emailed with acceptance link to: ${emailRecipient}`);

        try {
            await logAudit({
                req,
                action: "EMAIL",
                resourceEntity: "OfferLetter",
                resourceId: offerLetter._id,
                changes: { recipient: emailRecipient }
            });
        } catch (e) { }

        res.status(200).json({
            message: "Offer letter sent successfully with acceptance link",
            sentTo: emailRecipient,
            acceptanceUrl: acceptanceUrl
        });

    } catch (error) {
        console.error("Error sending email:", error.message);
        res.status(500).json({ message: "Error sending email", error: error.message });
    }
};

// Regenerate acceptance token for offer letter
exports.regenerateAcceptanceToken = async (req, res) => {
    console.log("Regenerate acceptance token for offer letter:", req.params.id);
    try {
        const id = normalizeOfferLetterLookupId(req.params.id);

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid offer letter ID" });
        }

        const offerLetter = await OfferLetter.findById(id);
        if (!offerLetter) {
            return res.status(404).json({ message: "Offer letter not found" });
        }

        // Generate new acceptance token
        offerLetter.acceptanceToken = crypto.randomBytes(32).toString('hex');
        await offerLetter.save();

        console.log(`Generated new acceptance token for offer letter ${id}`);

        res.status(200).json({
            message: "Acceptance token regenerated successfully",
            acceptanceToken: offerLetter.acceptanceToken
        });

    } catch (error) {
        console.error("Error regenerating acceptance token:", error);
        res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
};

// Utility function to add acceptance tokens to all offer letters that don't have them
exports.addAcceptanceTokensToExisting = async (req, res) => {
    console.log("Adding acceptance tokens to existing offer letters");
    try {
        // Find all offer letters without acceptance tokens
        const offerLettersWithoutTokens = await OfferLetter.find({
            $or: [
                { acceptanceToken: { $exists: false } },
                { acceptanceToken: null },
                { acceptanceToken: "" }
            ]
        });

        console.log(`Found ${offerLettersWithoutTokens.length} offer letters without acceptance tokens`);

        let updatedCount = 0;
        for (const offerLetter of offerLettersWithoutTokens) {
            offerLetter.acceptanceToken = crypto.randomBytes(32).toString('hex');
            await offerLetter.save();
            updatedCount++;
        }

        res.status(200).json({
            message: `Added acceptance tokens to ${updatedCount} offer letters`,
            updatedCount: updatedCount,
            totalFound: offerLettersWithoutTokens.length
        });

    } catch (error) {
        console.error("Error adding acceptance tokens:", error);
        res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
};

function calculateDurationText(startDate, endDate) {
    if (!endDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return null;
    }

    const diffMs = end.getTime() - start.getTime();
    if (diffMs <= 0) {
        return null;
    }

    const totalDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    // Very short durations
    if (totalDays < 7) {
        return `${totalDays} day${totalDays > 1 ? 's' : ''}`;
    }
    
    // Weeks if less than a month
    if (totalDays < 28) {
        const weeks = Math.floor(totalDays / 7);
        const remDays = totalDays % 7;
        if (remDays === 0) return `${weeks} week${weeks > 1 ? 's' : ''}`;
        return `${weeks} week${weeks > 1 ? 's' : ''} ${remDays} day${remDays > 1 ? 's' : ''}`;
    }

    const months = Math.floor(totalDays / 30.44); // Use average month length
    const days = Math.round(totalDays % 30.44);

    if (months > 0 && days >= 5) {
        return `${months} month${months > 1 ? 's' : ''} ${days} day${days > 1 ? 's' : ''}`;
    }

    if (months > 0) {
        return `${months} month${months > 1 ? 's' : ''}`;
    }

    return `${totalDays} day${totalDays > 1 ? 's' : ''}`;
}

function getOfferDurationText(offerLetter) {
    const storedDuration = typeof offerLetter.duration === 'string' ? offerLetter.duration.trim() : '';
    if (storedDuration) {
        return storedDuration;
    }

    return calculateDurationText(offerLetter.startDate, offerLetter.endDate || offerLetter.validUntil)
        || 'Until project completion or 3 months (whichever is longer)';
}

function getHrSignatoryName(offerLetter) {
    const hrName = typeof offerLetter.hrContactName === 'string' ? offerLetter.hrContactName.trim() : '';
    const issuedBy = typeof offerLetter.issuedBy === 'string' ? offerLetter.issuedBy.trim() : '';

    return hrName || issuedBy || 'HR Team';
}

// ============================================================
// FMPG — Light-Theme Offer Letter PDF Generator (A4)
// Drop-in replacement for generateOfferLetterPDFInMemory()
// Light/white theme matching fmpg.in aesthetic
// ============================================================

// Colour palette — light theme matching fmpg.in
const C = {
    white: '#ffffff',
    bg: '#fafafa',
    bgAccent: '#f4fac0',   // lime tint panels
    lime: '#c8e600',   // primary brand lime
    limeDark: '#8aad00',   // darker lime for text/accents
    limeBorder: '#daf04a',   // lighter lime border
    limeDeep: '#4a6800',   // deep lime for text on lime bg
    black: '#111111',
    dark: '#1a1a1a',
    mid: '#444444',
    muted: '#777777',
    subtle: '#aaaaaa',
    border: '#ebebeb',
    border2: '#dddddd',
    rowBg: '#f9fdf0',   // tinted position card bg
};

const W = 595.28;   // A4 width  (pt)
const H = 841.89;   // A4 height (pt)
const PAD = 40;     // horizontal margin

// ── helpers ──────────────────────────────────────────────────

function roundRect(doc, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    doc.moveTo(x + rr, y)
        .lineTo(x + w - rr, y).quadraticCurveTo(x + w, y, x + w, y + rr)
        .lineTo(x + w, y + h - rr).quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
        .lineTo(x + rr, y + h).quadraticCurveTo(x, y + h, x, y + h - rr)
        .lineTo(x, y + rr).quadraticCurveTo(x, y, x + rr, y)
        .closePath();
}

function fillRR(doc, x, y, w, h, r, fill) {
    roundRect(doc, x, y, w, h, r);
    doc.fill(fill);
}

function strokeRR(doc, x, y, w, h, r, stroke, lw = 0.5) {
    roundRect(doc, x, y, w, h, r);
    doc.lineWidth(lw).strokeColor(stroke).stroke();
}

function pill(doc, x, y, w, h, fill, strokeColor) {
    const r = h / 2;
    if (fill) fillRR(doc, x, y, w, h, r, fill);
    if (strokeColor) strokeRR(doc, x, y, w, h, r, strokeColor, 0.75);
}

function sectionLabel(doc, text, x, y, totalWidth) {
    doc.font('Helvetica-Bold').fontSize(7).fillColor(C.limeDark);
    doc.text(text.toUpperCase(), x, y + 1, { lineBreak: false, characterSpacing: 1.3 });
    const tw = doc.widthOfString(text.toUpperCase(), { characterSpacing: 1.3 });
    doc.rect(x + tw + 8, y + 4, totalWidth - tw - 8, 0.5).fill(C.border);
}

function detailCell(doc, label, value, x, y, cellW, accent) {
    doc.font('Helvetica').fontSize(7).fillColor(C.subtle);
    doc.text(label.toUpperCase(), x, y, { lineBreak: false, characterSpacing: 0.7 });
    doc.font('Helvetica-Bold').fontSize(10).fillColor(accent ? C.limeDark : C.dark);
    doc.text(value, x, y + 12, { lineBreak: false, width: cellW - 10 });
}

function checkmark(doc, cx, cy, size) {
    doc.save();
    doc.lineWidth(1.8).strokeColor(C.dark).lineCap('round').lineJoin('round');
    doc.moveTo(cx - size * 0.38, cy)
        .lineTo(cx - size * 0.05, cy + size * 0.32)
        .lineTo(cx + size * 0.38, cy - size * 0.28)
        .stroke();
    doc.restore();
}

// ── QR code ──────────────────────────────────────────────────

function drawQR(doc, url, qrX, qrY, qrSize) {
    const qrData = QRCode.create(url, { errorCorrectionLevel: 'H' });
    const modules = qrData.modules.size;
    const pad = qrSize * 0.07;
    const effective = qrSize - pad * 2;
    const modSize = effective / modules;

    fillRR(doc, qrX, qrY, qrSize, qrSize, 6, C.bg);
    strokeRR(doc, qrX, qrY, qrSize, qrSize, 6, C.border2, 0.5);

    for (let r = 0; r < modules; r++) {
        for (let c = 0; c < modules; c++) {
            if (!qrData.modules.get(r, c)) continue;
            const tl = r < 7 && c < 7;
            const tr = r < 7 && c >= modules - 7;
            const bl = r >= modules - 7 && c < 7;
            if (tl || tr || bl) continue;
            const cx = qrX + pad + c * modSize + modSize / 2;
            const cy = qrY + pad + r * modSize + modSize / 2;
            doc.circle(cx, cy, (modSize / 2) * 0.82).fill(C.dark);
        }
    }
    // Eyes
    [[0, 0], [0, modules - 7], [modules - 7, 0]].forEach(([er, ec]) => {
        const ex = qrX + pad + (ec + 3.5) * modSize;
        const ey = qrY + pad + (er + 3.5) * modSize;
        doc.circle(ex, ey, 3.5 * modSize).fill(C.dark);
        doc.circle(ex, ey, 2.5 * modSize).fill(C.white);
        doc.circle(ex, ey, 1.5 * modSize).fill(C.limeDark);
    });
}

// ── main PDF function ─────────────────────────────────────────

async function generateOfferLetterPDFInMemory(offerLetter) {
    console.log(`Generating light-theme offer letter PDF for: ${offerLetter.candidateName}`);

    let verifyBase = (process.env.FRONTEND_URL || 'https://careers.fmpg.in').replace(/\/+$/, '');
    // Ensure localhost uses http to avoid SSL errors during development
    if (verifyBase.includes('localhost')) {
        verifyBase = verifyBase.replace('https://', 'http://');
    }
    const verifyUrl = `${verifyBase}/verify-offer/${offerLetter._id}`;

    const fmt = (d) => d
        ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
        : '—';

    const isInternship = (offerLetter.offerType && offerLetter.offerType.toLowerCase() === 'internship') ||
        (offerLetter.position && offerLetter.position.toLowerCase().includes('intern')) ||
        (offerLetter.salary === 0 || offerLetter.salary === '0');

    const isExtended = !!(offerLetter.extensionHistory && offerLetter.extensionHistory.length > 0);

    let salaryLabel = isInternship ? 'Stipend' : 'Annual CTC';
    if (isInternship && offerLetter.payoutFrequency) {
        salaryLabel += ` (${offerLetter.payoutFrequency})`;
    }

    const salaryValue = (offerLetter.salary === 0 || offerLetter.salary === '0')
        ? 'Unpaid'
        : `Rs.${formatCurrencyValue(offerLetter.salary)}`;
    
    const payoutSuffix = '';

    const offerTypeLabel = isInternship ? 'Internship' : (offerLetter.offerType || 'Job');

    const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        autoFirstPage: false,
        info: {
            Title: `Offer Letter — ${offerLetter.candidateName}`,
            Author: 'FMPG',
            Subject: 'Employment Offer Letter',
        }
    });

    doc.addPage({ size: 'A4', margins: { top: 0, bottom: 0, left: 0, right: 0 } });

    const buffers = [];
    doc.on('data', (b) => buffers.push(b));

    // ── BACKGROUND ──────────────────────────────────────────
    doc.rect(0, 0, W, H).fill(C.white);
    // Top lime bar
    doc.rect(0, 0, W, 6).fill(C.lime);
    // Bottom lime bar
    doc.rect(0, H - 6, W, 6).fill(C.lime);

    // ── HEADER STRIP ────────────────────────────────────────
    const headerH = 58;
    const headerY = 6;
    doc.rect(0, headerY, W, headerH).fill(C.white);
    doc.rect(0, headerY + headerH - 0.5, W, 0.5).fill(C.border);

    // ── LOGO (from memory cache, 140×40 pt reserved zone) ─────────
    const logoX = PAD;
    const logoY = headerY + (headerH - 40) / 2;
    const logoW = 140;
    const logoH = 40;

    if (cachedLogo) {
        doc.image(cachedLogo, logoX, logoY, { fit: [logoW, logoH], align: 'left', valign: 'center' });
        // Add FMPG text after logo
        doc.font('Helvetica-Bold').fontSize(22).fillColor(C.dark);
        doc.text('FMPG', logoX + 50, logoY + 11, { lineBreak: false });
    } else {
        // Fallback: lime square + FMPG text
        fillRR(doc, logoX, logoY + 6, 28, 28, 6, C.lime);
        doc.font('Helvetica-Bold').fontSize(14).fillColor(C.dark);
        doc.text('F', logoX + 8, logoY + 14, { lineBreak: false });
        doc.font('Helvetica-Bold').fontSize(18).fillColor(C.dark);
        doc.text('FMPG', logoX + 36, logoY + 11, { lineBreak: false });
    }

    // Reference — top right
    const refX = W - PAD - 140;
    const refY = headerY + 12;
    doc.font('Helvetica').fontSize(7).fillColor(C.subtle);
    doc.text('REFERENCE', refX, refY, { lineBreak: false, characterSpacing: 0.8 });
    doc.font('Helvetica').fontSize(9).fillColor(C.mid);
    doc.text(`FMPG-OFF-${offerLetter._id.toString().slice(-6).toUpperCase()}`, refX, refY + 12, { lineBreak: false });

    // ── BODY ────────────────────────────────────────────────
    let y = headerY + headerH + 22;

    // Tag pill
    const tagText = isExtended ? 'OFFER EXTENSION' : 'OFFICIAL OFFER LETTER';
    doc.font('Helvetica-Bold').fontSize(7);
    const tagTextW = doc.widthOfString(tagText, { characterSpacing: 1.1 });
    const tagW = tagTextW + 34;
    const tagH = 18;
    pill(doc, PAD, y, tagW, tagH, C.bgAccent, C.limeBorder);
    doc.circle(PAD + 10, y + tagH / 2, 3).fill(C.limeDark);
    doc.font('Helvetica-Bold').fontSize(7).fillColor(C.limeDeep);
    doc.text(tagText, PAD + 18, y + 5.5, { lineBreak: false, characterSpacing: 1.1 });
    y += tagH + 8;

    // Headline
    const h1 = isExtended ? 'Your Offer Has Been' : "Official Offer.";
    const h2 = isExtended ? 'Extended.' : 'Welcome to FMPG.';
    doc.font('Helvetica-Bold').fontSize(26).fillColor(C.black);
    doc.text(h1, PAD, y, { lineBreak: false });
    y += 30;
    doc.font('Helvetica-Bold').fontSize(26).fillColor(C.limeDark);
    doc.text(h2, PAD, y, { lineBreak: false });
    y += 32;

    // Lime underline accent
    doc.rect(PAD, y, 36, 3).fill(C.lime);
    y += 20;

    // Greeting
    doc.font('Helvetica-Bold').fontSize(12).fillColor(C.dark);
    doc.text(`Dear ${offerLetter.candidateName},`, PAD, y, { lineBreak: false });
    y += 18;

    const introText = isExtended
        ? `We are pleased to inform you that the validity of your offer to join FMPG has been extended. We remain excited about your potential contribution and look forward to welcoming you on board.`
        : `We are delighted to extend this formal offer of appointment to join the FMPG family. Your skills and background impressed our team, and we believe you will be a valuable addition to our growing organization.`;

    doc.font('Helvetica').fontSize(10.5).fillColor(C.muted).lineGap(3);
    doc.text(introText, PAD, y, { width: W - PAD * 2 });
    y += 45;

    // ── POSITION CARD ────────────────────────────────────────
    const cardH = 65;
    fillRR(doc, PAD, y, W - PAD * 2, cardH, 8, C.rowBg);
    doc.rect(PAD, y, 4, cardH).fill(C.lime);
    strokeRR(doc, PAD, y, W - PAD * 2, cardH, 8, C.limeBorder, 0.75);

    // Tag badge
    doc.font('Helvetica-Bold').fontSize(9);
    const bTW = doc.widthOfString(offerTypeLabel.toUpperCase());
    const badgeW = bTW + 24;
    const badgeX = W - PAD - badgeW - 14;
    const badgeY = y + (cardH - 22) / 2;
    pill(doc, badgeX, badgeY, badgeW, 22, C.bgAccent, C.limeBorder);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(C.limeDeep);
    doc.text(offerTypeLabel.toUpperCase(), badgeX + 12, badgeY + 6.5, { lineBreak: false });

    // Position text (truncate width to avoid overlapping badge)
    const posTextMaxW = badgeX - PAD - 26;
    doc.font('Helvetica').fontSize(8.5).fillColor(C.subtle);
    doc.text('POSITION OFFERED', PAD + 16, y + 11, { lineBreak: false, characterSpacing: 0.8 });
    doc.font('Helvetica-Bold').fontSize(15).fillColor(C.black);
    doc.text(offerLetter.position.toUpperCase(), PAD + 16, y + 24, { lineBreak: false, width: posTextMaxW, ellipsis: true });
    if (offerLetter.department) {
        doc.font('Helvetica').fontSize(10).fillColor(C.subtle);
        doc.text(offerLetter.department, PAD + 16, y + 44, { lineBreak: false, width: posTextMaxW, ellipsis: true });
    }

    y += cardH + 20;

    // ── DETAILS GRID ─────────────────────────────────────────
    sectionLabel(doc, 'Offer Details', PAD, y, W - PAD * 2);
    y += 13;

    const details = [
        ['Joining Date', fmt(offerLetter.startDate), false],
        ['Duration', getOfferDurationText(offerLetter), false],
        [salaryLabel, salaryValue + payoutSuffix, true],
        ['Work Type', offerLetter.workType || 'On-site', false],
        ['Location', offerLetter.joiningLocation || '—', false],
        ['Reporting To', offerLetter.reportingManager || 'FMPG Team', false],
    ];

    const gridW = W - PAD * 2;
    const cellW = gridW / 3;
    const cellH = 42;
    const rows = Math.ceil(details.length / 3);
    const gridH = rows * cellH;

    strokeRR(doc, PAD, y, gridW, gridH, 6, C.border, 0.5);
    for (let c = 1; c < 3; c++) doc.rect(PAD + c * cellW, y, 0.5, gridH).fill(C.border);
    for (let r = 1; r < rows; r++) doc.rect(PAD, y + r * cellH, gridW, 0.5).fill(C.border);

    details.forEach(([label, value, accent], i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        // Custom detail cell call with larger fonts
        doc.font('Helvetica').fontSize(8.5).fillColor(C.subtle);
        doc.text(label.toUpperCase(), PAD + col * cellW + 10, y + row * cellH + 8, { lineBreak: false, characterSpacing: 0.7 });
        doc.font('Helvetica-Bold').fontSize(12).fillColor(accent ? C.limeDark : C.dark);
        doc.text(value, PAD + col * cellW + 10, y + row * cellH + 22, { lineBreak: false, width: cellW - 15 });
    });
    y += gridH + 25;

    // ── TERMS ────────────────────────────────────────────────
    sectionLabel(doc, 'Terms & Expectations', PAD, y, W - PAD * 2);
    y += 16;

    const terms = [
        ['Confidentiality', 'Maintain strict confidentiality of all company data and trade secrets during and after your tenure.'],
        ['Code Ownership', 'All work produced during your tenure remains the exclusive intellectual property of FMPG.'],
        ['Professionalism', 'Adhere to our code of conduct and meet agreed performance standards throughout your role.'],
        ['Acceptance', 'This offer is contingent upon successful background verification and validation of credentials.'],
    ];

    const termsH = terms.length * 18 + 14;
    fillRR(doc, PAD, y, W - PAD * 2, termsH, 6, C.bg);
    strokeRR(doc, PAD, y, W - PAD * 2, termsH, 6, C.border, 0.5);

    let ty = y + 10;
    terms.forEach(([title, body]) => {
        doc.circle(PAD + 13, ty + 4.5, 2.5).fill(C.lime);
        doc.font('Helvetica-Bold').fontSize(9).fillColor(C.mid);
        doc.text(`${title}: `, PAD + 21, ty, { lineBreak: false });
        const tw = doc.widthOfString(`${title}: `);
        doc.font('Helvetica').fontSize(9).fillColor(C.muted);
        doc.text(body, PAD + 21 + tw, ty, { lineBreak: false, width: W - PAD * 2 - 32 - tw, ellipsis: true });
        ty += 18;
    });
    y += termsH + 25;

    // ── ACCEPTANCE BAR ───────────────────────────────────────
    const acceptH = 65;
    fillRR(doc, PAD, y, W - PAD * 2, acceptH, 8, C.bgAccent);
    strokeRR(doc, PAD, y, W - PAD * 2, acceptH, 8, C.limeBorder, 0.75);

    const iconS = 36, iconX = PAD + 12, iconY = y + (acceptH - iconS) / 2;
    fillRR(doc, iconX, iconY, iconS, iconS, 7, C.lime);
    checkmark(doc, iconX + iconS / 2, iconY + iconS / 2, 8);

    const atx = iconX + iconS + 14;
    doc.font('Helvetica-Bold').fontSize(9).fillColor(C.limeDeep);
    doc.text('HOW TO ACCEPT', atx, y + 12, { lineBreak: false, characterSpacing: 0.9 });
    doc.font('Helvetica').fontSize(10).fillColor(C.muted);
    doc.text('Confirm via the FMPG portal or reply to this offer email with:', atx, y + 26, { lineBreak: false });
    doc.font('Helvetica').fontSize(10).fillColor(C.mid);
    doc.text('"I accept the offer and agree to the terms and conditions."', atx, y + 42, { lineBreak: false });
    y += acceptH + 35;

    // ── FOOTER SEPARATOR ────────────────────────────────────
    doc.rect(PAD, y, W - PAD * 2, 0.5).fill(C.border);
    y += 25;

    // ── SIGNATURES + QR ─────────────────────────────────────
    const qrSize = 60;

    drawQR(doc, verifyUrl, W / 2 - qrSize / 2, y, qrSize);
    doc.font('Helvetica').fontSize(6.5).fillColor(C.subtle);
    const qrLW = doc.widthOfString('SCAN TO VERIFY', { characterSpacing: 0.7 });
    doc.text('SCAN TO VERIFY', W / 2 - qrLW / 2, y + qrSize + 5, { lineBreak: false, characterSpacing: 0.7 });

    // Left — Founder
    doc.font('Helvetica-Bold').fontSize(13).fillColor(C.black);
    doc.text('Vivek Kumar', PAD, y + 14, { lineBreak: false });
    doc.rect(PAD, y + 32, 120, 0.75).fill(C.border2);
    doc.font('Helvetica').fontSize(9).fillColor(C.subtle);
    doc.text('FOUNDER & DIRECTOR', PAD, y + 40, { lineBreak: false, characterSpacing: 0.5 });

    // Right — HR
    const hrName = getHrSignatoryName(offerLetter);
    const hrNW = doc.font('Helvetica-Bold').fontSize(13).widthOfString(hrName);
    doc.font('Helvetica-Bold').fontSize(13).fillColor(C.black);
    doc.text(hrName, W - PAD - hrNW, y + 14, { lineBreak: false });
    doc.rect(W - PAD - 120, y + 32, 120, 0.75).fill(C.border2);
    doc.font('Helvetica').fontSize(9).fillColor(C.subtle);
    const hrRW = doc.widthOfString('HUMAN RESOURCES', { characterSpacing: 0.5 });
    doc.text('HUMAN RESOURCES', W - PAD - hrRW, y + 40, { lineBreak: false, characterSpacing: 0.5 });

    // ── VALIDITY STRIP ───────────────────────────────────────
    const stripY = H - 6 - 22;
    doc.rect(0, stripY, W, 22).fill(C.bg);
    doc.rect(0, stripY, W, 0.5).fill(C.border);

    const validText = `Digitally issued · Valid without physical signature · Offer Acceptance Deadline: ${fmt(offerLetter.validUntil)}`;
    doc.font('Helvetica').fontSize(7.5).fillColor(C.subtle);
    doc.text(validText, PAD, stripY + 7, { lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.limeDark);
    doc.text('careers.fmpg.in', W - PAD - doc.widthOfString('careers.fmpg.in'), stripY + 7, { lineBreak: false });

    doc.end();

    return new Promise((resolve, reject) => {
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);
    });
}

// Bulk generate offer letters from CSV
exports.bulkIssueOfferLetters = async (req, res) => {
    console.log("OfferLetter: bulk issue starting");
    const results = [];
    const errors = [];
    let successCount = 0;

    try {
        if (!req.file) {
            return res.status(400).json({ message: "No CSV file uploaded" });
        }

        // Common fields from request body
        const {
            joiningLocation,
            workType,
            validUntil,
            hrContactName,
            hrContactEmail,
            hrContactPhone,
            additionalNotes,
            offerType,
            payoutFrequency,
            sendEmail = false,
            endDate: commonEndDate,
            duration: commonDuration
        } = req.body;

        if (!joiningLocation || !validUntil) {
            return res.status(400).json({ message: "Common fields (Joining Location, Valid Until) are required" });
        }

        const issuerId = req.user.userId;
        const parsedValidUntil = new Date(validUntil);

        // Parse CSV from buffer
        const stream = Readable.from(req.file.buffer);

        await new Promise((resolve, reject) => {
            const parser = csv();
            stream
                .pipe(parser)
                .on('data', (data) => results.push(data))
                .on('end', resolve)
                .on('error', (err) => {
                    console.error("CSV Parsing Error:", err);
                    reject(err);
                });
        });

        console.log(`CSV parsed: ${results.length} rows found`);

        for (const row of results) {
            try {
                // Trim all keys and values to avoid header/data issues
                const cleanRow = {};
                Object.keys(row).forEach(key => {
                    cleanRow[key.trim()] = row[key] ? row[key].trim() : '';
                });

                const { candidateName, email, position, department, salary, startDate } = cleanRow;

                if (!candidateName || !email || !position || !department || !salary || !startDate) {
                    errors.push({
                        row: cleanRow,
                        error: `Missing required fields: ${[!candidateName && 'candidateName', !email && 'email', !position && 'position', !department && 'department', !salary && 'salary', !startDate && 'startDate'].filter(Boolean).join(', ')}`
                    });
                    continue;
                }

                const parsedStartDate = new Date(startDate);
                if (isNaN(parsedStartDate.getTime())) {
                    errors.push({ row: cleanRow, error: `Invalid startDate format: ${startDate}` });
                    continue;
                }

                const resolvedJoiningLocation = cleanRow.joiningLocation || joiningLocation;
                const resolvedWorkType = cleanRow.workType || workType || 'On-site';
                const resolvedValidUntil = cleanRow.validUntil ? new Date(cleanRow.validUntil) : parsedValidUntil;
                const resolvedHrContactName = cleanRow.hrContactName || hrContactName;
                const resolvedHrContactEmail = cleanRow.hrContactEmail || hrContactEmail;
                const resolvedHrContactPhone = cleanRow.hrContactPhone || hrContactPhone;
                const resolvedAdditionalNotes = cleanRow.additionalNotes || additionalNotes || '';
                const resolvedOfferType = cleanRow.offerType || offerType || 'Job';
                const resolvedPayoutFrequency = cleanRow.payoutFrequency || payoutFrequency || '';

                const resolvedEndDate = cleanRow.endDate ? new Date(cleanRow.endDate) : (commonEndDate ? new Date(commonEndDate) : null);
                const resolvedDuration = (typeof cleanRow.duration === 'string' && cleanRow.duration.trim())
                    ? cleanRow.duration.trim()
                    : (commonDuration && commonDuration.trim()
                        ? commonDuration.trim()
                        : (calculateDurationText(parsedStartDate, resolvedEndDate || resolvedValidUntil) || 'Until project completion or 3 months (whichever is longer)'));

                const offerLetter = new OfferLetter({
                    userId: issuerId,
                    candidateName,
                    email,
                    position,
                    department,
                    salary,
                    startDate: parsedStartDate,
                    endDate: resolvedEndDate,
                    duration: resolvedDuration,
                    joiningLocation: resolvedJoiningLocation,
                    workType: resolvedWorkType,
                    hrContactName: resolvedHrContactName,
                    hrContactEmail: resolvedHrContactEmail,
                    hrContactPhone: resolvedHrContactPhone,
                    validUntil: resolvedValidUntil,
                    additionalNotes: resolvedAdditionalNotes,
                    offerType: resolvedOfferType,
                    payoutFrequency: resolvedPayoutFrequency
                });

                // Set shortId for efficient lookup (last 6 chars of ObjectId)
                offerLetter.shortId = offerLetter._id.toString().slice(-6).toUpperCase();

                await offerLetter.save();
                successCount++;

                // Trigger email if requested
                if (sendEmail === 'true' || sendEmail === true) {
                    console.log(`Email feature for bulk is currently manual via dashboard`);
                }

            } catch (err) {
                console.error("Row processing error:", err);
                errors.push({ row, error: err.message });
            }
        }

        res.status(200).json({
            message: `Bulk issuance complete. ${successCount} succeeded, ${errors.length} failed.`,
            successCount,
            errorCount: errors.length,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        console.error("Bulk Offer Letter Error:", error);
        res.status(500).json({ message: "Server error during bulk issuance", error: error.message });
    }
};

// Download sample CSV for offer letters
exports.downloadOfferSampleCSV = async (req, res) => {
    const headers = "candidateName,email,position,department,salary,startDate,joiningLocation,workType,validUntil,hrContactName,hrContactEmail,hrContactPhone,additionalNotes\n";
    const sampleRow = "John Doe,john@example.com,Software Engineer,Development,800000,2024-06-01,Indore,On-site,2024-05-30,HR Team,hr@example.com,9876543210,Welcome to the team!\n";

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="offer_letter_bulk_sample.csv"');
    res.status(200).send(headers + sampleRow);
};

// Delete offer letter - Super Admin only
exports.deleteOfferLetter = async (req, res) => {
    try {
        const { id } = req.params;
        const offerLetter = await findOfferLetterByIdentifier(id, null);
        if (!offerLetter) {
            return res.status(404).json({ message: "Offer letter not found" });
        }

        await OfferLetter.deleteOne({ _id: offerLetter._id });

        // Log audit trail
        await logAudit({
            req,
            action: "DELETE",
            resourceEntity: "OfferLetter",
            resourceId: offerLetter._id,
            changes: {
                deletedOfferLetter: {
                    candidateName: offerLetter.candidateName,
                    email: offerLetter.email,
                    position: offerLetter.position,
                    department: offerLetter.department,
                    status: offerLetter.status
                }
            }
        });

        res.status(200).json({ message: "Offer letter deleted successfully", offerLetterId: offerLetter._id });
    } catch (error) {
        console.error("Delete offer letter error:", error);
        res.status(500).json({ message: "Server error deleting offer letter", error: error.message });
    }
};