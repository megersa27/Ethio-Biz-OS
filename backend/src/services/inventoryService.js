const mongoose = require("mongoose");
const Product = require("../models/Product");
const InventoryMovement = require("../models/InventoryMovement");

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function validateObjectId(value, fieldName) {
  if (!value || !mongoose.isValidObjectId(value)) {
    throw createError(`A valid ${fieldName} is required`, 400);
  }
}

function validateTenantId(tenantId) {
  if (!tenantId || !mongoose.isValidObjectId(tenantId)) {
    throw createError("A valid business context is required", 403);
  }
}

const movementDirections = {
  RECEIVED: 1,
  ADJUSTMENT_INCREASE: 1,
  DAMAGED: -1,
  EXPIRED: -1,
  ADJUSTMENT_DECREASE: -1,
};

// Record a manual inventory movement.
// The product update and audit record commit together.
async function recordInventoryMovement(
  tenantId,
  userId,
  input = {}
) {
  validateTenantId(tenantId);
  validateObjectId(userId, "user ID");

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw createError("A valid inventory movement object is required", 400);
  }

  const allowedFields = [
    "productId",
    "movementType",
    "quantity",
    "reason",
  ];

  const unsupportedField = Object.keys(input).find(
    (field) => !allowedFields.includes(field)
  );

  if (unsupportedField) {
    throw createError(
      `Unsupported inventory movement field: ${unsupportedField}`,
      400
    );
  }

  validateObjectId(input.productId, "product ID");

  const direction = movementDirections[input.movementType];

  if (!direction) {
    throw createError(
      "Invalid movement type. Use RECEIVED, DAMAGED, EXPIRED, " +
        "ADJUSTMENT_INCREASE, or ADJUSTMENT_DECREASE",
      400
    );
  }

  if (
    typeof input.quantity !== "number" ||
    !Number.isFinite(input.quantity) ||
    input.quantity <= 0
  ) {
    throw createError(
      "Movement quantity must be a positive finite number",
      400
    );
  }

  if (
    typeof input.reason !== "string" ||
    !input.reason.trim()
  ) {
    throw createError("A reason is required for the stock movement", 400);
  }

  const reason = input.reason.trim();

  if (reason.length > 500) {
    throw createError("Reason cannot exceed 500 characters", 400);
  }

  const session = await mongoose.startSession();
  let savedMovement;

  try {
    await session.withTransaction(async () => {
      const stockChange = direction * input.quantity;

      const updatedProduct = await Product.findOneAndUpdate(
        {
          _id: input.productId,
          businessId: tenantId,
          isActive: true,
          ...(direction < 0
            ? { stockQuantity: { $gte: input.quantity } }
            : {}),
        },
        {
          $inc: { stockQuantity: stockChange },
        },
        {
          session,
          returnDocument: "after",
          runValidators: true,
        }
      );

      if (!updatedProduct) {
        const productExists = await Product.exists({
          _id: input.productId,
          businessId: tenantId,
          isActive: true,
        }).session(session);

        if (!productExists) {
          throw createError("Product not found", 404);
        }

        throw createError(
          "Insufficient stock for this inventory movement",
          409
        );
      }

      const stockAfter = updatedProduct.stockQuantity;
      const stockBefore = stockAfter - stockChange;

      const movements = await InventoryMovement.create(
        [
          {
            businessId: tenantId,
            productId: updatedProduct._id,
            movementType: input.movementType,
            quantity: input.quantity,
            stockBefore,
            stockAfter,
            reason,
            performedBy: userId,
          },
        ],
        { session }
      );

      savedMovement = movements[0];
    });
  } finally {
    await session.endSession();
  }

  return savedMovement;
}

// List movement history for this business only.
// Supports optional product filtering and pagination.
async function listInventoryMovements(tenantId, options = {}) {
  validateTenantId(tenantId);

  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw createError("Valid movement history options are required", 400);
  }

  const page = options.page === undefined ? 1 : Number(options.page);
  const limit = options.limit === undefined ? 20 : Number(options.limit);

  if (!Number.isSafeInteger(page) || page < 1) {
    throw createError("Page must be a positive integer", 400);
  }

  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw createError("Limit must be an integer between 1 and 100", 400);
  }

  const filter = { businessId: tenantId };

  if (options.productId !== undefined) {
    validateObjectId(options.productId, "product ID");
    filter.productId = options.productId;
  }

  const skip = (page - 1) * limit;

  const [movements, total] = await Promise.all([
    InventoryMovement.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .populate("productId", "name unit"),
    InventoryMovement.countDocuments(filter),
  ]);

  return {
    movements,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

module.exports = {
  recordInventoryMovement,
  listInventoryMovements,
};
