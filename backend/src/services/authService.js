
const mongoose = require("mongoose");
const Business = require("../models/Business");
const User = require("../models/User");
const { hashPassword, comparePassword } = require("../utils/password");
const { generateToken } = require("../utils/jwt");

// ======================================================
// REGISTER BUSINESS
// ======================================================

async function registerBusiness(input = {}) {
  // 1. Validate input.
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    const error = new Error("A valid registration object is required");
    error.statusCode = 400;
    throw error;
  }

  const { businessName, ownerName, email, phone, password } = input;

  if (typeof businessName !== "string" || !businessName.trim()) {
    const error = new Error("Business name is required");
    error.statusCode = 400;
    throw error;
  }

  if (typeof ownerName !== "string" || !ownerName.trim()) {
    const error = new Error("Owner name is required");
    error.statusCode = 400;
    throw error;
  }

  if (businessName.trim().length > 150) {
    const error = new Error("Business name cannot exceed 150 characters");
    error.statusCode = 400;
    throw error;
  }

  if (ownerName.trim().length > 100) {
    const error = new Error("Owner name cannot exceed 100 characters");
    error.statusCode = 400;
    throw error;
  }

  if (email != null && typeof email !== "string") {
    const error = new Error("Email must be a string");
    error.statusCode = 400;
    throw error;
  }

  if (phone != null && typeof phone !== "string") {
    const error = new Error("Phone number must be a string");
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = email?.trim().toLowerCase() || null;
  const rawPhone = phone?.trim() || null;
  const normalizedPhone = rawPhone ? rawPhone.replace(/\D/g, "") : null;

  if (!normalizedEmail && !normalizedPhone) {
    const error = new Error("Email or phone number is required");
    error.statusCode = 400;
    throw error;
  }

  if (
    normalizedEmail &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
  ) {
    const error = new Error("Please provide a valid email address");
    error.statusCode = 400;
    throw error;
  }

  if (rawPhone && normalizedPhone && normalizedPhone.length !== 10) {
    const error = new Error("Phone number must be exactly 10 digits");
    error.statusCode = 400;
    throw error;
  }

  if (rawPhone && !normalizedPhone) {
    const error = new Error("Phone number must be exactly 10 digits");
    error.statusCode = 400;
    throw error;
  }

  if (typeof password !== "string" || password.length < 8) {
    const error = new Error("Password must be at least 8 characters");
    error.statusCode = 400;
    throw error;
  }

  if (Buffer.byteLength(password, "utf8") > 72) {
    const error = new Error("Password must not exceed 72 UTF-8 bytes");
    error.statusCode = 400;
    throw error;
  }

  // 2. Check for an existing email or phone.
  const conditions = [];

  if (normalizedEmail) {
    conditions.push({ email: normalizedEmail });
  }

  if (normalizedPhone) {
    conditions.push({ phone: normalizedPhone });
  }

  const existingUser = await User.findOne({ $or: conditions });

  if (existingUser) {
    const error = new Error(
      "An account with this email or phone already exists"
    );
    error.statusCode = 409;
    throw error;
  }

  // 3. Hash the password.
  const passwordHash = await hashPassword(password);

  // 4. Create business and owner in a transaction.
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const [business] = await Business.create(
        [{ name: businessName.trim() }],
        { session }
      );

      const [user] = await User.create(
        [
          {
            businessId: business._id,
            name: ownerName.trim(),
            email: normalizedEmail,
            phone: normalizedPhone,
            passwordHash,
            role: "OWNER",
          },
        ],
        { session }
      );

      result = {
        business: {
          id: business._id,
          name: business.name,
        },
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          photo: user.photo || "",
          role: user.role,
        },
      };
    });

    return result;
  } catch (error) {
    if (error.code === 11000) {
      const conflictError = new Error(
        "An account with this email or phone already exists"
      );
      conflictError.statusCode = 409;
      throw conflictError;
    }

    throw error;
  } finally {
    await session.endSession();
  }
}

// ======================================================
// LOGIN USER
// ======================================================

async function loginUser(input = {}) {
  // 1. Validate input.
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    const error = new Error("A valid login object is required");
    error.statusCode = 400;
    throw error;
  }

  const { identifier, password } = input;

  if (typeof identifier !== "string" || !identifier.trim()) {
    const error = new Error("Email or phone number is required");
    error.statusCode = 400;
    throw error;
  }

  if (typeof password !== "string" || !password) {
    const error = new Error("Password is required");
    error.statusCode = 400;
    throw error;
  }

  const normalizedIdentifier = identifier.trim();
  const isEmail = normalizedIdentifier.includes("@");

  const userQuery = isEmail
    ? { email: normalizedIdentifier.toLowerCase() }
    : { phone: normalizedIdentifier };

  try {
    // 2. Confirm the database connection is ready.
    if (User.db.readyState !== 1) {
      const error = new Error("Database connection is not ready");
      error.statusCode = 503;
      throw error;
    }

    await User.db.db.admin().ping();

    // 3. Look up the user by email or phone.
    const nativeUserCollection = User.db.db.collection(
      User.collection.name
    );

    const user = await nativeUserCollection.findOne(
      userQuery,
      { maxTimeMS: 10000 }
    );

    if (!user) {
      const error = new Error("Invalid email/phone or password");
      error.statusCode = 401;
      throw error;
    }

    // 4. Verify password.
    if (!user.passwordHash) {
      throw new Error("Password hash is missing from the user record");
    }

    const passwordMatches = await comparePassword(
      password,
      user.passwordHash
    );

    if (!passwordMatches) {
      const error = new Error("Invalid email/phone or password");
      error.statusCode = 401;
      throw error;
    }

    // 5. Check account status.
    if (!user.isActive) {
      const error = new Error("This account is inactive");
      error.statusCode = 403;
      throw error;
    }

    // 6. Find associated business.
    const business = await Business.findById(user.businessId);

    if (!business || !business.isActive) {
      const error = new Error("This business account is inactive");
      error.statusCode = 403;
      throw error;
    }

    // 7. Generate JWT.
    if (!user.businessId) {
      const error = new Error("This account is not linked to a business yet");
      error.statusCode = 401;
      throw error;
    }

    try {
      const accessToken = generateToken(user);

      // 8. Return login response.
      return {
        accessToken,
        tokenType: "Bearer",
        expiresIn: 3600,

        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          photo: user.photo || "",
          role: user.role,
          businessId: user.businessId,
        },

        business: {
          id: business._id,
          name: business.name,
        },
      };
    } catch (error) {
      if (error.message === "User account is missing business information") {
        error.statusCode = 401;
      }
      throw error;
    }
  } catch (error) {
    console.error("Login failed:", error.message);
    throw error;
  }
}

// ======================================================
// EXPORT SERVICES
// ======================================================

module.exports = {
  registerBusiness,
  loginUser,
};
