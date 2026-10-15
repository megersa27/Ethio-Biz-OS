
const mongoose = require("mongoose");
const Product = require("../models/Product");

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

function validatePrice(value, fieldName) {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw createError(
      `${fieldName} must be a non-negative integer in santim`,
      400
    );
  }
}

// Create a product for the authenticated business only.
async function createProduct(tenantId, input = {}) {
  validateTenantId(tenantId);

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw createError("A valid product object is required", 400);
  }

  if (typeof input.name !== "string" || !input.name.trim()) {
    throw createError("Product name is required", 400);
  }

  const name = input.name.trim();

  if (name.length > 150) {
    throw createError("Product name cannot exceed 150 characters", 400);
  }

  validatePrice(input.costPriceMinor, "Cost price");
  validatePrice(input.sellingPriceMinor, "Selling price");

  const stockQuantity = input.stockQuantity ?? 0;

  if (
    typeof stockQuantity !== "number" ||
    !Number.isFinite(stockQuantity) ||
    stockQuantity < 0
  ) {
    throw createError(
      "Stock quantity must be a non-negative finite number",
      400
    );
  }

  const category = input.category ?? "General";
  const unit = input.unit ?? "piece";

  // Explicitly select allowed fields.
  // Never accept businessId from the client.
  const product = await Product.create({
    businessId: tenantId,
    name,
    category,
    unit,
    costPriceMinor: input.costPriceMinor,
    sellingPriceMinor: input.sellingPriceMinor,
    stockQuantity,
  });

  return product;
}

// Return products belonging to this business only.
async function listProducts(tenantId) {
  validateTenantId(tenantId);

  return Product.find({
    businessId: tenantId,
    isActive: true,
  }).sort({ createdAt: -1 });
}

// Find a particular product inside this business only.
async function getProductById(tenantId, productId) {
  validateTenantId(tenantId);

  if (!mongoose.isValidObjectId(productId)) {
    throw createError("Invalid product ID", 400);
  }

  const product = await Product.findOne({
    _id: productId,
    businessId: tenantId,
    isActive: true,
  });

  if (!product) {
    throw createError("Product not found", 404);
  }

  return product;
}


async function updateProduct(tenantId, productId, input = {}) {
  validateTenantId(tenantId);

  if (!mongoose.isValidObjectId(productId)) {
    throw createError("Invalid product ID", 400);
  }

  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input)
  ) {
    throw createError("A valid product update object is required", 400);
  }

  const allowedFields = [
    "name",
    "category",
    "costPriceMinor",
    "sellingPriceMinor",
  ];

  const protectedFields = [
    "businessId",
    "stockQuantity",
    "unit",
    "isActive",
    "_id",
    "createdAt",
    "updatedAt",
    "__v",
  ];

  const suppliedFields = Object.keys(input);

  // Reject attempts to edit tenant ownership or protected fields.
  const forbiddenField = suppliedFields.find((field) =>
    protectedFields.includes(field)
  );

  if (forbiddenField) {
    throw createError(
      `${forbiddenField} cannot be changed through product editing`,
      400
    );
  }

  // Reject fields this endpoint does not support.
  const unsupportedField = suppliedFields.find(
    (field) => !allowedFields.includes(field)
  );

  if (unsupportedField) {
    throw createError(
      `Unsupported product field: ${unsupportedField}`,
      400
    );
  }

  if (suppliedFields.length === 0) {
    throw createError("At least one field must be provided", 400);
  }

  const updates = {};

  if (Object.hasOwn(input, "name")) {
    if (typeof input.name !== "string" || !input.name.trim()) {
      throw createError("Product name is required", 400);
    }

    const name = input.name.trim();

    if (name.length > 150) {
      throw createError(
        "Product name cannot exceed 150 characters",
        400
      );
    }

    updates.name = name;
  }

  if (Object.hasOwn(input, "category")) {
    if (typeof input.category !== "string") {
      throw createError("Category must be a string", 400);
    }

    const category = input.category.trim();

    if (category.length > 80) {
      throw createError(
        "Category cannot exceed 80 characters",
        400
      );
    }

    updates.category = category;
  }

  if (Object.hasOwn(input, "costPriceMinor")) {
    validatePrice(input.costPriceMinor, "Cost price");
    updates.costPriceMinor = input.costPriceMinor;
  }

  if (Object.hasOwn(input, "sellingPriceMinor")) {
    validatePrice(input.sellingPriceMinor, "Selling price");
    updates.sellingPriceMinor = input.sellingPriceMinor;
  }

  // The businessId in this query is essential for tenant isolation.
  const product = await Product.findOneAndUpdate(
    {
      _id: productId,
      businessId: tenantId,
      isActive: true,
    },
    {
      $set: updates,
    },
    {
  returnDocument: "after",
  runValidators: true,
}
  );

  if (!product) {
    throw createError("Product not found", 404);
  }

  return product;
}


async function deleteProduct(tenantId, productId) {
  validateTenantId(tenantId);

  if (!mongoose.isValidObjectId(productId)) {
    throw createError("Invalid product ID", 400);
  }

  const product = await Product.findOneAndUpdate(
    {
      _id: productId,
      businessId: tenantId,
      isActive: true,
    },
    {
      $set: { isActive: false },
    },
    {
      returnDocument: "after",
      runValidators: true,
    }
  );

  if (!product) {
    throw createError("Product not found", 404);
  }

  return product;
}

module.exports = {
  createProduct,
  listProducts,
  getProductById,
  updateProduct,
  deleteProduct,
};
