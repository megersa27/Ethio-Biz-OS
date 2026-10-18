const express = require("express");

const saleController = require("../controllers/saleController");
const { authenticate } = require("../middleware/authMiddleware");
const { requireTenant } = require("../middleware/tenantMiddleware");

const router = express.Router();

// All sales operations require an authenticated business context.
router.use(authenticate, requireTenant);

router.post("/", saleController.create);
router.post("/:saleId/payments", saleController.recordPayment);

module.exports = router;
