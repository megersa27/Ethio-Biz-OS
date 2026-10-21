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

// Find a particular customer inside this business only.
async function getCustomerById(tenantId, customerId) {
  validateTenantId(tenantId);

  if (!mongoose.isValidObjectId(customerId)) {
    throw createError("Invalid customer ID", 400);
  }

  const customer = await Customer.findOne({
    _id: customerId,
    businessId: tenantId,
    isActive: true,
  });

  if (!customer) {
    throw createError("Customer not found", 404);
  }

  return customer;
}

// Update editable fields on a customer owned by this business only.
async function updateCustomer(tenantId, customerId, input = {}) {
  validateTenantId(tenantId);

  if (!mongoose.isValidObjectId(customerId)) {
    throw createError("Invalid customer ID", 400);
  }

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw createError("A valid customer update object is required", 400);
  }

  const allowedFields = ["name", "phone", "email", "address", "notes"];
  const protectedFields = [
    "businessId",
    "isActive",
    "_id",
    "createdAt",
    "updatedAt",
    "__v",
  ];

  const suppliedFields = Object.keys(input);

  const forbiddenField = suppliedFields.find((field) =>
    protectedFields.includes(field)
  );

  if (forbiddenField) {
    throw createError(
      `${forbiddenField} cannot be changed through customer editing`,
      400
    );
  }

  const unsupportedField = suppliedFields.find(
    (field) => !allowedFields.includes(field)
  );

  if (unsupportedField) {
    throw createError(`Unsupported customer field: ${unsupportedField}`, 400);
  }

  if (suppliedFields.length === 0) {
    throw createError("At least one field must be provided", 400);
  }

  const updates = {};

  if (Object.hasOwn(input, "name")) {
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

    updates.name = name;
  }

  if (Object.hasOwn(input, "phone")) {
    updates.phone = normalizeOptionalString(input.phone, "Phone", 30);
  }

  if (Object.hasOwn(input, "email")) {
    const email = normalizeOptionalString(input.email, "Email", 254);
    updates.email = email.toLowerCase();
  }

  if (Object.hasOwn(input, "address")) {
    updates.address = normalizeOptionalString(input.address, "Address", 300);
  }

  if (Object.hasOwn(input, "notes")) {
    updates.notes = normalizeOptionalString(input.notes, "Notes", 500);
  }

  // The businessId in this query is essential for tenant isolation.
  const customer = await Customer.findOneAndUpdate(
    {
      _id: customerId,
      businessId: tenantId,
      isActive: true,
    },
    { $set: updates },
    {
      returnDocument: "after",
      runValidators: true,
    }
  );

  if (!customer) {
    throw createError("Customer not found", 404);
  }

  return customer;
}

// Soft-delete a customer so historical sales keep their reference.
async function deactivateCustomer(tenantId, customerId) {
  validateTenantId(tenantId);

  if (!mongoose.isValidObjectId(customerId)) {
    throw createError("Invalid customer ID", 400);
  }

  const customer = await Customer.findOneAndUpdate(
    {
      _id: customerId,
      businessId: tenantId,
      isActive: true,
    },
    { $set: { isActive: false } },
    {
      returnDocument: "after",
      runValidators: true,
    }
  );

  if (!customer) {
    throw createError("Customer not found", 404);
  }

  return customer;
}

module.exports = {
  createCustomer,
  listCustomers,
  getCustomerById,
  updateCustomer,
  deactivateCustomer,
};
