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
const { checkCooldown, recordSend } = require("../utils/cooldownManager");
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
// Certificate PDF (PDFKit-native, no canvas dependency)
// ------------------------------------------------------------
// A4 landscape. The statement is set left-aligned on white paper, and a
// deep-green panel on the right carries the logo, the verification seal and
// the certificate details. Colours, fonts and issuer details are the
// constants directly below, so the look can be changed in one place.
// ============================================================

const W = 841.89; // A4 landscape, in PDF points
const H = 595.28;

const THEME = {
    ink: '#14231d',           // title, recipient name, values
    body: '#3f4c46',          // running text
    muted: '#6d7973',         // labels and fine print
    rule: '#dde3df',          // hairlines on paper
    accent: '#b08a3e',        // brass, on paper
    panel: '#123a2e',         // verification panel
    panelText: '#ffffff',
    panelMuted: '#a9c1b7',
    panelRule: '#2d5647',     // hairlines on the panel
    panelAccent: '#d9bd7c',   // brass, on the panel
    sealPaper: '#ffffff',     // disc behind the QR code
};

// Built-in PDF fonts: nothing to bundle, so this works on serverless hosts.
// They only cover Latin characters. To use a brand typeface, register the font
// file with doc.registerFont() in generateCertificatePDFBuffer and name it here.
const FONT = {
    sans: 'Helvetica',
    sansBold: 'Helvetica-Bold',
    serif: 'Times-Roman',
    serifItalic: 'Times-Italic',
};

// PDFKit positions text by the top of its line box. These ascents (as a
// fraction of the font size) let the layout place text on a baseline instead,
// which keeps text of different sizes aligned. Add an entry for any other
// font named in FONT; 0.72 is assumed otherwise.
const ASCENT = {
    'Helvetica': 0.718,
    'Helvetica-Bold': 0.718,
    'Times-Roman': 0.683,
    'Times-Italic': 0.683,
};

const ISSUER = {
    name: 'FMPG',
    website: 'fmpg.in',
    logoAsset: ['assets', 'logo_dryukr.png'],
    signatories: [
        { name: 'Vivek Kumar', title: 'Founder & Director' },
        { name: 'FMPG Team', title: 'HR Manager' },
    ],
};

// Page geometry
const PANEL_W = 244;
const PANEL_X = W - PANEL_W;
const PANEL_PAD = 28;
const MARGIN = 60;                          // left edge of the statement column
const CONTENT_W = PANEL_X - MARGIN - 56;    // width of the statement column

// Recipient name: one line at up to NAME_MAX, shrinking to NAME_MIN, after
// which it is set on two lines.
const NAME_MAX = 46;
const NAME_MIN = 30;
const NAME_WRAPPED_MAX = 38;
const NAME_TRACKING = -0.4;

function textWidth(doc, str, { font, size, tracking = 0 }) {
    return doc.font(font).fontSize(size).widthOfString(str, { characterSpacing: tracking });
}

// Draws a single line of text with its baseline at `baseline`, starting at x
// (or centred on x with align: 'center'). Returns the width of the line.
function drawText(doc, str, x, baseline, { font, size, color, tracking = 0, align = 'left' }) {
    const width = textWidth(doc, str, { font, size, tracking });
    const left = align === 'center' ? x - width / 2 : x;
    doc.fillColor(color);
    doc.text(str, left, baseline - (ASCENT[font] || 0.72) * size, { lineBreak: false, characterSpacing: tracking });
    return width;
}

// Draws a horizontal hairline.
function drawRule(doc, x, y, width, color, weight = 0.6) {
    doc.save();
    doc.lineWidth(weight).strokeColor(color);
    doc.moveTo(x, y).lineTo(x + width, y).stroke();
    doc.restore();
}

// Shortens `str` with an ellipsis until it fits `maxWidth` in the given style.
function fitText(doc, str, maxWidth, style) {
    if (textWidth(doc, str, style) <= maxWidth) return str;
    let keep = 0;
    let limit = str.length;
    while (keep < limit) {
        const mid = Math.ceil((keep + limit) / 2);
        if (textWidth(doc, `${str.slice(0, mid)}…`, style) <= maxWidth) keep = mid; else limit = mid - 1;
    }
    return `${str.slice(0, keep).trimEnd()}…`;
}

// Breaks `str` into at most `maxLines` lines no wider than `maxWidth`. Whatever
// does not fit on the last line is cut short with an ellipsis.
function wrapLines(doc, str, maxWidth, style, maxLines) {
    const words = String(str).trim().split(/\s+/);
    const lines = [];
    let line = words.shift() || '';
    while (words.length && lines.length < maxLines - 1) {
        const next = `${line} ${words[0]}`;
        if (textWidth(doc, next, style) <= maxWidth) {
            line = next;
            words.shift();
        } else {
            lines.push(line);
            line = words.shift();
        }
    }
    lines.push([line, ...words].join(' '));
    return lines.map((l) => fitText(doc, l, maxWidth, style));
}

// Works out how to set the recipient's name in a column `maxWidth` wide.
// Returns the font size and the one or two lines to draw.
function layoutName(doc, name, maxWidth) {
    const style = (size) => ({ font: FONT.serif, size, tracking: NAME_TRACKING });

    for (let size = NAME_MAX; size >= NAME_MIN; size--) {
        if (textWidth(doc, name, style(size)) <= maxWidth) return { size, lines: [name] };
    }

    // Too long for one line: break between words where the two lines come out
    // most even, at the largest size at which both fit.
    const words = name.split(/\s+/);
    for (let size = NAME_WRAPPED_MAX; size >= NAME_MIN; size--) {
        let best = null;
        for (let i = 1; i < words.length; i++) {
            const lines = [words.slice(0, i).join(' '), words.slice(i).join(' ')];
            const firstWidth = textWidth(doc, lines[0], style(size));
            if (firstWidth > maxWidth) break;
            const widest = Math.max(firstWidth, textWidth(doc, lines[1], style(size)));
            if (widest <= maxWidth && (!best || widest < best.widest)) best = { lines, widest };
        }
        if (best) return { size, lines: best.lines };
    }

    // Still too long: fill the first line and cut the second short.
    return { size: NAME_MIN, lines: wrapLines(doc, name, maxWidth, style(NAME_MIN), 2) };
}

// Deterministic random numbers seeded from a string (FNV-1a hash feeding
// mulberry32), so a certificate always renders the same seal.
function seededRandom(seed) {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
        h ^= seed.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    let a = h >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Draws the modules of a QR code as plain squares into a side x side square.
// The caller leaves the clear space scanners need around it.
function drawQRModules(doc, qr, x, y, side, color) {
    const count = qr.modules.size;
    const cell = side / count;

    // All modules go into one path with one fill. Filling them one by one
    // leaves hairline seams between neighbours in some PDF viewers.
    for (let row = 0; row < count; row++) {
        let runStart = -1;
        for (let col = 0; col <= count; col++) {
            const dark = col < count && qr.modules.get(row, col);
            if (dark && runStart < 0) runStart = col;
            if (!dark && runStart >= 0) {
                doc.rect(x + runStart * cell, y + row * cell, (col - runStart) * cell, cell);
                runStart = -1;
            }
        }
    }
    doc.fill(color);
}

// Verification seal: a guilloche ring (the woven line-work of banknotes and
// share certificates) around the QR code. The weave and the tick marks outside
// it are derived from the certificate ID, so every certificate carries its own
// pattern.
function drawSeal(doc, cx, cy, radius, certificateId, verifyUrl) {
    const id = String(certificateId);
    const rand = seededRandom(id);
    const between = (min, max) => min + Math.floor(rand() * (max - min + 1));
    const round = (v) => Math.round(v * 100) / 100;

    const discR = radius * 0.64;            // white disc holding the QR code
    const bandIn = discR + 6;
    const bandOut = radius - 12;
    const bandMid = (bandIn + bandOut) / 2;
    const bandAmp = (bandOut - bandIn) / 2;

    // Guilloche: two mirrored ribbons, each a bundle of near-parallel waves.
    const lobes = between(6, 11);                       // waves around the ring
    const strands = between(8, 11);                     // lines per ribbon
    const spread = (1.25 + rand() * 0.5) / strands;     // phase step between lines
    const scallops = rand() < 0.5 ? lobes * 2 : 0;      // optional breathing of the width
    const turn = rand() * Math.PI * 2;
    const steps = 360;

    doc.save();
    doc.lineWidth(0.38).strokeColor(THEME.panelAccent).lineJoin('round');
    [1, -1].forEach((side) => {
        for (let s = 0; s < strands; s++) {
            const phase = (s - (strands - 1) / 2) * spread;
            for (let i = 0; i <= steps; i++) {
                const t = (Math.PI * 2 * i) / steps;
                const swell = scallops ? 0.8 + 0.2 * Math.cos(scallops * (t + turn)) : 1;
                const r = bandMid + side * bandAmp * swell * Math.sin(lobes * (t + turn) + phase);
                const px = round(cx + r * Math.cos(t));
                const py = round(cy + r * Math.sin(t));
                if (i === 0) doc.moveTo(px, py); else doc.lineTo(px, py);
            }
        }
    });
    doc.stroke();

    // Rings framing the band
    doc.lineWidth(0.6);
    doc.circle(cx, cy, bandIn - 2.5).stroke();
    doc.circle(cx, cy, radius).stroke();

    // Tick ring: the certificate ID written out as 96 bits, clockwise from the
    // top. A long tick is a 1, a short tick is a 0.
    const hex = /^[0-9a-f]{24}$/i.test(id) ? id : null;
    const bitAt = (i) => (hex
        ? (parseInt(hex[i >> 2], 16) >> (3 - (i & 3))) & 1
        : Math.round(rand()));
    const tickOuter = radius - 3;
    doc.lineWidth(0.7);
    for (let i = 0; i < 96; i++) {
        const t = (Math.PI * 2 * i) / 96 - Math.PI / 2;
        const tickInner = tickOuter - (bitAt(i) ? 5.5 : 2.2);
        doc.moveTo(round(cx + tickInner * Math.cos(t)), round(cy + tickInner * Math.sin(t)))
            .lineTo(round(cx + tickOuter * Math.cos(t)), round(cy + tickOuter * Math.sin(t)));
    }
    doc.stroke();
    doc.restore();

    // QR code on a white disc, sized so that each corner of the code keeps four
    // modules of clear space, in every direction, before the edge of the disc.
    // Level Q tolerates 25% damage and gives larger modules than H would.
    const qr = QRCode.create(verifyUrl, { errorCorrectionLevel: 'Q' });
    const qrSide = (2 * discR) / (Math.SQRT2 + 8 / qr.modules.size);
    doc.circle(cx, cy, discR).fill(THEME.sealPaper);
    drawQRModules(doc, qr, cx - qrSide / 2, cy - qrSide / 2, qrSide, THEME.panel);

    // In a PDF viewer, clicking the seal opens the verification page.
    doc.link(cx - radius, cy - radius, radius * 2, radius * 2, verifyUrl);
}

// Logo and wordmark at the top of the panel. If the logo file is missing or
// unreadable, the wordmark is drawn on its own.
function drawBrand(doc, x, y, height) {
    let textX = x;
    let needsWordmark = true;
    try {
        const logo = doc.openImage(resolveBackendAssetPath(...ISSUER.logoAsset));
        const ratio = logo.width / logo.height;
        const width = Math.min(height * ratio, PANEL_W - PANEL_PAD * 2);
        doc.image(logo, x, y, { fit: [width, height], valign: 'center' });
        // A wide logo already spells the name out; a square one is only the mark.
        needsWordmark = ratio < 1.8;
        textX = x + width + 10;
    } catch (e) {
        console.warn(`Certificate logo not drawn: ${e.message}`);
    }

    if (needsWordmark) {
        drawText(doc, ISSUER.name, textX, y + height / 2 + 5.6, {
            font: FONT.sansBold, size: 16, color: THEME.panelText, tracking: 0.8,
        });
    }
}

function drawSignatureBlock(doc, x, y, width, { name, title }) {
    const nameStyle = { font: FONT.serifItalic, size: 16 };
    const titleStyle = { font: FONT.sans, size: 8.5 };

    drawText(doc, fitText(doc, name, width, nameStyle), x, y - 9, { ...nameStyle, color: THEME.ink });

    drawRule(doc, x, y, width, THEME.ink);
    drawText(doc, fitText(doc, title, width, titleStyle), x, y + 14, { ...titleStyle, color: THEME.muted });
}

async function generateCertificatePDFBuffer(certificate) {
    console.log(`Generating certificate PDF for: ${certificate.name}`);

    const { _id, fromDate, toDate } = certificate;

    // Tidy the text fields: single spaces, and a length cap far beyond what fits
    // on the page, so layout time stays bounded whatever is stored.
    const clean = (value) => String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, 300);
    const name = clean(certificate.name);
    const role = clean(certificate.jobrole) || '—';
    const department = clean(certificate.domain) || '—';

    let verifyBase = (process.env.FRONTEND_URL || 'https://fmpg.vercel.app').replace(/\/+$/, '');
    // Ensure localhost uses http to avoid SSL errors during development
    if (verifyBase.includes('localhost')) {
        verifyBase = verifyBase.replace('https://', 'http://');
    }
    const verifyUrl = `${verifyBase}/verify/${_id}`;
    const verifyPage = `${verifyBase.replace(/^https?:\/\//, '')}/verify`;

    const fmt = (d) => d
        ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
        : '—';

    // Issue date: when the certificate was created, or failing that the time
    // encoded in its ObjectId.
    const issuedOn = certificate.createdAt
        || (_id && typeof _id.getTimestamp === 'function' ? _id.getTimestamp() : null);

    const doc = new PDFDocument({
        autoFirstPage: false,
        info: {
            Title: `Internship Certificate - ${name}`,
            Author: ISSUER.name,
            Subject: 'Internship Completion Certificate',
        },
    });

    const buffers = [];
    const finished = new Promise((resolve, reject) => {
        doc.on('data', (b) => buffers.push(b));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);
    });

    doc.addPage({ size: [W, H], margins: { top: 0, bottom: 0, left: 0, right: 0 } });

    // HEADER
    drawText(doc, 'Internship Completion Certificate', MARGIN, 70, {
        font: FONT.sansBold, size: 15, color: THEME.ink, tracking: 0.2,
    });
    drawText(doc, `Presented by ${ISSUER.name} · ${ISSUER.website}`, MARGIN, 88, {
        font: FONT.sans, size: 9.5, color: THEME.muted,
    });

    // BODY
    const certifyStyle = { font: FONT.serifItalic, size: 15, color: THEME.muted };
    const statementStyle = { font: FONT.sans, size: 11, color: THEME.body };
    const labelStyle = { font: FONT.sans, size: 8.5, color: THEME.muted };
    const valueStyle = { font: FONT.sansBold, size: 10.5, color: THEME.ink };
    const STATEMENT_LEADING = 17;
    const VALUE_LEADING = 14;
    const ROW_H = 24;           // height of a one-line row in the details table
    const LABEL_W = 78;         // width of the table's label column

    const nameLayout = layoutName(doc, name, CONTENT_W);
    const nameStyle = { font: FONT.serif, size: nameLayout.size, color: THEME.ink, tracking: NAME_TRACKING };
    const nameLeading = nameLayout.size * 1.12;

    const statementLines = wrapLines(
        doc,
        `has successfully completed the internship program at ${ISSUER.name}. `
        + 'This certificate is awarded in recognition of outstanding commitment, '
        + 'professionalism, and dedication to learning.',
        Math.min(CONTENT_W, 430),
        statementStyle,
        4
    );

    // Long roles and domains run onto a second line rather than being cut off.
    const facts = [
        ['Role', role],
        ['Domain', department],
        ['Duration', `${fmt(fromDate)} – ${fmt(toDate)}`],
    ].map(([label, value]) => {
        const lines = wrapLines(doc, value, CONTENT_W - LABEL_W, valueStyle, 2);
        return { label, lines, height: ROW_H + (lines.length - 1) * VALUE_LEADING };
    });
    const factsHeight = facts.reduce((sum, row) => sum + row.height, 0);

    // Vertical steps from one element to the next, top to bottom.
    const step = {
        toCertify: 11,
        toName: 16 + nameLayout.size * 0.68,
        toRule: nameLayout.size * 0.22 + 10,
        toStatement: 30,
        toFacts: 26,
    };
    const bodyHeight = step.toCertify + step.toName + (nameLayout.lines.length - 1) * nameLeading
        + step.toRule + step.toStatement + (statementLines.length - 1) * STATEMENT_LEADING
        + step.toFacts + factsHeight;

    // Centre the body between the header and the signatures.
    const BODY_TOP = 112, BODY_BOTTOM = 440;
    let y = BODY_TOP + Math.max(0, (BODY_BOTTOM - BODY_TOP - bodyHeight) / 2);

    y += step.toCertify;
    drawText(doc, 'This is to certify that', MARGIN, y, certifyStyle);

    y += step.toName;
    nameLayout.lines.forEach((line, i) => {
        if (i > 0) y += nameLeading;
        drawText(doc, line, MARGIN, y, nameStyle);
    });

    y += step.toRule;
    doc.rect(MARGIN, y, 44, 2).fill(THEME.accent);

    y += step.toStatement;
    statementLines.forEach((line, i) => {
        if (i > 0) y += STATEMENT_LEADING;
        drawText(doc, line, MARGIN, y, statementStyle);
    });

    y += step.toFacts;
    facts.forEach((row) => {
        drawRule(doc, MARGIN, y, CONTENT_W, THEME.rule);
        drawText(doc, row.label, MARGIN, y + 15.5, labelStyle);
        row.lines.forEach((line, i) => {
            drawText(doc, line, MARGIN + LABEL_W, y + 15.5 + i * VALUE_LEADING, valueStyle);
        });
        y += row.height;
    });
    drawRule(doc, MARGIN, y, CONTENT_W, THEME.rule);

    // ── SIGNATURES ──────────────────────────────────────────────────────────────
    const SIGN_W = 168;
    ISSUER.signatories.forEach((signatory, i) => {
        drawSignatureBlock(doc, MARGIN + i * (SIGN_W + 40), 486, SIGN_W, signatory);
    });

    const FOOT_BASELINE = 542;
    drawText(doc, 'This is a digitally issued certificate and is valid without a physical signature.', MARGIN, FOOT_BASELINE, {
        font: FONT.sans, size: 7.5, color: THEME.muted,
    });

    // ── VERIFICATION PANEL ──────────────────────────────────────────────────────
    doc.rect(PANEL_X, 0, PANEL_W, H).fill(THEME.panel);

    const panelLeft = PANEL_X + PANEL_PAD;
    const panelInner = PANEL_W - PANEL_PAD * 2;
    const panelCentre = PANEL_X + PANEL_W / 2;

    drawBrand(doc, panelLeft, 50, 28);

    const sealRadius = panelInner / 2;
    const sealY = 246;
    drawSeal(doc, panelCentre, sealY, sealRadius, _id, verifyUrl);
    drawText(doc, 'Scan to verify', panelCentre, sealY + sealRadius + 20, {
        font: FONT.sans, size: 8.5, color: THEME.panelMuted, align: 'center',
    });

    const META_PITCH = 34;
    const meta = [
        { label: 'Certificate ID', value: `FMPG-${_id}` },
        issuedOn && { label: 'Issued on', value: fmt(issuedOn) },
        { label: 'Verify at', value: verifyPage, link: verifyUrl },
    ].filter(Boolean);
    meta.forEach(({ label, value, link }, i) => {
        const baseline = FOOT_BASELINE - (meta.length - 1 - i) * META_PITCH;
        const metaValueStyle = { font: FONT.sansBold, size: 9, color: THEME.panelText };
        drawRule(doc, panelLeft, baseline - 25, panelInner, THEME.panelRule);
        drawText(doc, label, panelLeft, baseline - 13, { font: FONT.sans, size: 7.5, color: THEME.panelMuted });
        const width = drawText(doc, fitText(doc, value, panelInner, metaValueStyle), panelLeft, baseline, metaValueStyle);
        if (link) doc.link(panelLeft, baseline - 9, width, 12, link);
    });

    doc.end();

    return finished;
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

        // Enforce 30-second cooldown per recipient to prevent accidental multiple sends
        const cooldown = checkCooldown(emailToSend, 30);
        if (!cooldown.allowed) {
            return res.status(429).json({
                message: `Please wait ${cooldown.remainingSeconds} seconds before sending another email to this recipient.`,
                remainingSeconds: cooldown.remainingSeconds
            });
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
        recordSend(emailToSend);

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