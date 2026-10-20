const express = require("express");

const inventoryController = require("../controllers/inventoryController");
const { authenticate } = require("../middleware/authMiddleware");
const { requireTenant } = require("../middleware/tenantMiddleware");

const router = express.Router();

router.use(authenticate, requireTenant);

router.post("/movements", inventoryController.createMovement);
router.get("/movements", inventoryController.listMovements);

module.exports = router;
