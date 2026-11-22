
const OpenAI = require("openai");

// Create one reusable OpenAI client.
// The API key is read from the backend environment.
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Use the model configured in .env.
const MODEL = process.env.OPENAI_MODEL || "gpt-5.5";

async function generateAIResponse(message) {
  if (!message || typeof message !== "string") {
    throw new Error("A valid message is required.");
  }

  const response = await openai.responses.create({
    model: MODEL,
    instructions: `
      You are EthioBiz AI, an intelligent business assistant
      for Ethiopian small businesses.

      Help business owners understand sales, inventory,
      expenses, profit, customers, and business operations.

      Be clear, practical, and honest.
      Never invent business figures.
      If you do not have access to business data, say so.
    `,
    input: message,
  });

  return response.output_text;
}

module.exports = {
  generateAIResponse,
};
