
const mongoose = require("mongoose");
const Business = require("../models/Business");
const User = require("../models/User");
const { hashPassword, comparePassword } = require("../utils/password");
const { generateToken } = require("../utils/jwt");


async function registerBusiness(input = {}) {
  // 1. Validate the request body before using its fields.
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
  const normalizedPhone = phone?.trim() || null;

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

  if (normalizedPhone && normalizedPhone.length > 30) {
    const error = new Error("Phone number cannot exceed 30 characters");
    error.statusCode = 400;
    throw error;
  }

  if (typeof password !== "string" || password.length < 12) {
    const error = new Error("Password must be at least 12 characters");
    error.statusCode = 400;
    throw error;
  }

  if (Buffer.byteLength(password, "utf8") > 72) {
    const error = new Error("Password must not exceed 72 UTF-8 bytes");
    error.statusCode = 400;
    throw error;
  }

  // 2. Check whether this email or phone is already registered.
  const conditions = [];

  if (normalizedEmail) conditions.push({ email: normalizedEmail });
  if (normalizedPhone) conditions.push({ phone: normalizedPhone });

  const existingUser = await User.findOne({ $or: conditions });

  if (existingUser) {
    const error = new Error(
      "An account with this email or phone already exists"
    );
    error.statusCode = 409;
    throw error;
  }

  // 3. Hash the password before storing it.
  const passwordHash = await hashPassword(password);
  const session = await mongoose.startSession();

  try {
    let result;

    // 4. Create the business and owner atomically.
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

      // Never include the password hash in the API response.
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
          role: user.role,
        },
      };
    });

    return result;
  } catch (error) {
    // 5. Handle duplicate-key errors, including concurrent requests.
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

async function loginUser(input = {}) {
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

const user = await User.findOne(userQuery).select("+passwordHash");

if (!user) {
const error = new Error("Invalid email/phone or password");
error.statusCode = 401;
throw error;
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

if (!user.isActive) {
const error = new Error("This account is inactive");
error.statusCode = 403;
throw error;
}

const business = await Business.findById(user.businessId);

if (!business || !business.isActive) {
const error = new Error("This business account is inactive");
error.statusCode = 403;
throw error;
}

const accessToken = generateToken(user);

return {
accessToken,
tokenType: "Bearer",
expiresIn: 3600,
user: {
id: user._id,
name: user.name,
email: user.email,
phone: user.phone,
role: user.role,
businessId: user.businessId,
},
business: {
id: business._id,
name: business.name,
},
};
}

module.exports = {
registerBusiness,
loginUser,
};
