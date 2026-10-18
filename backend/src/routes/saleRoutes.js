const express = require("express");

const saleController = require("../controllers/saleController");
const { authenticate } = require("../middleware/authMiddleware");
const { requireTenant } = require("../middleware/tenantMiddleware");

const router = express.Router();

// All sales operations require authentication and tenant context.
router.use(authenticate, requireTenant);

// Keep static paths before the dynamic saleId route.
router.get("/", saleController.list);
router.get("/:saleId", saleController.getById);

router.post("/", saleController.create);
router.post("/:saleId/payments", saleController.recordPayment);

module.exports = router;
