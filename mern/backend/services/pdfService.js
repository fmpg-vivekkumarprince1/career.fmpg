const PDFDocument = require('pdfkit');
const fs = require('fs');
const QRCode = require('qrcode');
const { formatCurrencyValue } = require('../utils/currencyFormatter');
exports.generateOfferLetter = async (candidateData, jobData) => {
  console.log(`Offer letter for: ${candidateData.fullName}`);
  try {
    // PDF with A4 size
    console.log(`Creating document in memory`);
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: `Offer Letter - ${candidateData.fullName}`,
        Author: 'FMPG',
        Subject: 'Employment Offer'
      }
    });
    const buffers = [];

    // Collect PDF data in memory instead of writing to file
    doc.on('data', buffers.push.bind(buffers));


    console.log(`Adding decorative elements`);
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;


    doc.rect(20, 20, pageWidth - 40, pageHeight - 40)
      .lineWidth(2)
      .fillOpacity(0.1)
      .fillAndStroke('#f0f0f0', '#3498db');


    doc.rect(30, 30, pageWidth - 60, pageHeight - 60)
      .lineWidth(1)
      .stroke('#2980b9');


    console.log(`Adding logo`);
    const logoPath = require('path').join(__dirname, '../assets/logo.png');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, (pageWidth - 120) / 2, 50, { width: 120 });
      doc.moveDown(2);
    }


    console.log(`Adding header`);
    doc.font('Helvetica-Bold')
      .fontSize(26)
      .fillColor('#2c3e50')
      .text('FMPG', { align: 'center' });

    doc.font('Helvetica-Oblique')
      .fontSize(12)
      .fillColor('#7f8c8d')
      .text('Your Property Management Partner', { align: 'center' });


    const lineY = doc.y + 10;
    doc.moveTo(100, lineY)
      .lineTo(pageWidth - 100, lineY)
      .lineWidth(1)
      .stroke('#3498db');

    doc.moveDown(2);


    doc.font('Helvetica')
      .fontSize(10)
      .fillColor('#34495e');

    const dateBoxY = doc.y;
    doc.rect(pageWidth - 200, dateBoxY, 150, 30)
      .fillOpacity(0.05)
      .fill('#e8f4fc');

    doc.text(`Ref: FMPG/HR/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`,
      pageWidth - 190, dateBoxY + 10);

    doc.moveDown(4);

    //offer letter header
    console.log(`Adding content for ${candidateData.fullName}`);
    doc.font('Helvetica-Bold')
      .fontSize(18)
      .fillColor('#2c3e50')
      .text('OFFER OF EMPLOYMENT', { align: 'center' });


    const headerLineY = doc.y + 5;
    doc.moveTo(150, headerLineY)
      .lineTo(pageWidth - 150, headerLineY)
      .lineWidth(1)
      .stroke('#3498db');

    doc.moveDown(2);

    // candidate details
    doc.font('Helvetica-Bold')
      .fontSize(12)
      .fillColor('#2c3e50')
      .text(`Dear ${candidateData.fullName},`, { continued: false });
    doc.moveDown();

    doc.font('Helvetica')
      .fontSize(11)
      .fillColor('#34495e')
      .text(`We are pleased to offer you the position of `, { continued: true })
      .font('Helvetica-Bold').text(`${jobData.title}`, { continued: true })
      .font('Helvetica').text(` at FMPG. This letter confirms our offer of employment under the following terms:`, { continued: false });
    doc.moveDown();

    // job details
    const jobDetailsY = doc.y;
    doc.rect(70, jobDetailsY, pageWidth - 140, 100)
      .fillOpacity(0.05)
      .fill('#e8f4fc');


    doc.font('Helvetica-Bold')
      .fontSize(11)
      .fillColor('#2c3e50')
      .text('Position:', 100, jobDetailsY + 15, { continued: true, width: 80 })
      .font('Helvetica')
      .fillColor('#34495e')
      .text(`  ${jobData.title}`, { align: 'left' });

    doc.font('Helvetica-Bold')
      .fillColor('#2c3e50')
      .text('Type:', 100, jobDetailsY + 35, { continued: true, width: 80 })
      .font('Helvetica')
      .fillColor('#34495e')
      .text(`  ${jobData.type}`, { align: 'left' });

    doc.font('Helvetica-Bold')
      .fillColor('#2c3e50')
      .text('Location:', 100, jobDetailsY + 55, { continued: true, width: 80 })
      .font('Helvetica')
      .fillColor('#34495e')
      .text(`  ${jobData.location}`, { align: 'left' });

    if (jobData.salary) {
      doc.font('Helvetica-Bold')
        .fillColor('#2c3e50')
        .text('Salary:', 100, jobDetailsY + 75, { continued: true, width: 80 })
        .font('Helvetica')
        .fillColor('#34495e')
        .text(`  ${formatCurrencyValue(jobData.salary)}`, { align: 'left' });
    }

    doc.moveDown(7);


    doc.font('Helvetica')
      .fontSize(11)
      .fillColor('#34495e')
      .text('We would like you to start work on ', { continued: true })
      .font('Helvetica-Bold')
      .text('[Start Date]', { continued: true })
      .font('Helvetica')
      .text('. Please confirm your acceptance of this offer by signing and returning this letter.', { continued: false });

    doc.moveDown();
    doc.text('We are excited to welcome you to our team and look forward to your contributions to our company.');
    doc.moveDown(2);

    // Add signature 
    doc.font('Helvetica-Bold')
      .fontSize(11)
      .fillColor('#2c3e50')
      .text('Sincerely,', { continued: false });

    doc.font('Helvetica')
      .fontSize(11)
      .fillColor('#34495e');

    // Draw signature
    const signatureHrY = doc.y + 30;
    doc.moveTo(70, signatureHrY)
      .lineTo(200, signatureHrY)
      .lineWidth(0.5)
      .stroke('#7f8c8d');

    doc.text('HR Manager', 70, signatureHrY + 5);
    doc.text('FMPG', 70, signatureHrY + 20);

    doc.moveDown(4);

    // Draw acceptance
    const acceptanceY = doc.y;
    doc.rect(50, acceptanceY, pageWidth - 100, 70)
      .fillOpacity(0.05)
      .fill('#e8f4fc')
      .strokeOpacity(0.5)
      .strokeColor('#3498db')
      .stroke();

    doc.font('Helvetica-Bold')
      .fontSize(11)
      .fillColor('#2c3e50')
      .text('I accept this offer of employment:', 70, acceptanceY + 15);


    const signatureCandidateY = acceptanceY + 40;
    doc.moveTo(70, signatureCandidateY)
      .lineTo(200, signatureCandidateY)
      .lineWidth(0.5)
      .stroke('#7f8c8d');

    doc.moveTo(pageWidth - 200, signatureCandidateY)
      .lineTo(pageWidth - 70, signatureCandidateY)
      .lineWidth(0.5)
      .stroke('#7f8c8d');

    doc.font('Helvetica')
      .fontSize(10)
      .fillColor('#34495e')
      .text(candidateData.fullName, 70, signatureCandidateY + 5);

    doc.text('Date', pageWidth - 200, signatureCandidateY + 5);

    // footer with page 
    const footerY = pageHeight - 40;
    doc.font('Helvetica')
      .fontSize(8)
      .fillColor('#95a5a6')
      .text('FMPG - Confidential', 70, footerY);

    doc.text('Page 1 of 1', pageWidth - 100, footerY);

    // Final PDF
    console.log(`Finalizing PDF`);
    doc.end();

    console.log(`Generated for: ${candidateData.fullName}`);
    return Buffer.concat(buffers);
  } catch (error) {
    console.error('Generation error:', error);
    throw error;
  }
};

exports.generateCertificate = async (certificateData) => {
  throw new Error('This old generateCertificate function is disabled due to node-gd and canvas unsuitability for Vercel. Please use CertificateController generateCertificatePDFBuffer instead.');
};