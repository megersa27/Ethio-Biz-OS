const {
  registerBusiness,
  loginUser,
} = require("../services/authService");

async function register(req, res, next) {
  try {
    const result = await registerBusiness(req.body);

    return res.status(201).json({
      success: true,
      message: "Business registered successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  console.log("[LOGIN DEBUG] Request received:", new Date().toISOString());

  try {
    console.log("[LOGIN DEBUG] Starting login service");

    const result = await loginUser(req.body);

    console.log("[LOGIN DEBUG] Login service completed");

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: result,
    });
  } catch (error) {
    console.error("[LOGIN DEBUG] Error:", error.message);
    next(error);
  }
}

async function getCurrentUser(req, res) {
  return res.status(200).json({
    success: true,
    message: "Authenticated user retrieved successfully",
    data: {
      user: req.user,
    },
  });
}

module.exports = {
  register,
  login,
  getCurrentUser,
};