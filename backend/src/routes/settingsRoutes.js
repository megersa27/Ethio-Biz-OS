
const express = require("express");
const settingsController = require("../controllers/settingsController");
const { authenticate } = require("../middleware/authMiddleware");
const { requireTenant } = require("../middleware/tenantMiddleware");

const router = express.Router();
router.use(authenticate, requireTenant);
router.get("/profile", settingsController.getProfile);
router.put("/profile", settingsController.updateProfile);

module.exports = router;
