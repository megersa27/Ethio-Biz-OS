
require("dotenv").config();

const connectDB = require("../config/database");
const mongoose = require("mongoose");

const {
  analyzeExpenses,
  analyzeFinancialPerformance,
} = require("./tools/finance.tools");

async function testFinanceTool() {
  try {
    await connectDB();

    // Use the same Business ID from your successful sales test.
    const tenantId = "6afee4146738cbdc60a28afa";

    console.log("\nGetting expense analysis...");

    const expenses = await analyzeExpenses(tenantId);

    console.log("\nEXPENSE ANALYSIS:");
    console.log(JSON.stringify(expenses, null, 2));

    console.log("\nGetting financial performance...");

    const finance = await analyzeFinancialPerformance(tenantId);

    console.log("\nFINANCIAL PERFORMANCE:");
    console.log(JSON.stringify(finance, null, 2));

  } catch (error) {
    console.error("\nTest failed:", error.message);
  } finally {
    await mongoose.disconnect();
    console.log("\nDatabase connection closed.");
  }
}

testFinanceTool();
