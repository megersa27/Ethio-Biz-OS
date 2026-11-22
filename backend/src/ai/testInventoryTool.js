
require("dotenv").config();

const connectDB = require("../config/database");
const mongoose = require("mongoose");

const {
  analyzeInventory,
} = require("./tools/inventory.tools");

async function testInventoryTool() {
  try {
    await connectDB();

    // Use the same real Business ID from your sales test.
    const tenantId = "6afee4146738cbdc60a28afa";

    console.log("\nGetting inventory analysis...");

    const inventory = await analyzeInventory(tenantId);

    console.log("\nINVENTORY ANALYSIS:");
    console.log(JSON.stringify(inventory, null, 2));

  } catch (error) {
    console.error("\nTest failed:", error.message);
  } finally {
    await mongoose.disconnect();
    console.log("\nDatabase connection closed.");
  }
}

testInventoryTool();
