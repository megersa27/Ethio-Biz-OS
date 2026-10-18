const express = require("express");

const customerController = require("../controllers/customerController");
const { authenticate } = require("../middleware/authMiddleware");
const { requireTenant } = require("../middleware/tenantMiddleware");

const router = express.Router();

// All customer endpoints require authentication and tenant context.
router.use(authenticate, requireTenant);

router.post("/", customerController.create);
router.get("/", customerController.list);

module.exports = router;
