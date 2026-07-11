const express = require('express');
const router = express.Router();
const Job = require('../models/job');

router.get('/sitemap.xml', async (req, res) => {
  try {
    // Fetch all active jobs
    const jobs = await Job.find({
      isActive: true,
      $or: [{ isPublished: true }, { isPublished: { $exists: false } }]
    }).select('slug updatedAt createdAt').exec();

    const baseUrl = 'https://fmpg.vercel.app';

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // Core routes
    xml += `  <url>\n`;
    xml += `    <loc>${baseUrl}/</loc>\n`;
    xml += `    <changefreq>daily</changefreq>\n`;
    xml += `    <priority>1.0</priority>\n`;
    xml += `  </url>\n`;

    xml += `  <url>\n`;
    xml += `    <loc>${baseUrl}/jobs</loc>\n`;
    xml += `    <changefreq>daily</changefreq>\n`;
    xml += `    <priority>0.9</priority>\n`;
    xml += `  </url>\n`;

    xml += `  <url>\n`;
    xml += `    <loc>${baseUrl}/contact</loc>\n`;
    xml += `    <changefreq>monthly</changefreq>\n`;
    xml += `    <priority>0.7</priority>\n`;
    xml += `  </url>\n`;

    // Dynamic Job routes
    jobs.forEach(job => {
      // Use fallback exactly as in frontend routing
      const identifier = job.slug || job._id;
      const lastMod = (job.updatedAt || job.createdAt || new Date()).toISOString().split('T')[0];

      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/apply/${identifier}</loc>\n`;
      xml += `    <lastmod>${lastMod}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.8</priority>\n`;
      xml += `  </url>\n`;
    });

    xml += `</urlset>`;

    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (error) {
    console.error('Error generating sitemap:', error);
    res.status(500).send('Error generating sitemap');
  }
});

module.exports = router;
