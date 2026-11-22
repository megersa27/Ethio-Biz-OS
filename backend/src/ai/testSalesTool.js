
require("dotenv").config();

const connectDB = require("../config/database");

const {
  analyzeSales,
  analyzeProfit,
} = require("./tools/sales.tools");

async function testSalesTool() {
  try {
    // Reuse EthioBiz OS's existing database connection.
    await connectDB();

    console.log("\nMongoDB connected successfully.");

    // Replace with a real business ID from MongoDB.
    const tenantId = "6afee4146738cbdc60a28afa";

    console.log("\nGetting sales analysis...");

    const sales = await analyzeSales(tenantId);

    console.log("\nSALES ANALYSIS:");
    console.log(JSON.stringify(sales, null, 2));

    console.log("\nGetting profit analysis...");

    const profit = await analyzeProfit(tenantId);

    console.log("\nPROFIT ANALYSIS:");
    console.log(JSON.stringify(profit, null, 2));

  } catch (error) {
    console.error("\nTest failed:", error.message);
  } finally {
    const mongoose = require("mongoose");
    await mongoose.disconnect();
    console.log("\nDatabase connection closed.");
  }
}

testSalesTool();
