const mongoose = require("mongoose");

const DEFAULT_LOCAL_MONGO_URI = "mongodb://127.0.0.1:27017/ethioBiz";

function getMongoUri() {
  const mongoURI =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    DEFAULT_LOCAL_MONGO_URI;

  return mongoURI && mongoURI.trim() ? mongoURI.trim() : DEFAULT_LOCAL_MONGO_URI;
}

async function connectDB() {
  const mongoURI = getMongoUri();

  mongoose.set("bufferCommands", false);

  try {
    const useRetryableWrites = mongoURI.includes("mongodb+srv://");

    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 15000,
      retryWrites: useRetryableWrites,
      maxPoolSize: 10,
    });

    console.log("MongoDB connected successfully");
  } catch (error) {
    const uriSource = process.env.MONGODB_URI || process.env.MONGO_URI ? "configured" : "local default";

    console.error(
      `MongoDB connection failed using the ${uriSource} URI. ` +
        "Start a local MongoDB instance or set MONGODB_URI to a reachable database URL."
    );

    throw error;
  }
}

module.exports = connectDB;
module.exports.getMongoUri = getMongoUri;