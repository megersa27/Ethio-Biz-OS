require("dotenv").config();

const connectDB = require("../config/database");
const mongoose = require("mongoose");

const {
  handleUserMessage,
  detectIntent,
} = require("./ai.service");

// Use the same Business ID you used in testBusinessTool.js.
const tenantId = "6afee4146738cbdc60a28afa";

async function testAI() {
  try {
    await connectDB();

    const questions = [
      "Show me my sales report",
      "How much profit did my business make?",
      "Show my expenses",
      "How is my inventory?",
      "Give me an overall business overview",
      "What is the weather today?",
    ];

    for (const question of questions) {
      console.log("\n================================");
      console.log("Question:", question);
      console.log("Detected intent:", detectIntent(question));

      const result = await handleUserMessage(question, tenantId);

      console.log("AI response:");
      console.log(result.answer);
    }
  } catch (error) {
    console.error("AI test failed:", error.message);
  } finally {
    await mongoose.disconnect();
  }
}

testAI();