require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/database");

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Connect to MongoDB before accepting requests
    await connectDB();

    // Start the Express server only after DB connection succeeds
    app.listen(PORT, () => {
      console.log(`EthioBiz OS API running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

startServer();