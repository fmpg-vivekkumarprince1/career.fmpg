const mongoose = require("mongoose");

const certificateSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  name: { type: String, required: true },
  recipientEmail: { type: String },
  domain: { type: String, required: true },
  jobrole: { type: String, required: true },
  fromDate: { type: Date, required: true },
  toDate: { type: Date, required: true },
  issuedBy: { type: String, default: "FMPG" },
  issuedOn: { type: Date, default: Date.now },

  // Optional details. Each is printed on the certificate only when it has a value.
  recipientAffiliation: { type: String, trim: true }, // programme and/or college
  recipientId: { type: String, trim: true },          // roll, enrolment or intern number, with its label: "Roll no. 23BCS1045"
  project: { type: String, trim: true },              // project or area of work
  supervisorName: { type: String, trim: true },
  supervisorPosition: { type: String, trim: true },
  mode: { type: String, trim: true },                 // "On-site", "Remote", "Hybrid"
  performance: { type: String, trim: true },          // rating in the organisation's own words: "Excellent"
  hours: { type: Number, min: 0 },                    // total hours worked, printed beside the duration
  summary: { type: String, trim: true },              // one or two sentences on the work done
  issuePlace: { type: String, trim: true }            // place of issue, printed after the issue date
});

module.exports = mongoose.model("Certificate", certificateSchema);