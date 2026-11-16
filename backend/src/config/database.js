const mongoose = require("mongoose");

const DEFAULT_LOCAL_MONGO_URI = "mongodb://127.0.0.1:27017/ethioBiz?replicaSet=rs0";

function getMongoUri() {
  const mongoURI =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    DEFAULT_LOCAL_MONGO_URI;

  return mongoURI && mongoURI.trim() ? mongoURI.trim() : DEFAULT_LOCAL_MONGO_URI;
}

async function connectDB() {
  const configuredUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  const candidateUris = [];

  if (configuredUri && configuredUri.trim()) {
    candidateUris.push(configuredUri.trim());
  }

  candidateUris.push(DEFAULT_LOCAL_MONGO_URI);

  let lastError;

  for (const mongoURI of candidateUris) {
    try {
      await mongoose.disconnect().catch(() => {});
      mongoose.set("bufferCommands", false);

      const useRetryableWrites =
        mongoURI.includes("mongodb+srv://") ||
        mongoURI.includes("replicaSet=");

      await mongoose.connect(mongoURI, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
        socketTimeoutMS: 15000,
        retryWrites: useRetryableWrites,
        maxPoolSize: 10,
      });

      console.log(
        `MongoDB connected successfully using ${
          mongoURI === DEFAULT_LOCAL_MONGO_URI ? "local fallback" : "configured URI"
        }.`
      );

      return mongoose.connection;
    } catch (error) {
      lastError = error;

      const uriSource = mongoURI === DEFAULT_LOCAL_MONGO_URI ? "local fallback" : "configured";
      console.warn(
        `MongoDB connection failed using the ${uriSource} URI: ${error.message}. ` +
        (mongoURI === DEFAULT_LOCAL_MONGO_URI
          ? "Start a local MongoDB instance or set a reachable MONGODB_URI."
          : "Falling back to the local development database.")
      );

      if (mongoURI === DEFAULT_LOCAL_MONGO_URI) {
        break;
      }
    }
  }

  throw new Error(`MongoDB connection failed using the configured URI and local fallback. ${lastError?.message || ""}`.trim());
}

module.exports = connectDB;
module.exports.getMongoUri = getMongoUri;