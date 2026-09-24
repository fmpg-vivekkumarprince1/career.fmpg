const mongoose = require("mongoose");
require("dotenv").config();

let connectionPromise = null;

// Database connection function
const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing. Set it in environment variables.");
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  console.log("Connecting to MongoDB...");
  console.log(`URI: ${process.env.MONGO_URI.substring(0, 10)}...`);

  connectionPromise = mongoose
    .connect(process.env.MONGO_URI, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4
    })
    .then((connection) => {
      console.log(`Connected: ${connection.connection.host}`);
      console.log(`DB: ${connection.connection.name}`);
      return connection;
    })
    .catch((error) => {
      console.error("Connection error:", error);
      connectionPromise = null;
      throw error;
    });

  return connectionPromise;
};

module.exports = connectDB;