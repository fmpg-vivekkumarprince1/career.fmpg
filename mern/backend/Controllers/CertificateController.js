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

// Optional details of an internship. Each one is printed on the certificate
// only when it is given, so existing certificates are unaffected. They must
// also exist on the Certificate schema: Mongoose drops fields it does not know.
const OPTIONAL_TEXT_FIELDS = [
    "recipientAffiliation",   // programme and/or college
    "recipientId",            // roll, enrolment or intern number, with its label: "Roll no. 23BCS1045"
    "project",                // project or area of work
    "supervisorName",
    "supervisorPosition",
    "mode",                   // "On-site", "Remote", "Hybrid"
    "performance",            // rating in the organisation's own words: "Excellent"
    "summary",                // one or two sentences on the work done
    "issuePlace",             // place of issue, printed after the issue date
];

exports.issue = async (req, res) => {
    console.log("Cert: new");
    try {
        const { name, domain, fromDate, toDate, issuedBy, email, hours } = req.body;
        // The position held is stored as jobrole; "position" is accepted as another name for it.
        const jobrole = req.body.jobrole || req.body.position;
        console.log(`For: ${name}`);

        if (!name || !domain || !jobrole || !fromDate || !toDate) {
            console.log("Missing fields");
            return res.status(400).json({ message: "All fields are required" });
        }

        // Total hours worked, printed beside the duration.
        const hasHours = hours !== undefined && hours !== null && hours !== "";
        if (hasHours && !(Number(hours) > 0)) {
            console.log("Bad hours");
            return res.status(400).json({ message: "Hours must be a number greater than zero" });
        }

        // Optional text fields are stored only when something was entered.
        const details = {};
        OPTIONAL_TEXT_FIELDS.forEach((field) => {
            const value = typeof req.body[field] === "string" ? req.body[field].trim() : "";
            if (value) details[field] = value;
        });
        if (hasHours) details.hours = Number(hours);

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
            ...details,
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
// A4 landscape. The statement is set left-aligned on white paper: the
// recipient's name, the position held on a line of its own, a short summary
// and a table of details. A deep-green panel on the right carries the logo,
// the issuer's details, the verification seal and the certificate details.
// Colours, fonts and issuer details are the constants directly below, so the
// look can be changed in one place.
//
// Only name, jobrole, domain and the two dates are needed. Every other field
// (affiliation, roll number, project, supervisor, mode, performance, hours,
// summary, place of issue) is printed when the certificate has it and leaves
// no gap when it does not.
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

    // Printed under the logo, one line each. A line left empty is not printed.
    address: '',              // city or registered office
    registration: '',         // registration number with its label, e.g. 'CIN U00000XX0000PTC000000'
    contact: '',              // email or phone a verifier can use

    // Place of issue, printed after the issue date. A certificate's own
    // issuePlace takes precedence.
    place: '',

    // Image of the organisation's seal or stamp, drawn to the right of the
    // signatures, e.g. ['assets', 'stamp.png']. With null that space stays
    // clear for a physical stamp.
    stampAsset: null,

    signatories: [
        { name: 'Vivek Kumar', position: 'Founder & Director' },
        { name: 'FMPG Team', position: 'HR Manager' },
    ],

    // Printed after the statement when a certificate has no summary of its own.
    defaultSummary: 'This certificate is awarded in recognition of outstanding commitment, '
        + 'professionalism, and dedication to learning.',

    // Closing line at the foot of the page.
    note: 'This is a digitally issued certificate and is valid without a physical signature.',
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

// A signatory: the name above the line, the position held below it.
// ("title" is still read, for signatories written before it was renamed.)
function drawSignatureBlock(doc, x, y, width, { name, position, title }) {
    const nameStyle = { font: FONT.serifItalic, size: 16 };
    const positionStyle = { font: FONT.sans, size: 8.5 };

    drawText(doc, fitText(doc, name, width, nameStyle), x, y - 9, { ...nameStyle, color: THEME.ink });

    drawRule(doc, x, y, width, THEME.ink);
    drawText(doc, fitText(doc, position || title || '', width, positionStyle), x, y + 14, { ...positionStyle, color: THEME.muted });
}

// The organisation's seal or stamp, fitted into a size x size square whose
// right edge is at `right`. Skipped when no image is configured or the file
// cannot be read.
function drawStamp(doc, right, centreY, size) {
    if (!ISSUER.stampAsset) return;
    try {
        doc.image(resolveBackendAssetPath(...ISSUER.stampAsset), right - size, centreY - size / 2, {
            fit: [size, size], align: 'right', valign: 'center',
        });
    } catch (e) {
        console.warn(`Certificate stamp not drawn: ${e.message}`);
    }
}

const DAY_MS = 24 * 60 * 60 * 1000;

// A number with its unit: "12 weeks", "1 month", "480 hours".
const plural = (n, unit) => `${n} ${unit}${n === 1 ? '' : 's'}`;

// How long the internship ran, in the words people use for it: "3 months" for
// whole calendar months, otherwise weeks (a Monday-to-Friday stretch counts as
// a full week), days for a short stretch that is not close to whole weeks, and
// months again past half a year. Both dates are counted, and they are read in
// the server's time zone, the same way the certificate prints them. Returns ''
// when either date is missing or they are the wrong way round.
function describeDuration(fromDate, toDate) {
    const from = new Date(fromDate);
    const to = new Date(toDate);
    if (!fromDate || !toDate || isNaN(from) || isNaN(to)) return '';

    const firstDay = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    const dayAfter = new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1);
    const days = Math.round((dayAfter - firstDay) / DAY_MS);
    if (days < 1) return '';

    const months = (dayAfter.getFullYear() - firstDay.getFullYear()) * 12 + dayAfter.getMonth() - firstDay.getMonth();
    if (months >= 1 && dayAfter.getDate() === firstDay.getDate()) return plural(months, 'month');

    const weeks = Math.round(days / 7);
    const nearWholeWeeks = Math.abs(days - weeks * 7) <= 2;
    if (weeks < 1 || (days < 28 && !nearWholeWeeks)) return plural(days, 'day');
    if (days <= 182) return plural(weeks, 'week');
    return plural(Math.round(days / 30.44), 'month');
}

async function generateCertificatePDFBuffer(certificate) {
    console.log(`Generating certificate PDF for: ${certificate.name}`);

    const { _id, fromDate, toDate } = certificate;

    // Tidy the text fields: single spaces, and a length cap far beyond what fits
    // on the page, so layout time stays bounded whatever is stored.
    const clean = (value, max = 300) => String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
    const name = clean(certificate.name);
    const position = clean(certificate.jobrole) || '—';
    const domain = clean(certificate.domain);
    const affiliation = [clean(certificate.recipientAffiliation), clean(certificate.recipientId)].filter(Boolean).join(', ');
    const project = clean(certificate.project);
    const supervisorName = clean(certificate.supervisorName);
    const supervisorPosition = clean(certificate.supervisorPosition);
    const mode = clean(certificate.mode);
    const performance = clean(certificate.performance);
    const summary = clean(certificate.summary, 600) || ISSUER.defaultSummary;
    const place = clean(certificate.issuePlace) || ISSUER.place;
    const hours = Number(certificate.hours) > 0 ? Number(certificate.hours) : null;

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

    // The statement is one sentence set in three parts, so that the position
    // held can stand on a line of its own between them:
    //   "has successfully completed an internship at FMPG as"
    //   Full Stack Developer Intern
    //   "in Web Development, from 01 June 2026 to 21 August 2026."
    const oneDay = Boolean(fromDate && toDate) && fmt(fromDate) === fmt(toDate);
    const sentenceBefore = `has successfully completed an internship at ${ISSUER.name} as`;
    const sentenceAfter = (domain ? `in ${domain}, ` : '')
        + (oneDay ? `on ${fmt(fromDate)}.` : `from ${fmt(fromDate)} to ${fmt(toDate)}.`);

    // Duration with the total hours beside it: "12 weeks, 480 hours".
    const duration = [describeDuration(fromDate, toDate), hours && plural(hours, 'hour')].filter(Boolean).join(', ') || '—';

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
    const TEXT_W = Math.min(CONTENT_W, 430);    // measure of the running text
    const COLUMN_GAP = 28;                      // between the two columns of the details table
    const LABEL_W = 64;                         // width of a label in the details table

    const nameLayout = layoutName(doc, name, CONTENT_W);
    const nameStyle = { font: FONT.serif, size: nameLayout.size, color: THEME.ink, tracking: NAME_TRACKING };
    const nameLeading = nameLayout.size * 1.12;

    // Details table: the duration always, the rest when the certificate has them.
    // The supervisor's position goes under the name as a second, lighter line.
    const facts = [
        { label: 'Duration', value: duration },
        { label: 'Project', value: project },
        { label: 'Supervisor', value: supervisorName || supervisorPosition, detail: supervisorName ? supervisorPosition : '' },
        { label: 'Mode', value: mode },
        { label: 'Performance', value: performance },
    ].filter((fact) => fact.value);

    // Sets the body out at type scale k (1 is full size). Returns its lines,
    // each with the step down from the line before it and a function that
    // draws it at that position, and the height of the whole body. Text is
    // placed by its baseline; the accent bar and the table rows by their top.
    const composeBody = (k) => {
        const certifyStyle = { font: FONT.serifItalic, size: 15 * k, color: THEME.muted };
        const affiliationStyle = { font: FONT.serifItalic, size: 12.5 * k, color: THEME.muted };
        const statementStyle = { font: FONT.sans, size: 11 * k, color: THEME.body };
        const positionStyle = { font: FONT.serif, size: 23 * k, color: THEME.ink };
        const labelStyle = { font: FONT.sans, size: 8.5 * k, color: THEME.muted };
        const valueStyle = { font: FONT.sansBold, size: 10.5 * k, color: THEME.ink };
        const detailStyle = { font: FONT.sans, size: 9 * k, color: THEME.muted };
        const STATEMENT_LEADING = 17 * k;
        const VALUE_LEADING = 14 * k;
        const ROW_H = 24 * k;           // height of a one-line row in the details table

        const lines = [];
        const text = (step, str, style) => lines.push({ step, draw: (y) => drawText(doc, str, MARGIN, y, style) });
        // A paragraph of at most maxLines lines: `first` is the step down to
        // its first line and `leading` the step between its lines.
        const paragraph = (first, leading, str, width, style, maxLines) => {
            wrapLines(doc, str, width, style, maxLines).forEach((line, i) => text(i ? leading : first, line, style));
        };

        text(11 * k, 'This is to certify that', certifyStyle);
        nameLayout.lines.forEach((line, i) => text(i ? nameLeading : 16 * k + nameLayout.size * 0.68, line, nameStyle));
        if (affiliation) paragraph(nameLayout.size * 0.22 + 16 * k, 16 * k, affiliation, CONTENT_W, affiliationStyle, 2);
        lines.push({
            step: affiliation ? 12 * k : nameLayout.size * 0.22 + 10,
            draw: (y) => doc.rect(MARGIN, y, 44, 2).fill(THEME.accent),
        });

        paragraph(28 * k, STATEMENT_LEADING, sentenceBefore, TEXT_W, statementStyle, 2);
        paragraph(26 * k, 26 * k, position, CONTENT_W, positionStyle, 2);
        paragraph(19 * k, STATEMENT_LEADING, sentenceAfter, TEXT_W, statementStyle, 2);
        paragraph(22 * k, STATEMENT_LEADING, summary, TEXT_W, statementStyle, 4);

        // Details table, two facts to a row. A long value runs onto a second
        // line rather than being cut off, and the row grows with its tallest cell.
        const columns = facts.length > 1 ? 2 : 1;
        const columnW = (CONTENT_W - (columns - 1) * COLUMN_GAP) / columns;
        const rows = [];
        for (let i = 0; i < facts.length; i += columns) {
            const cells = facts.slice(i, i + columns).map(({ label, value, detail }) => ({
                label,
                lines: wrapLines(doc, value, columnW - LABEL_W, valueStyle, 2),
                detail: detail ? fitText(doc, detail, columnW - LABEL_W, detailStyle) : '',
            }));
            const tallest = Math.max(...cells.map((cell) => cell.lines.length + (cell.detail ? 1 : 0)));
            rows.push({ cells, height: ROW_H + (tallest - 1) * VALUE_LEADING });
        }
        rows.forEach((row, r) => lines.push({
            step: r ? rows[r - 1].height : 24 * k,
            draw: (y) => {
                drawRule(doc, MARGIN, y, CONTENT_W, THEME.rule);
                row.cells.forEach((cell, c) => {
                    const x = MARGIN + c * (columnW + COLUMN_GAP);
                    drawText(doc, cell.label, x, y + 15.5 * k, labelStyle);
                    cell.lines.forEach((line, i) => {
                        drawText(doc, line, x + LABEL_W, y + 15.5 * k + i * VALUE_LEADING, valueStyle);
                    });
                    if (cell.detail) {
                        drawText(doc, cell.detail, x + LABEL_W, y + 15.5 * k + cell.lines.length * VALUE_LEADING, detailStyle);
                    }
                });
            },
        }));
        lines.push({
            step: rows[rows.length - 1].height,
            draw: (y) => drawRule(doc, MARGIN, y, CONTENT_W, THEME.rule),
        });

        return { lines, height: lines.reduce((sum, line) => sum + line.step, 0) };
    };

    // Fit the body between the header and the signatures: at full size when it
    // fits, otherwise with smaller type. Data too long even for that is shrunk
    // as a block, so nothing ever runs into the signatures.
    const BODY_TOP = 112, BODY_BOTTOM = 440;
    const room = BODY_BOTTOM - BODY_TOP;
    let body;
    for (const k of [1, 0.94, 0.88, 0.82]) {
        body = composeBody(k);
        if (body.height <= room) break;
    }
    const shrink = Math.min(1, room / body.height);

    // Centre the body in that space.
    let y = BODY_TOP + Math.max(0, (room - body.height) / 2);
    doc.save();
    if (shrink < 1) doc.scale(shrink, { origin: [MARGIN, BODY_TOP] });
    body.lines.forEach((line) => {
        y += line.step;
        line.draw(y);
    });
    doc.restore();

    // ── SIGNATURES ──────────────────────────────────────────────────────────────
    const SIGN_W = 168;
    const SIGN_Y = 486;
    ISSUER.signatories.forEach((signatory, i) => {
        drawSignatureBlock(doc, MARGIN + i * (SIGN_W + 40), SIGN_Y, SIGN_W, signatory);
    });
    drawStamp(doc, MARGIN + CONTENT_W, SIGN_Y - 4, 76);

    const FOOT_BASELINE = 542;
    drawText(doc, ISSUER.note, MARGIN, FOOT_BASELINE, {
        font: FONT.sans, size: 7.5, color: THEME.muted,
    });

    // ── VERIFICATION PANEL ──────────────────────────────────────────────────────
    doc.rect(PANEL_X, 0, PANEL_W, H).fill(THEME.panel);

    const panelLeft = PANEL_X + PANEL_PAD;
    const panelInner = PANEL_W - PANEL_PAD * 2;
    const panelCentre = PANEL_X + PANEL_W / 2;

    drawBrand(doc, panelLeft, 50, 28);

    // The issuer's address, registration number and contact, under the logo.
    const issuerStyle = { font: FONT.sans, size: 7.5, color: THEME.panelMuted };
    [ISSUER.address, ISSUER.registration, ISSUER.contact].filter(Boolean).forEach((line, i) => {
        drawText(doc, fitText(doc, line, panelInner, issuerStyle), panelLeft, 98 + i * 12, issuerStyle);
    });

    const sealRadius = panelInner / 2;
    const sealY = 246;
    drawSeal(doc, panelCentre, sealY, sealRadius, _id, verifyUrl);
    drawText(doc, 'Scan to verify', panelCentre, sealY + sealRadius + 20, {
        font: FONT.sans, size: 8.5, color: THEME.panelMuted, align: 'center',
    });

    const META_PITCH = 34;
    const meta = [
        { label: 'Certificate ID', value: `FMPG-${_id}` },
        issuedOn && { label: 'Issued on', value: [fmt(issuedOn), place].filter(Boolean).join(', ') },
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