const express = require("express");

const expenseController = require("../controllers/expenseController");
const { authenticate } = require("../middleware/authMiddleware");
const { requireTenant } = require("../middleware/tenantMiddleware");

const router = express.Router();

// Every expense endpoint requires authentication and tenant context.
router.use(authenticate, requireTenant);

router.post("/", expenseController.create);
router.get("/", expenseController.list);
router.get("/:expenseId", expenseController.getById);
router.put("/:expenseId", expenseController.update);
router.delete("/:expenseId", expenseController.deactivate);

module.exports = router;
