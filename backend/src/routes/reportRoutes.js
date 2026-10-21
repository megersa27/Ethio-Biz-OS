const express = require("express");

const reportController = require("../controllers/reportController");
const { authenticate } = require("../middleware/authMiddleware");
const { requireTenant } = require("../middleware/tenantMiddleware");

const router = express.Router();

// Reports require an authenticated business context.
router.use(authenticate, requireTenant);

router.get("/summary", reportController.summary);
router.get("/sales", reportController.sales);
router.get("/expenses", reportController.expenses);
router.get("/profit", reportController.profit);
router.get("/stock", reportController.stock);

module.exports = router;
