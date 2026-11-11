const jwt = require("jsonwebtoken");

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_SECRET must be configured with at least 32 characters"
    );
  }

  return secret;
}

function generateToken(user) {
  if (!user || typeof user !== "object") {
    throw new Error("User account is missing business information");
  }

  if (!user._id || !user.businessId || !user.role) {
    throw new Error("User account is missing business information");
  }

  return jwt.sign(
    {
      businessId: String(user.businessId),
      role: user.role,
    },
    getJwtSecret(),
    {
      subject: String(user._id),
      expiresIn: "1h",
      issuer: "ethiobiz-os",
      audience: "ethiobiz-os-api",
    }
  );
}

function verifyToken(token) {
  return jwt.verify(token, getJwtSecret(), {
    issuer: "ethiobiz-os",
    audience: "ethiobiz-os-api",
    algorithms: ["HS256"],
  });
}

module.exports = {
  generateToken,
  verifyToken,
};
