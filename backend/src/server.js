require("dotenv").config();

const mongoose = require("mongoose");
const app = require("./app");
const connectDB = require("./config/database");

const PORT = process.env.PORT || 5000;
let dbReady = false;

mongoose.connection.on("connected", () => {
  dbReady = true;
  console.log("MongoDB connection ready.");
});

mongoose.connection.on("error", (error) => {
  dbReady = false;
  console.error("MongoDB connection error:", error.message);
});

mongoose.connection.on("disconnected", () => {
  dbReady = false;
  console.warn("MongoDB disconnected.");
});

app.use((req, res, next) => {
  if (!dbReady && req.path.startsWith("/api/")) {
    if (req.path === "/api/health") {
      return res.status(200).json({
        success: false,
        message: "Database is not reachable right now",
        dbReady: false,
      });
    }

    return res.status(503).json({
      success: false,
      message:
        "Database unavailable. Please connect MongoDB Atlas or start your MongoDB server, then restart the backend.",
      dbReady: false,
    });
  }

  next();
});

async function startServer() {
  app.listen(PORT, () => {
    console.log(`EthioBiz MS API running on port ${PORT}`);
  });

  try {
    await connectDB();
    dbReady = mongoose.connection.readyState === 1;
    console.log("Database connection verified.");
  } catch (error) {
    dbReady = false;
    console.error("Database connection failed:", error.message);
  }
}

startServer();