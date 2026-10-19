const express = require("express");

const reportController = require("../controllers/reportController");
const { authenticate } = require("../middleware/authMiddleware");
const { requireTenant } = require("../middleware/tenantMiddleware");

const router = express.Router();

// Reports require an authenticated business context.
router.use(authenticate, requireTenant);

router.get("/sales", reportController.sales);

module.exports = router;
