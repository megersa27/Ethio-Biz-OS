
const { handleUserMessage } = require("../ai/ai.service");

async function chatWithAI(req, res, next) {
  try {
    const { message } = req.body;

    // Validate the user's question.
    if (
      typeof message !== "string" ||
      !message.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid question.",
      });
    }

    if (message.length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Your question is too long. Maximum length is 2000 characters.",
      });
    }

    // Get business ID from authenticated middleware.
    const tenantId = req.tenantId;

    // Send the question to the EthioBiz AI agent.
    const result = await handleUserMessage(
      message.trim(),
      tenantId
    );

    return res.status(200).json({
  success: true,
  data: result,
});
  } catch (error) {
    next(error);
  }
}

module.exports = {
  chatWithAI,
};
