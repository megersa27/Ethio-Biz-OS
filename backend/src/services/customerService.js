const mongoose = require("mongoose");
const Customer = require("../models/Customer");

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function validateTenantId(tenantId) {
  if (!tenantId || !mongoose.isValidObjectId(tenantId)) {
    throw createError("A valid business context is required", 403);
  }
}

function normalizeOptionalString(value, fieldName, maxLength) {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value !== "string") {
    throw createError(`${fieldName} must be a string`, 400);
  }

  const normalized = value.trim();

  if (normalized.length > maxLength) {
    throw createError(
      `${fieldName} cannot exceed ${maxLength} characters`,
      400
    );
  }

  return normalized;
}

function validateCustomerInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw createError("A valid customer object is required", 400);
  }

  const allowedFields = [
    "name",
    "phone",
    "email",
    "address",
    "notes",
  ];

  const unsupportedField = Object.keys(input).find(
    (field) => !allowedFields.includes(field)
  );

  if (unsupportedField) {
    throw createError(
      `Unsupported customer field: ${unsupportedField}`,
      400
    );
  }

  if (typeof input.name !== "string" || !input.name.trim()) {
    throw createError("Customer name is required", 400);
  }

  const name = input.name.trim();

  if (name.length > 150) {
    throw createError(
      "Customer name cannot exceed 150 characters",
      400
    );
  }

  const phone = normalizeOptionalString(input.phone, "Phone", 30);
  const email = normalizeOptionalString(input.email, "Email", 254);
  const address = normalizeOptionalString(input.address, "Address", 300);
  const notes = normalizeOptionalString(input.notes, "Notes", 500);

  return {
    name,
    phone,
    email: email.toLowerCase(),
    address,
    notes,
  };
}

async function createCustomer(tenantId, input) {
  validateTenantId(tenantId);

  const customerData = validateCustomerInput(input);

  return Customer.create({
    businessId: tenantId,
    ...customerData,
  });
}

async function listCustomers(tenantId) {
  validateTenantId(tenantId);

  return Customer.find({
    businessId: tenantId,
    isActive: true,
  }).sort({ name: 1, createdAt: -1 });
}

module.exports = {
  createCustomer,
  listCustomers,
};
