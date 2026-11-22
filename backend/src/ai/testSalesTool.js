
require("dotenv").config();

const mongoose = require("mongoose");

const {
  analyzeSales,
  analyzeProfit,
} = require("./tools/sales.tools");

async function testSalesTool() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected successfully.");

    // Temporary development test only.
    // Use the businessId of a real business in your database.
    const tenantId = "REPLACE_WITH_REAL_BUSINESS_ID";

    const sales = await analyzeSales(tenantId);
    const profit = await analyzeProfit(tenantId);

    console.log("\nSALES ANALYSIS:");
    console.log(JSON.stringify(sales, null, 2));

    console.log("\nPROFIT ANALYSIS:");
    console.log(JSON.stringify(profit, null, 2));

  } catch (error) {
    console.error("Test failed:", error.message);
  } finally {
    await mongoose.disconnect();
  }
}

testSalesTool();
