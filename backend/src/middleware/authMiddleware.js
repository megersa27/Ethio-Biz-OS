
const { verifyToken } = require("../utils/jwt");
const User = require("../models/User");
const Business = require("../models/Business");

async function authenticate(req, res, next) {
  try {
    // 1. Read the Authorization header.
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is required",
      });
    }

    // 2. Extract and verify the JWT.
    const token = authorization.slice(7).trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is required",
      });
    }

    let payload;

    try {
      payload = verifyToken(token);
    } catch {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired authentication token",
      });
    }

    // 3. Load the current user from MongoDB.
    const user = await User.findById(payload.sub);

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "User account is invalid or inactive",
      });
    }

    // 4. Check that the user's business is active.
    const business = await Business.findById(user.businessId);

    if (!business || !business.isActive) {
      return res.status(403).json({
        success: false,
        message: "Business account is inactive",
      });
    }

    // 5. Trust current database values, not stale role claims.
    req.user = {
      id: user._id.toString(),
      businessId: user.businessId.toString(),
      role: user.role,
    };

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { authenticate };
