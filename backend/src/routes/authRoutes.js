const express = require("express");

const {
  register,
  login,
  getCurrentUser,
} = require("../controllers/authController");

const { authenticate } = require("../middleware/authMiddleware");
const { requireTenant } = require("../middleware/tenantMiddleware");

const router = express.Router();

// Public routes: users do not have a business context yet.
router.post("/register", register);
router.post("/login", login);

// Protected route: authenticate the user, then establish tenant context.
router.get("/me", authenticate, requireTenant, getCurrentUser);

module.exports = router;