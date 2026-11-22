
require("dotenv").config();

const { generateAIResponse } = require("./ai.provider");

async function testOpenAI() {
  try {
    console.log("Connecting to OpenAI...");

    const answer = await generateAIResponse(
      "Introduce yourself as the AI assistant of EthioBiz OS."
    );

    console.log("\nAI RESPONSE:\n");
    console.log(answer);

  } catch (error) {
    console.error("\nOpenAI test failed:");
    console.error(error.message);
  }
}

testOpenAI();
