
const User = require("../models/User");
const Business = require("../models/Business");

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function requiredText(value, fallback, field, maxLength) {
  const input = value === undefined ? fallback : value;
  if (typeof input !== "string" || !input.trim()) {
    throw createError(`${field} is required`, 400);
  }
  const result = input.trim();
  if (result.length > maxLength) {
    throw createError(`${field} cannot exceed ${maxLength} characters`, 400);
  }
  return result;
}

function optionalText(value, fallback, field, maxLength) {
  const input = value === undefined ? fallback : value;
  if (input == null) return "";
  if (typeof input !== "string") {
    throw createError(`${field} must be a string`, 400);
  }
  const result = input.trim();
  if (result.length > maxLength) {
    throw createError(`${field} cannot exceed ${maxLength} characters`, 400);
  }
  return result;
}

function serializeProfile(user, business) {
  return {
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email || "",
      phone: user.phone || "",
      role: user.role,
    },
    business: {
      id: business._id.toString(),
      name: business.name,
      phone: business.phone || "",
      address: business.address || "",
    },
  };
}

async function getSettingsProfile(userId, tenantId) {
  const [user, business] = await Promise.all([
    User.findOne({ _id: userId, businessId: tenantId }),
    Business.findById(tenantId),
  ]);

  if (!user || !business || !business.isActive) {
    throw createError("Profile not found for this business", 404);
  }

  return serializeProfile(user, business);
}

async function updateSettingsProfile({ userId, tenantId, role, input }) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw createError("A valid profile object is required", 400);
  }

  if (input.user !== undefined &&
      (!input.user || typeof input.user !== "object" || Array.isArray(input.user))) {
    throw createError("Invalid user profile data", 400);
  }

  if (input.business !== undefined &&
      (!input.business || typeof input.business !== "object" || Array.isArray(input.business))) {
    throw createError("Invalid business profile data", 400);
  }

  if (input.business !== undefined && role !== "OWNER") {
    throw createError("Only the business owner can update business details", 403);
  }

  const [user, business] = await Promise.all([
    User.findOne({ _id: userId, businessId: tenantId }),
    Business.findById(tenantId),
  ]);

  if (!user || !business || !business.isActive) {
    throw createError("Profile not found for this business", 404);
  }

  const userInput = input.user || {};
  const newUserName = requiredText(userInput.name, user.name, "Name", 100);
  const newEmail = optionalText(userInput.email, user.email, "Email", 254).toLowerCase();
  const newPhone = optionalText(userInput.phone, user.phone, "Phone number", 30);

  if (newEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    throw createError("Please provide a valid email address", 400);
  }

  if (!newEmail && !newPhone) {
    throw createError("At least one email address or phone number is required", 400);
  }

  if (newEmail) {
    const duplicateEmail = await User.findOne({
      email: newEmail,
      _id: { $ne: user._id },
    });
    if (duplicateEmail) throw createError("That email is already in use", 409);
  }

  if (newPhone) {
    const duplicatePhone = await User.findOne({
      phone: newPhone,
      _id: { $ne: user._id },
    });
    if (duplicatePhone) throw createError("That phone number is already in use", 409);
  }

  let newBusinessName = business.name;
  let newBusinessPhone = business.phone || "";
  let newAddress = business.address || "";

  if (input.business !== undefined) {
    const businessInput = input.business;
    newBusinessName = requiredText(
      businessInput.name, business.name, "Business name", 150
    );
    newBusinessPhone = optionalText(
      businessInput.phone, business.phone, "Business phone", 30
    );
    newAddress = optionalText(
      businessInput.address, business.address, "Business address", 300
    );
  }

  user.name = newUserName;
  user.email = newEmail || null;
  user.phone = newPhone || null;

  business.name = newBusinessName;
  business.phone = newBusinessPhone;
  business.address = newAddress;

  try {
    await user.save();
    if (input.business !== undefined) await business.save();
  } catch (error) {
    if (error.code === 11000) {
      throw createError("That email or phone number is already in use", 409);
    }
    throw error;
  }

  return serializeProfile(user, business);
}

module.exports = { getSettingsProfile, updateSettingsProfile };
