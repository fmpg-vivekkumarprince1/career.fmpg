require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/database");
const Job = require("../models/job");

const migrateJobPublication = async () => {
  await connectDB();

  const result = await Job.updateMany(
    { isPublished: { $exists: false } },
    { $set: { isPublished: true } }
  );

  console.log(`Published ${result.modifiedCount} existing job(s).`);
};

migrateJobPublication()
  .catch((error) => {
    console.error("Job publication migration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });