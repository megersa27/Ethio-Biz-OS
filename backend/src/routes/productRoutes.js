
const express = require("express");

const productController = require("../controllers/productController");
const { authenticate } = require("../middleware/authMiddleware");
const { requireTenant } = require("../middleware/tenantMiddleware");

const router = express.Router();

// Every product endpoint requires authentication and tenant context.
router.use(authenticate, requireTenant);

router.post("/", productController.create);
router.get("/", productController.list);
router.get("/:productId", productController.getById);

module.exports = router;