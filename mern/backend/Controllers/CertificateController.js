const { logAudit } = require('../services/auditService');
const { getCertificateTemplate } = require("../utils/emailTemplates");
const Certificate = require("../models/certificate");
const User = require("../models/user");
const fs = require("fs");
const mongoose = require("mongoose");
const path = require("path");
const QRCode = require("qrcode");
const PDFDocument = require("pdfkit");
const nodemailer = require("nodemailer");

function normalizeCertificateLookupId(rawCertificateId = "") {
    const normalizedCertificateId = String(rawCertificateId).trim().replace(/^(FMPG)[-\s]*/i, "");
    return normalizedCertificateId;
}

function resolveBackendAssetPath(...segments) {
    const candidates = [
        path.join(__dirname, "..", ...segments),
        path.join(process.cwd(), ...segments),
        path.join(process.cwd(), "backend", ...segments),
    ];

    const assetPath = candidates.find((candidate) => fs.existsSync(candidate));

    if (!assetPath) {
        throw new Error(`Asset not found: ${segments.join("/")}`);
    }

    return assetPath;
}

// Email setup
const { sendMail } = require("../config/emailTransporter");
const transporter = {
    sendMail: (options) => sendMail(options)
};

exports.issue = async (req, res) => {
    console.log("Cert: new");
    try {
        const { name, domain, jobrole, fromDate, toDate, issuedBy, email } = req.body;
        console.log(`For: ${name}`);

        if (!name || !domain || !jobrole || !fromDate || !toDate) {
            console.log("Missing fields");
            return res.status(400).json({ message: "All fields are required" });
        }

        // Set issuer
        const userId = req.user.userId;
        console.log(`Issuer: ${userId}`);

        console.log("Creating cert");
        const certificate = new Certificate({
            userId,
            name,
            recipientEmail: email || null,
            domain,
            jobrole,
            fromDate: new Date(fromDate),
            toDate: new Date(toDate),
            issuedBy: issuedBy || "FMPG",
        }); const savedCertificate = await certificate.save();
        console.log(`Saved: ${savedCertificate._id}`);

        try { await logAudit({ req, action: "ISSUE", resourceEntity: "Certificate", resourceId: savedCertificate._id, changes: { name, domain, jobrole } }); } catch (err) { }

        // Don't generate PDF immediately - generate only when needed
        res.status(201).json({
            message: "Certificate issued successfully",
            certificateId: `FMPG-${savedCertificate._id}`,
            certificateUrl: `/certificates/${savedCertificate._id}.pdf`
        });

    } catch (error) {
        console.error("Error:", error.message);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

exports.verifyCertificate = async (req, res) => {
    console.log(`Verify: ${req.params.id}`);
    try {
        const certId = normalizeCertificateLookupId(req.params.id);
        let certificate;

        if (mongoose.Types.ObjectId.isValid(certId)) {
            certificate = await Certificate.findById(certId).populate("userId", "name email");
        } else if (certId.length >= 4) {
            certificate = await Certificate.findOne({
                $expr: {
                    $regexMatch: {
                        input: { $toString: "$_id" },
                        regex: certId + "$",
                        options: "i"
                    }
                }
            }).populate("userId", "name email");
        }

        if (!certificate) {
            console.log(`Not found: ${certId}`);
            return res.status(404).json({ message: "Certificate not found" });
        }

        console.log(`Verified: ${certificate.name}`);
        res.status(200).json({
            message: "Certificate verified successfully",
            certificate
        });
    } catch (error) {
        console.error("Error:", error.message);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

exports.getAllCertificates = async (req, res) => {
    console.log("Certs: all");
    try {
        const certificates = await Certificate.find().populate("userId", "name email").sort({ createdAt: -1 }).lean();
        console.log(`Found: ${certificates.length}`);
        res.status(200).json(certificates);
    } catch (error) {
        console.error("Error:", error.message);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};


exports.downloadCertificate = async (req, res) => {
    console.log(`Download request for certificate: ${req.params.id}`);
    try {
        const certId = normalizeCertificateLookupId(req.params.id);
        let certificate;

        if (mongoose.Types.ObjectId.isValid(certId)) {
            certificate = await Certificate.findById(certId);
        } else if (certId.length >= 4) {
            certificate = await Certificate.findOne({
                $expr: {
                    $regexMatch: {
                        input: { $toString: "$_id" },
                        regex: certId + "$",
                        options: "i"
                    }
                }
            });
        }

        if (!certificate) {
            console.log(`Certificate with ID ${certId} not found in database`);
            return res.status(404).json({ message: "Certificate not found in database" });
        }

        console.log(`Generating PDF in memory for: ${certId}`);

        // Generate PDF directly in memory and stream to response
        const pdfBuffer = await generateCertificatePDFBuffer(certificate);

        console.log(`Starting download of: ${certId}`);

        try { await logAudit({ req, action: "DOWNLOAD", resourceEntity: "Certificate", resourceId: certId, changes: {} }); } catch (err) { }

        // Set headers for download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="certificate-${certId}.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.length);

        // Send the PDF buffer directly
        res.send(pdfBuffer);

    } catch (error) {
        console.error("Error downloading certificate:", error);
        res.status(500).json({ message: "Error downloading certificate", error: error.message });
    }
};


exports.generateCertificate = async (req, res) => {
    console.log(`Generate cert`);
    try {
        const { certificateId } = req.body;
        console.log(`ID: ${certificateId}`);

        if (!certificateId) {
            console.log("No ID");
            return res.status(400).json({ message: "Certificate ID is required" });
        }

        const certId = normalizeCertificateLookupId(certificateId);
        let certificate;

        if (mongoose.Types.ObjectId.isValid(certId)) {
            certificate = await Certificate.findById(certId);
        } else if (certId.length >= 4) {
            certificate = await Certificate.findOne({
                $expr: {
                    $regexMatch: {
                        input: { $toString: "$_id" },
                        regex: certId + "$",
                        options: "i"
                    }
                }
            });
        }

        if (!certificate) {
            console.log(`Not found`);
            return res.status(404).json({ message: "Certificate not found" });
        }

        // Generate PDF in memory (no file system operations)
        console.log(`Creating PDF in memory`);
        const pdfBuffer = await generateCertificatePDFBuffer(certificate);
        console.log(`PDF done`);

        res.status(200).json({
            message: "Certificate generated successfully",
            certificateId: `FMPG-${certificate._id}`,
            certificateUrl: `/certificates/${certificate._id}.pdf`
        });
    } catch (error) {
        console.error("Error:", error.message);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// ============================================================
// PDFKit-native certificate generation (no canvas dependency)
// ============================================================
// ============================================================
// Modern Stylized Certificate Generation
// ============================================================

const C = {
    black: '#0d0d0d',
    dark2: '#1c1c1c',
    dark3: '#252525',
    lime: '#d6f300',
    limeDim: '#a8c200',
    white: '#ffffff',
    offWhite: '#e8e8e8',
    gray1: '#aaaaaa',
    gray2: '#666666',
};

const W = 841.89;
const H = 595.28;

function roundRect(doc, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    doc.moveTo(x + rr, y)
        .lineTo(x + w - rr, y)
        .quadraticCurveTo(x + w, y, x + w, y + rr)
        .lineTo(x + w, y + h - rr)
        .quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
        .lineTo(x + rr, y + h)
        .quadraticCurveTo(x, y + h, x, y + h - rr)
        .lineTo(x, y + rr)
        .quadraticCurveTo(x, y, x + rr, y)
        .closePath();
}

function textCenter(doc, str, y, opts = {}) {
    const tw = doc.widthOfString(str);
    doc.text(str, (W - tw) / 2, y, { lineBreak: false, ...opts });
}

function hex2rgb(h) {
    const v = parseInt(h.replace('#', ''), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function lerpColor(a, b, t) {
    const ca = hex2rgb(a), cb = hex2rgb(b);
    return [
        Math.round(ca[0] + (cb[0] - ca[0]) * t),
        Math.round(ca[1] + (cb[1] - ca[1]) * t),
        Math.round(ca[2] + (cb[2] - ca[2]) * t),
    ];
}

function drawBackground(doc) {
    doc.rect(0, 0, W, H).fill(C.black);

    for (let i = 18; i >= 0; i--) {
        const r = 320 * (i / 18);
        const lv = Math.round(8 * (i / 18));
        const col = `#${[lv + 14, lv + 16, 0].map(x => Math.min(x, 255).toString(16).padStart(2, '0')).join('')}`;
        doc.circle(W * 0.82, H * 0.18, r).fill(col);
    }

    for (let i = 14; i >= 0; i--) {
        const r = 240 * (i / 14);
        const lv = Math.round(6 * (i / 14));
        const col = `#${[lv + 12, lv + 14, 0].map(x => Math.min(x, 255).toString(16).padStart(2, '0')).join('')}`;
        doc.circle(W * 0.12, H * 0.85, r).fill(col);
    }

    doc.rect(0, 0, W, 6).fill(C.lime);
    doc.rect(0, H - 6, W, 6).fill(C.lime);
    doc.rect(0, 6, 5, H - 12).fill(C.limeDim);
    doc.rect(W - 5, 6, 5, H - 12).fill(C.limeDim);

    doc.save();
    doc.rect(22, 22, W - 44, H - 44).lineWidth(0.8).strokeColor(C.limeDim).stroke();
    doc.restore();

    [[22, 22], [W - 38, 22], [22, H - 38], [W - 38, H - 38]].forEach(([cx, cy]) => {
        doc.rect(cx, cy, 16, 16).fill(C.lime);
    });

    doc.save();
    doc.lineWidth(0.4).strokeColor(C.lime).opacity(0.12);
    for (let i = 0; i < 8; i++) {
        const offset = 30 + i * 14;
        doc.moveTo(5, offset).lineTo(offset, 5).stroke();
    }
    doc.restore();

    doc.save();
    doc.lineWidth(0.4).strokeColor(C.lime).opacity(0.12);
    for (let i = 0; i < 8; i++) {
        const offset = 30 + i * 14;
        doc.moveTo(W - 5, H - offset).lineTo(W - offset, H - 5).stroke();
    }
    doc.restore();

    // Separator lines
    doc.save();
    doc.lineWidth(0.6).strokeColor(C.lime).opacity(0.5);
    doc.moveTo(50, 118).lineTo(W - 50, 118).stroke();
    doc.restore();

    doc.save();
    doc.lineWidth(0.6).strokeColor(C.lime).opacity(0.5);
    doc.moveTo(50, H - 125).lineTo(W - 50, H - 125).stroke();
    doc.restore();

    [[50, 118], [W - 50, 118], [50, H - 125], [W - 50, H - 125]].forEach(([dx, dy]) => {
        doc.circle(dx, dy, 3).fill(C.lime);
    });

    // Logo
    const logoX = W / 2 - 95, logoY = 34, logoW = 190, logoH = 40;
    doc.save();
    roundRect(doc, logoX, logoY, logoW, logoH, 10);
    doc.fill(C.dark2);
    doc.restore();

    doc.rect(logoX, logoY, 5, logoH).fill(C.lime);

    let logoDrawn = false;
    try {
        const logoPath = resolveBackendAssetPath("assets", "logo_dryukr.png");
        if (logoPath) {
            doc.image(logoPath, logoX + 12, logoY + 6, { height: logoH - 12 });
            logoDrawn = true;
        }
    } catch (e) { }

    if (!logoDrawn) {
        doc.font('Helvetica-Bold').fontSize(22).fillColor(C.lime);
        doc.text('FMPG', logoX + 12, logoY + 7, { lineBreak: false });
    }

    doc.font('Helvetica-Bold').fontSize(16).fillColor(C.lime);
    doc.text('FMPG', logoX + 55, logoY + 12, { lineBreak: false });

    doc.circle(W / 2, logoY - 10, 2.5).fill(C.lime);
}

function drawQR(doc, url, qrX, qrY, qrSize) {
    const qrData = QRCode.create(url, { errorCorrectionLevel: 'H' });
    const modules = qrData.modules.size;
    const pad = qrSize * 0.028;
    const effective = qrSize - pad * 2;
    const modSize = effective / modules;

    roundRect(doc, qrX, qrY, qrSize, qrSize, 6);
    doc.fill(C.black);

    doc.save();
    roundRect(doc, qrX, qrY, qrSize, qrSize, 6);
    doc.lineWidth(1).strokeColor(C.limeDim).stroke();
    doc.restore();

    const getCol = (row) => lerpColor(C.lime, C.white, row / (modules - 1));

    const drawEye = (row, col) => {
        const cx = qrX + pad + (col + 3.5) * modSize;
        const cy = qrY + pad + (row + 3.5) * modSize;
        const ec = getCol(row + 3.5);
        doc.circle(cx, cy, 3.5 * modSize).fill(ec);
        doc.circle(cx, cy, 2.5 * modSize).fill(C.black);
        doc.circle(cx, cy, 1.5 * modSize).fill(ec);
    };

    for (let r = 0; r < modules; r++) {
        for (let c = 0; c < modules; c++) {
            if (!qrData.modules.get(r, c)) continue;
            const tl = r < 7 && c < 7;
            const tr = r < 7 && c >= modules - 7;
            const bl = r >= modules - 7 && c < 7;
            if (tl || tr || bl) {
                if (r === 0 && c === 0) drawEye(0, 0);
                if (r === 0 && c === modules - 7) drawEye(0, modules - 7);
                if (r === modules - 7 && c === 0) drawEye(modules - 7, 0);
                continue;
            }
            const cx = qrX + pad + c * modSize + modSize / 2;
            const cy = qrY + pad + r * modSize + modSize / 2;
            doc.circle(cx, cy, (modSize / 2) * 0.92).fill(getCol(r));
        }
    }

    const bLen = 10, bW = 1.5, bp = -5;
    [
        [qrX + bp, qrY + bp, 1, 1],
        [qrX + qrSize - bp, qrY + bp, -1, 1],
        [qrX + bp, qrY + qrSize - bp, 1, -1],
        [qrX + qrSize - bp, qrY + qrSize - bp, -1, -1],
    ].forEach(([cx, cy, dx, dy]) => {
        doc.save();
        doc.lineWidth(bW).strokeColor(C.lime);
        doc.moveTo(cx, cy).lineTo(cx + dx * bLen, cy).stroke();
        doc.moveTo(cx, cy).lineTo(cx, cy + dy * bLen).stroke();
        doc.restore();
    });
}

function drawSignatureBlock(doc, x, y, label, name) {
    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.white);
    doc.text(name, x, y - 12, { lineBreak: false, width: 130 });

    doc.save();
    doc.lineWidth(0.8).strokeColor(C.limeDim);
    doc.moveTo(x, y).lineTo(x + 130, y).stroke();
    doc.restore();

    doc.circle(x, y, 2.5).fill(C.lime);

    doc.font('Helvetica').fontSize(8).fillColor(C.gray1);
    doc.text(label, x, y + 6, { lineBreak: false, width: 130 });
}

async function generateCertificatePDFBuffer(certificate) {
    console.log(`Generating stylized certificate for: ${certificate.name}`);

    const {
        _id,
        name,
        jobrole: role,
        domain: department,
        fromDate,
        toDate,
    } = certificate;

    let verifyBase = (process.env.FRONTEND_URL || 'https://fmpg.vercel.app').replace(/\/+$/, '');
    // Ensure localhost uses http to avoid SSL errors during development
    if (verifyBase.includes('localhost')) {
        verifyBase = verifyBase.replace('https://', 'http://');
    }
    const verifyUrl = `${verifyBase}/verify/${_id}`;

    const fmt = (d) => d
        ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
        : '—';

    const doc = new PDFDocument({
        size: [W, H],
        layout: 'landscape',
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        autoFirstPage: false,
        info: {
            Title: `Internship Certificate - ${name}`,
            Author: 'FMPG',
            Subject: 'Internship Completion Certificate',
        },
    });

    doc.addPage({ size: [W, H], margins: { top: 0, bottom: 0, left: 0, right: 0 } });

    const buffers = [];
    doc.on('data', (b) => buffers.push(b));

    drawBackground(doc);

    // ── HEADER ──────────────────────────────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(24).fillColor(C.white);
    textCenter(doc, 'INTERNSHIP COMPLETION CERTIFICATE', 132);

    const titleStr = 'INTERNSHIP COMPLETION CERTIFICATE';
    doc.font('Helvetica-Bold').fontSize(24);
    const titleW = doc.widthOfString(titleStr);
    doc.save();
    doc.lineWidth(1.5).strokeColor(C.lime);
    doc.moveTo((W - titleW) / 2, 162).lineTo((W + titleW) / 2, 162).stroke();
    doc.restore();

    doc.font('Helvetica').fontSize(10).fillColor(C.gray1);
    textCenter(doc, 'Presented by FMPG · fmpg.in', 170);

    // ── BODY ────────────────────────────────────────────────────────────────────
    doc.font('Helvetica').fontSize(12).fillColor(C.gray1);
    textCenter(doc, 'This is to certify that', 196);

    doc.font('Helvetica-Bold').fontSize(40).fillColor(C.lime);
    textCenter(doc, name, 212);

    doc.font('Helvetica-Bold').fontSize(40);
    const nameW = doc.widthOfString(name);
    doc.save();
    doc.lineWidth(1).strokeColor(C.limeDim).opacity(0.6);
    doc.moveTo((W - nameW) / 2, 260).lineTo((W + nameW) / 2, 260).stroke();
    doc.restore();

    doc.font('Helvetica').fontSize(11).fillColor(C.gray1);
    textCenter(doc, 'has successfully completed the internship program in', 268);

    const roleLabel = `${role}  ·  ${department}`;
    doc.font('Helvetica-Bold').fontSize(12).fillColor(C.lime);
    const roleW = doc.widthOfString(roleLabel);
    const pillX = (W - roleW - 40) / 2;
    const pillY = 284;

    roundRect(doc, pillX, pillY, roleW + 40, 24, 12);
    doc.fill(C.dark3);
    doc.save();
    roundRect(doc, pillX, pillY, roleW + 40, 24, 12);
    doc.lineWidth(0.8).strokeColor(C.limeDim).stroke();
    doc.restore();

    doc.font('Helvetica-Bold').fontSize(12).fillColor(C.lime);
    doc.text(roleLabel, pillX + 20, pillY + 6, { lineBreak: false });

    doc.font('Helvetica').fontSize(10).fillColor(C.gray1);
    const durLine = `Duration :  ${fmt(fromDate)}  -  ${fmt(toDate)}`;
    textCenter(doc, durLine, 320);

    doc.font('Helvetica').fontSize(9).fillColor(C.gray2);
    textCenter(doc, 'in recognition of outstanding commitment, professionalism, and dedication to learning.', 336);

    // ── FOOTER ──────────────────────────────────────────────────────────────────
    const qrSize = 68;
    const qrX = 50;
    const qrY = H - 110;
    drawQR(doc, verifyUrl, qrX, qrY, qrSize);

    doc.font('Helvetica').fontSize(7).fillColor(C.gray2);
    doc.text('Scan to verify', qrX, qrY + qrSize + 8, { lineBreak: false, width: qrSize, align: 'center' });

    const metaX = 175;
    const metaStartY = H - 104;

    const metaRows = [
        ['Certificate ID', `FMPG-${_id}`],
        ['Verify At', verifyUrl],
    ];

    metaRows.forEach(([label, value], i) => {
        const rowY = metaStartY + i * 18;
        doc.font('Helvetica').fontSize(8).fillColor(C.gray2);
        doc.text(label + ' :', metaX, rowY, { lineBreak: false });
        doc.font('Helvetica-Bold').fontSize(8).fillColor(C.offWhite);
        // Reduced width to avoid overlap with signatures
        doc.text(value, metaX + 80, rowY, { lineBreak: false, width: 250, ellipsis: true });
    });

    doc.rect(metaX - 12, metaStartY, 2, 32).fill(C.limeDim);

    drawSignatureBlock(doc, W - 310, metaStartY + 4, 'Founder & Director', 'Vivek Kumar');
    drawSignatureBlock(doc, W - 160, metaStartY + 4, 'HR Manager', 'FMPG Team');

    doc.font('Helvetica').fontSize(7).fillColor(C.gray2);
    doc.text(
        'This is a digitally issued certificate and is valid without a physical signature. Verify at fmpg.in/verify',
        50,
        H - 32,
        { lineBreak: false, width: W - 100, align: 'center' }
    );

    doc.end();

    return new Promise((resolve, reject) => {
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);
    });
}


exports.sendCertificateEmail = async (req, res) => {
    console.log(`Send email`);
    try {
        const { id } = req.params;
        const { recipientEmail, subject, message } = req.body;

        const certId = normalizeCertificateLookupId(id);
        let certificate;

        if (mongoose.Types.ObjectId.isValid(certId)) {
            certificate = await Certificate.findById(certId);
        } else if (certId.length >= 4) {
            certificate = await Certificate.findOne({
                $expr: {
                    $regexMatch: {
                        input: { $toString: "$_id" },
                        regex: certId + "$",
                        options: "i"
                    }
                }
            });
        }

        if (!certificate) {
            console.log(`Cert not found: ${certId}`);
            return res.status(404).json({ message: "Certificate not found" });
        }

        const emailToSend = recipientEmail || certificate.recipientEmail;
        if (!emailToSend) {
            console.log(`No email`);
            return res.status(400).json({ message: "Recipient email is required" });
        }

        if (recipientEmail && recipientEmail !== certificate.recipientEmail) {
            certificate.recipientEmail = recipientEmail;
            await certificate.save();
        }

        // Generate PDF in memory for email
        console.log(`Generating PDF for email: ${id}`);
        const pdfBuffer = await generateCertificatePDFBuffer(certificate);

        // Send email with buffer attachment
        await sendCertificateByEmailBuffer(
            emailToSend,
            subject || `Certificate: ${certificate.jobrole}`,
            message || `Congrats on completing your internship in ${certificate.domain}!`,
            certificate.name,
            pdfBuffer,
            `certificate-${certificate._id}.pdf`
        );

        try { await logAudit({ req, action: "EMAIL", resourceEntity: "Certificate", resourceId: certificate._id, changes: { recipientEmail: emailToSend } }); } catch (err) { }

        console.log(`Email sent: ${emailToSend}`);
        res.status(200).json({
            message: "Certificate emailed successfully",
            certificateId: certificate._id,
            sentTo: emailToSend
        });
    } catch (error) {
        console.error("Error:", error.message);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// New buffer-based email function for serverless compatibility
async function sendCertificateByEmailBuffer(to, subject, message, recipientName, pdfBuffer, filename) {
    console.log(`Email to: ${to}`);
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to,
            replyTo: process.env.REPLY_TO_EMAIL || process.env.EMAIL_USER,
            subject,
            html: getCertificateTemplate(recipientName, 'Certificate of Completion', message || 'Achievement successfully verified'),
            attachments: [
                {
                    filename: filename,
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }
            ]
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`Sent: ${info.messageId}`);
        return info;
    } catch (error) {
        console.error(`Error:`, error);
        throw error;
    }
}


// Utility function to clean up old PDFs (can be called manually if needed)
exports.cleanupOldPDFs = async () => {
    console.log('Starting PDF cleanup...');
    try {
        const certDir = path.join(__dirname, "../uploads/certificates");
        const offerDir = path.join(__dirname, "../uploads/offers");

        const cleanupDir = (dirPath, filePrefix = '') => {
            if (fs.existsSync(dirPath)) {
                const files = fs.readdirSync(dirPath);

                files.forEach(file => {
                    if (file.endsWith('.pdf') && file.startsWith(filePrefix)) {
                        const filePath = path.join(dirPath, file);
                        fs.unlinkSync(filePath);
                        console.log(`Cleaned up PDF: ${file}`);
                    }
                });
            }
        };

        cleanupDir(certDir);
        cleanupDir(offerDir, 'offer_');

        console.log('PDF cleanup completed');
    } catch (error) {
        console.error('Error during PDF cleanup:', error);
    }
};

// Delete certificate - Super Admin only
exports.deleteCertificate = async (req, res) => {
    try {
        const { id } = req.params;
        const normalizedId = normalizeCertificateLookupId(id);

        let query = {};
        if (mongoose.Types.ObjectId.isValid(id)) {
            query = { _id: id };
        } else if (mongoose.Types.ObjectId.isValid(normalizedId)) {
            query = { _id: normalizedId };
        } else {
            return res.status(400).json({ message: "Invalid certificate ID format" });
        }

        const certificate = await Certificate.findOne(query);
        if (!certificate) {
            return res.status(404).json({ message: "Certificate not found" });
        }

        await Certificate.deleteOne({ _id: certificate._id });

        // Log audit trail
        await logAudit({
            req,
            action: "DELETE",
            resourceEntity: "Certificate",
            resourceId: certificate._id,
            changes: {
                deletedCertificate: {
                    name: certificate.name,
                    domain: certificate.domain,
                    jobrole: certificate.jobrole,
                    recipientEmail: certificate.recipientEmail
                }
            }
        });

        res.status(200).json({ message: "Certificate deleted successfully", certificateId: certificate._id });
    } catch (error) {
        console.error("Delete certificate error:", error);
        res.status(500).json({ message: "Server error deleting certificate", error: error.message });
    }
};