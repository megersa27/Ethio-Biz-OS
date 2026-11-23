
const express = require("express");

const { authenticate } = require("../middleware/authMiddleware");
const { requireTenant } = require("../middleware/tenantMiddleware");
const { chatWithAI } = require("../controllers/aiController");

const router = express.Router();

// POST /api/ai/chat
router.post(
  "/chat",
  authenticate,
  requireTenant,
  chatWithAI
);

module.exports = router;
