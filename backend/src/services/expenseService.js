const mongoose = require("mongoose");
const Expense = require("../models/Expense");

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

function validateUserId(userId) {
  if (!userId || !mongoose.isValidObjectId(userId)) {
    throw createError("A valid authenticated user is required", 401);
  }
}

function isPositiveSafeInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function parseDateOnly(value, fieldName) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw createError(`${fieldName} must use YYYY-MM-DD format`, 400);
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw createError(`${fieldName} is not a valid calendar date`, 400);
  }

  return date;
}

function parsePositiveIntegerQuery(value, fieldName, defaultValue, maximum) {
  if (value === undefined) {
    return defaultValue;
  }

  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    throw createError(`${fieldName} must be a positive integer`, 400);
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed > maximum) {
    throw createError(`${fieldName} must not exceed ${maximum}`, 400);
  }

  return parsed;
}

// Build an inclusive start / exclusive end range from optional date filters.
function resolveDateRange(filters) {
  let startDate;
  let endDateExclusive;

  if (filters.startDate !== undefined) {
    startDate = parseDateOnly(filters.startDate, "startDate");
  }

  if (filters.endDate !== undefined) {
    const endDate = parseDateOnly(filters.endDate, "endDate");
    endDateExclusive = new Date(endDate);
    endDateExclusive.setUTCDate(endDateExclusive.getUTCDate() + 1);
  }

  if (
    startDate &&
    endDateExclusive &&
    startDate.getTime() >= endDateExclusive.getTime()
  ) {
    throw createError("endDate must be on or after startDate", 400);
  }

  return { startDate, endDateExclusive };
}

// Create an expense for the authenticated business only.
async function createExpense(tenantId, userId, input = {}) {
  validateTenantId(tenantId);
  validateUserId(userId);

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw createError("A valid expense object is required", 400);
  }

  const allowedFields = ["category", "amountMinor", "description", "date"];
  const unsupportedField = Object.keys(input).find(
    (field) => !allowedFields.includes(field)
  );

  if (unsupportedField) {
    throw createError(`Unsupported expense field: ${unsupportedField}`, 400);
  }

  if (typeof input.category !== "string" || !input.category.trim()) {
    throw createError("Expense category is required", 400);
  }

  const category = input.category.trim();

  if (category.length > 80) {
    throw createError("Category cannot exceed 80 characters", 400);
  }

  if (!isPositiveSafeInteger(input.amountMinor)) {
    throw createError(
      "amountMinor must be a positive integer in santim",
      400
    );
  }

  const description = input.description ?? "";

  if (typeof description !== "string" || description.length > 500) {
    throw createError(
      "Description must be a string of at most 500 characters",
      400
    );
  }

  let date;

  if (input.date !== undefined && input.date !== null && input.date !== "") {
    date = parseDateOnly(input.date, "date");
  } else {
    date = new Date();
  }

  // Explicitly select allowed fields. Never accept businessId from the client.
  const expense = await Expense.create({
    businessId: tenantId,
    category,
    amountMinor: input.amountMinor,
    description: description.trim(),
    date,
    createdBy: userId,
  });

  return expense;
}

// List expenses for the authenticated business with date filtering and pagination.
async function listExpenses(tenantId, filters = {}) {
  validateTenantId(tenantId);

  if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
    throw createError("Invalid expense filters", 400);
  }

  const allowedFields = ["page", "limit", "startDate", "endDate"];
  const unsupportedField = Object.keys(filters).find(
    (field) => !allowedFields.includes(field)
  );

  if (unsupportedField) {
    throw createError(`Unsupported expense filter: ${unsupportedField}`, 400);
  }

  const page = parsePositiveIntegerQuery(filters.page, "page", 1, 1000000);
  const limit = parsePositiveIntegerQuery(filters.limit, "limit", 20, 100);
  const skip = (page - 1) * limit;

  if (!Number.isSafeInteger(skip)) {
    throw createError("Requested page is too large", 400);
  }

  const { startDate, endDateExclusive } = resolveDateRange(filters);

  const match = { businessId: tenantId, isActive: true };
  const dateRange = {};

  if (startDate) {
    dateRange.$gte = startDate;
  }

  if (endDateExclusive) {
    dateRange.$lt = endDateExclusive;
  }

  if (Object.keys(dateRange).length > 0) {
    match.date = dateRange;
  }

  const [expenses, totalItems] = await Promise.all([
    Expense.find(match)
      .sort({ date: -1, _id: -1 })
      .skip(skip)
      .limit(limit),
    Expense.countDocuments(match),
  ]);

  return {
    expenses,
    pagination: {
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    },
  };
}

// Find a particular expense inside this business only.
async function getExpenseById(tenantId, expenseId) {
  validateTenantId(tenantId);

  if (!mongoose.isValidObjectId(expenseId)) {
    throw createError("Invalid expense ID", 400);
  }

  const expense = await Expense.findOne({
    _id: expenseId,
    businessId: tenantId,
    isActive: true,
  });

  if (!expense) {
    throw createError("Expense not found", 404);
  }

  return expense;
}

// Update editable fields on an expense owned by this business only.
async function updateExpense(tenantId, expenseId, input = {}) {
  validateTenantId(tenantId);

  if (!mongoose.isValidObjectId(expenseId)) {
    throw createError("Invalid expense ID", 400);
  }

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw createError("A valid expense update object is required", 400);
  }

  const allowedFields = ["category", "amountMinor", "description", "date"];
  const protectedFields = [
    "businessId",
    "createdBy",
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
      `${forbiddenField} cannot be changed through expense editing`,
      400
    );
  }

  const unsupportedField = suppliedFields.find(
    (field) => !allowedFields.includes(field)
  );

  if (unsupportedField) {
    throw createError(`Unsupported expense field: ${unsupportedField}`, 400);
  }

  if (suppliedFields.length === 0) {
    throw createError("At least one field must be provided", 400);
  }

  const updates = {};

  if (Object.hasOwn(input, "category")) {
    if (typeof input.category !== "string" || !input.category.trim()) {
      throw createError("Expense category is required", 400);
    }

    const category = input.category.trim();

    if (category.length > 80) {
      throw createError("Category cannot exceed 80 characters", 400);
    }

    updates.category = category;
  }

  if (Object.hasOwn(input, "amountMinor")) {
    if (!isPositiveSafeInteger(input.amountMinor)) {
      throw createError(
        "amountMinor must be a positive integer in santim",
        400
      );
    }

    updates.amountMinor = input.amountMinor;
  }

  if (Object.hasOwn(input, "description")) {
    if (typeof input.description !== "string" || input.description.length > 500) {
      throw createError(
        "Description must be a string of at most 500 characters",
        400
      );
    }

    updates.description = input.description.trim();
  }

  if (Object.hasOwn(input, "date")) {
    if (input.date === null || input.date === "") {
      throw createError("Expense date is required", 400);
    }

    updates.date = parseDateOnly(input.date, "date");
  }

  // The businessId in this query is essential for tenant isolation.
  const expense = await Expense.findOneAndUpdate(
    {
      _id: expenseId,
      businessId: tenantId,
      isActive: true,
    },
    { $set: updates },
    {
      returnDocument: "after",
      runValidators: true,
    }
  );

  if (!expense) {
    throw createError("Expense not found", 404);
  }

  return expense;
}

// Soft-delete an expense so historical reports can be re-run consistently.
async function deactivateExpense(tenantId, expenseId) {
  validateTenantId(tenantId);

  if (!mongoose.isValidObjectId(expenseId)) {
    throw createError("Invalid expense ID", 400);
  }

  const expense = await Expense.findOneAndUpdate(
    {
      _id: expenseId,
      businessId: tenantId,
      isActive: true,
    },
    { $set: { isActive: false } },
    {
      returnDocument: "after",
      runValidators: true,
    }
  );

  if (!expense) {
    throw createError("Expense not found", 404);
  }

  return expense;
}

module.exports = {
  createExpense,
  listExpenses,
  getExpenseById,
  updateExpense,
  deactivateExpense,
};
