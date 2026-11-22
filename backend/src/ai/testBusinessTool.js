
require("dotenv").config();

const connectDB = require("../config/database");
const mongoose = require("mongoose");

const {
  analyzeBusinessOverview,
} = require("./tools/business.tools");

async function testBusinessTool() {
  try {
    await connectDB();

    // Use the same real Business ID from your previous tests.
    const tenantId = "6afee4146738cbdc60a28afa";

    console.log("\nGenerating complete business overview...");

    const overview = await analyzeBusinessOverview(tenantId);

    console.log("\nBUSINESS OVERVIEW:");
    console.log(JSON.stringify(overview, null, 2));

  } catch (error) {
    console.error("\nTest failed:", error.message);
  } finally {
    await mongoose.disconnect();
    console.log("\nDatabase connection closed.");
  }
}

testBusinessTool();
