const mongoose = require("mongoose");

const Product = require("../models/Product");
const Customer = require("../models/Customer");
const Sale = require("../models/Sale");
const InventoryMovement = require("../models/InventoryMovement");

const PAYMENT_METHODS = [
  "cash",
  "mobile_money",
  "bank_transfer",
  "other",
];

const MAX_SALE_ITEMS = 100;

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

function isNonNegativeSafeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function calculateMinorTotal(unitPriceMinor, quantity) {
  const total = Math.round(unitPriceMinor * quantity);

  if (!Number.isSafeInteger(total)) {
    throw createError("Sale amount exceeds the supported limit", 400);
  }

  return total;
}

function validateQuantityForUnit(quantity, unit) {
  if (typeof quantity !== "number" ||
      !Number.isFinite(quantity) ||
      quantity <= 0) {
    throw createError("Each item quantity must be a positive number", 400);
  }

  // Piece, box, pack, gram and millilitre stock must be whole units.
  if (["piece", "box", "pack", "g", "ml"].includes(unit)) {
    if (!Number.isSafeInteger(quantity)) {
      throw createError(
        `Quantity for unit "${unit}" must be a whole number`,
        400
      );
    }
    return;
  }

  // Kilograms and litres can be fractional, to three decimal places.
  if (["kg", "litre"].includes(unit)) {
    const scaled = quantity * 1000;

    if (Math.abs(scaled - Math.round(scaled)) > 1e-7) {
      throw createError(
        `Quantity for unit "${unit}" can have at most three decimal places`,
        400
      );
    }
    return;
  }

  throw createError(`Unsupported product unit: ${unit}`, 400);
}

function calculatePaymentStatus(totalAmountMinor, paidAmountMinor) {
  if (paidAmountMinor === totalAmountMinor) {
    return "PAID";
  }

  if (paidAmountMinor === 0) {
    return "UNPAID";
  }

  return "PARTIAL";
}

async function createSale(tenantId, userId, input = {}) {
  validateTenantId(tenantId);

  if (!userId || !mongoose.isValidObjectId(userId)) {
    throw createError("A valid authenticated user is required", 401);
  }

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw createError("A valid sale object is required", 400);
  }

  const allowedFields = [
    "items",
    "customerId",
    "paidAmountMinor",
    "paymentMethod",
    "paymentReference",
    "notes",
  ];

  const unsupportedField = Object.keys(input).find(
    (field) => !allowedFields.includes(field)
  );

  if (unsupportedField) {
    throw createError(`Unsupported sale field: ${unsupportedField}`, 400);
  }

  if (!Array.isArray(input.items) ||
      input.items.length === 0 ||
      input.items.length > MAX_SALE_ITEMS) {
    throw createError(
      `A sale must contain between 1 and ${MAX_SALE_ITEMS} items`,
      400
    );
  }

  if (!Object.hasOwn(input, "paidAmountMinor") ||
      !isNonNegativeSafeInteger(input.paidAmountMinor)) {
    throw createError(
      "paidAmountMinor must be a non-negative integer in santim",
      400
    );
  }

  if (input.notes !== undefined &&
      (typeof input.notes !== "string" || input.notes.length > 500)) {
    throw createError("Notes must be a string of at most 500 characters", 400);
  }

  const notes = (input.notes || "").trim();

  if (notes.length > 500) {
    throw createError("Notes cannot exceed 500 characters", 400);
  }

  const paymentReference = input.paymentReference ?? "";

  if (typeof paymentReference !== "string" ||
      paymentReference.length > 120) {
    throw createError(
      "Payment reference must be a string of at most 120 characters",
      400
    );
  }

  // Only product IDs and quantities are accepted from the client.
  // Prices, item totals, costs and business ownership are server-controlled.
  const requestedItems = [];
  const seenProductIds = new Set();

  for (const item of input.items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw createError("Each sale item must be an object", 400);
    }

    const itemFields = Object.keys(item);

    if (itemFields.some((field) =>
      !["productId", "quantity"].includes(field)
    )) {
      throw createError(
        "Sale items may contain only productId and quantity",
        400
      );
    }

    if (!mongoose.isValidObjectId(item.productId)) {
      throw createError("Each item must have a valid product ID", 400);
    }

    const productId = String(item.productId);

    if (seenProductIds.has(productId)) {
      throw createError(
        "A product may appear only once in a sale; combine its quantities",
        400
      );
    }

    seenProductIds.add(productId);

    if (typeof item.quantity !== "number" ||
        !Number.isFinite(item.quantity) ||
        item.quantity <= 0) {
      throw createError("Each item quantity must be a positive number", 400);
    }

    requestedItems.push({
      productId,
      quantity: item.quantity,
    });
  }

  const session = await mongoose.startSession();
  let createdSale;

  try {
    await session.withTransaction(
      async () => {
        // Find active products owned by this business only.
        const productIds = requestedItems.map((item) => item.productId);

        const products = await Product.find({
          _id: { $in: productIds },
          businessId: tenantId,
          isActive: true,
        }).session(session);

        if (products.length !== requestedItems.length) {
          throw createError(
            "One or more products could not be found in this business",
            404
          );
        }

        const productsById = new Map(
          products.map((product) => [product._id.toString(), product])
        );

        const saleItems = requestedItems.map((requestedItem) => {
          const product = productsById.get(requestedItem.productId);
          const quantity = requestedItem.quantity;

          validateQuantityForUnit(quantity, product.unit);

          if (!isNonNegativeSafeInteger(product.costPriceMinor) ||
              !isNonNegativeSafeInteger(product.sellingPriceMinor)) {
            throw createError(
              `Product "${product.name}" has an invalid price`,
              409
            );
          }

          return {
            product,
            quantity,
            productId: product._id,
            productName: product.name,
            unit: product.unit,
            costPriceMinor: product.costPriceMinor,
            sellingPriceMinor: product.sellingPriceMinor,
            costTotalMinor: calculateMinorTotal(
              product.costPriceMinor,
              quantity
            ),
            lineTotalMinor: calculateMinorTotal(
              product.sellingPriceMinor,
              quantity
            ),
          };
        });

        const totalAmountMinor = saleItems.reduce(
          (sum, item) => sum + item.lineTotalMinor,
          0
        );

        const totalCostMinor = saleItems.reduce(
          (sum, item) => sum + item.costTotalMinor,
          0
        );

        if (!Number.isSafeInteger(totalAmountMinor) ||
            !Number.isSafeInteger(totalCostMinor)) {
          throw createError("Sale total exceeds the supported limit", 400);
        }

        const paidAmountMinor = input.paidAmountMinor;

        if (paidAmountMinor > totalAmountMinor) {
          throw createError(
            "Payment cannot exceed the sale total",
            400
          );
        }

        const balanceDueMinor = totalAmountMinor - paidAmountMinor;

        let customerId = null;

        if (input.customerId !== undefined &&
            input.customerId !== null &&
            input.customerId !== "") {
          if (!mongoose.isValidObjectId(input.customerId)) {
            throw createError("Invalid customer ID", 400);
          }

          const customer = await Customer.findOne({
            _id: input.customerId,
            businessId: tenantId,
            isActive: true,
          }).session(session);

          if (!customer) {
            throw createError("Customer not found", 404);
          }

          customerId = customer._id;
        }

        if (balanceDueMinor > 0 && !customerId) {
          throw createError(
            "A customer is required for a sale with an outstanding balance",
            400
          );
        }

        let payments = [];

        if (paidAmountMinor > 0) {
          if (!PAYMENT_METHODS.includes(input.paymentMethod)) {
            throw createError(
              `Payment method must be one of: ${PAYMENT_METHODS.join(", ")}`,
              400
            );
          }

          payments = [{
            amountMinor: paidAmountMinor,
            method: input.paymentMethod,
            reference: paymentReference.trim(),
            receivedBy: userId,
            paidAt: new Date(),
          }];
        } else if (input.paymentMethod !== undefined ||
                   input.paymentReference !== undefined) {
          throw createError(
            "A payment method or reference requires a positive payment amount",
            400
          );
        }

        // Conditional stock updates prevent overselling.
// Capture actual quantities so the audit history reflects each stock change.
const saleMovements = [];

for (const item of saleItems) {
  const updatedProduct = await Product.findOneAndUpdate(
    {
      _id: item.productId,
      businessId: tenantId,
      isActive: true,
      stockQuantity: { $gte: item.quantity },
    },
    { $inc: { stockQuantity: -item.quantity } },
    { session, returnDocument: "after" }
  );

  if (!updatedProduct) {
    throw createError(
      `Insufficient stock for product "${item.productName}"`,
      409
    );
  }

  saleMovements.push({
    businessId: tenantId,
    productId: item.productId,
    movementType: "SALE",
    quantity: item.quantity,
    stockBefore: updatedProduct.stockQuantity + item.quantity,
    stockAfter: updatedProduct.stockQuantity,
    reason: "Stock reduced by completed sale",
    performedBy: userId,
    referenceType: "SALE",
  });
}

const documents = await Sale.create(
          [{
            businessId: tenantId,
            customerId,
            soldBy: userId,
            items: saleItems.map((item) => ({
              productId: item.productId,
              productName: item.productName,
              unit: item.unit,
              quantity: item.quantity,
              costPriceMinor: item.costPriceMinor,
              sellingPriceMinor: item.sellingPriceMinor,
              costTotalMinor: item.costTotalMinor,
              lineTotalMinor: item.lineTotalMinor,
            })),
            totalAmountMinor,
            totalCostMinor,
            paidAmountMinor,
            balanceDueMinor,
            paymentStatus: calculatePaymentStatus(
              totalAmountMinor,
              paidAmountMinor
            ),
            payments,
            notes,
          }],
          { session }
        );

        createdSale = documents[0];

        if (saleMovements.length > 0) {
          await InventoryMovement.insertMany(
            saleMovements.map((movement) => ({
              ...movement,
              referenceId: createdSale._id,
            })),
            { session }
          );
        }
      },
      {
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
      }
    );

    return createdSale;
  } finally {
    await session.endSession();
  }
}


async function recordSalePayment(tenantId, userId, saleId, input = {}) {
  validateTenantId(tenantId);

  if (!userId || !mongoose.isValidObjectId(userId)) {
    throw createError("A valid authenticated user is required", 401);
  }

  if (!mongoose.isValidObjectId(saleId)) {
    throw createError("Invalid sale ID", 400);
  }

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw createError("A valid payment object is required", 400);
  }

  const allowedFields = ["amountMinor", "paymentMethod", "reference"];
  const unsupportedField = Object.keys(input).find(
    (field) => !allowedFields.includes(field)
  );

  if (unsupportedField) {
    throw createError(`Unsupported payment field: ${unsupportedField}`, 400);
  }

  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw createError(
      "amountMinor must be a positive integer in santim",
      400
    );
  }

  if (!PAYMENT_METHODS.includes(input.paymentMethod)) {
    throw createError(
      `Payment method must be one of: ${PAYMENT_METHODS.join(", ")}`,
      400
    );
  }

  const reference = input.reference ?? "";

  if (typeof reference !== "string" || reference.length > 120) {
    throw createError(
      "Payment reference must be a string of at most 120 characters",
      400
    );
  }

  const session = await mongoose.startSession();
  let updatedSale;

  try {
    await session.withTransaction(
      async () => {
        // The business filter prevents cross-business payment access.
        const sale = await Sale.findOne({
          _id: saleId,
          businessId: tenantId,
        }).session(session);

        if (!sale) {
          throw createError("Sale not found", 404);
        }

        if (sale.balanceDueMinor <= 0) {
          throw createError("Sale is already fully paid", 409);
        }

        if (input.amountMinor > sale.balanceDueMinor) {
          throw createError(
            "Payment exceeds the outstanding balance",
            400
          );
        }

        const newPaidAmount =
          sale.paidAmountMinor + input.amountMinor;

        if (!Number.isSafeInteger(newPaidAmount)) {
          throw createError("Payment total exceeds the supported limit", 400);
        }

        sale.payments.push({
          amountMinor: input.amountMinor,
          method: input.paymentMethod,
          reference: reference.trim(),
          receivedBy: userId,
          paidAt: new Date(),
        });

        sale.paidAmountMinor = newPaidAmount;
        sale.balanceDueMinor = sale.totalAmountMinor - newPaidAmount;
        sale.paymentStatus = calculatePaymentStatus(
          sale.totalAmountMinor,
          newPaidAmount
        );

        // Save the payment history and updated balance together.
        await sale.save({ session });

        updatedSale = sale;
      },
      {
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
      }
    );

    return updatedSale;
  } finally {
    await session.endSession();
  }
}


function parseDateOnly(value, fieldName) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
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

// List sales for the authenticated business, newest first.
async function listSales(tenantId, filters = {}) {
  validateTenantId(tenantId);

  if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
    throw createError("Invalid sales filters", 400);
  }

  const allowedFields = ["page", "limit", "startDate", "endDate"];
  const unsupportedField = Object.keys(filters).find(
    (field) => !allowedFields.includes(field)
  );

  if (unsupportedField) {
    throw createError(`Unsupported sales filter: ${unsupportedField}`, 400);
  }

  const page = parsePositiveIntegerQuery(filters.page, "page", 1, 1000000);
  const limit = parsePositiveIntegerQuery(filters.limit, "limit", 20, 100);
  const skip = (page - 1) * limit;

  if (!Number.isSafeInteger(skip)) {
    throw createError("Requested page is too large", 400);
  }

  const match = { businessId: tenantId };
  const createdAt = {};

  let startDate;
  let endDate;

  if (filters.startDate !== undefined) {
    startDate = parseDateOnly(filters.startDate, "startDate");
    createdAt.$gte = startDate;
  }

  if (filters.endDate !== undefined) {
    endDate = parseDateOnly(filters.endDate, "endDate");
    endDate.setUTCDate(endDate.getUTCDate() + 1);
    createdAt.$lt = endDate;
  }

  if (
    startDate &&
    endDate &&
    endDate.getTime() - 86400000 < startDate.getTime()
  ) {
    throw createError("endDate must be on or after startDate", 400);
  }

  if (Object.keys(createdAt).length > 0) {
    match.createdAt = createdAt;
  }

  const [sales, totalItems] = await Promise.all([
    Sale.find(match)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit),
    Sale.countDocuments(match),
  ]);

  return {
    sales,
    pagination: {
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    },
  };
}

// A sale ID alone is not enough: always include the business ID.
async function getSaleById(tenantId, saleId) {
  validateTenantId(tenantId);

  if (!mongoose.isValidObjectId(saleId)) {
    throw createError("Invalid sale ID", 400);
  }

  const sale = await Sale.findOne({
    _id: saleId,
    businessId: tenantId,
  });

  if (!sale) {
    throw createError("Sale not found", 404);
  }

  return sale;
}



// Cancel a sale and restore inventory atomically.
async function cancelSale(tenantId, userId, saleId, input = {}) {
  validateTenantId(tenantId);

  if (!userId || !mongoose.isValidObjectId(userId)) {
    throw createError("A valid authenticated user is required", 401);
  }

  if (!mongoose.isValidObjectId(saleId)) {
    throw createError("Invalid sale ID", 400);
  }

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw createError("A valid cancellation object is required", 400);
  }

  if (Object.keys(input).some((key) => key !== "reason")) {
    throw createError("Only the cancellation reason is allowed", 400);
  }

  if (typeof input.reason !== "string" || !input.reason.trim()) {
    throw createError("A cancellation reason is required", 400);
  }

  const reason = input.reason.trim();

  if (reason.length > 500) {
    throw createError("Cancellation reason cannot exceed 500 characters", 400);
  }

  const session = await mongoose.startSession();
  let cancelledSale;

  try {
    await session.withTransaction(
      async () => {
        const sale = await Sale.findOne({
          _id: saleId,
          businessId: tenantId,
        }).session(session);

        if (!sale) {
          throw createError("Sale not found", 404);
        }

        if (sale.saleStatus !== "COMPLETED") {
          throw createError("Sale has already been cancelled", 409);
        }

        // Restore stock and record each restoration in the same transaction.
// Deactivated products can still have their stock restored.
for (const item of sale.items) {
  const updatedProduct = await Product.findOneAndUpdate(
    {
      _id: item.productId,
      businessId: tenantId,
    },
    { $inc: { stockQuantity: item.quantity } },
    { session, returnDocument: "after" }
  );

  if (!updatedProduct) {
    throw createError(
      `Cannot restore stock for "${item.productName}". ` +
      "Cancellation was aborted.",
      409
    );
  }

  await InventoryMovement.create(
    [{
      businessId: tenantId,
      productId: item.productId,
      movementType: "SALE_CANCELLATION",
      quantity: item.quantity,
      stockBefore: updatedProduct.stockQuantity - item.quantity,
      stockAfter: updatedProduct.stockQuantity,
      reason,
      performedBy: userId,
      referenceType: "SALE_CANCELLATION",
      referenceId: sale._id,
    }],
    { session }
  );
}

// Preserve original payments and totals for audit history.
        sale.saleStatus = "CANCELLED";
        sale.cancelledAt = new Date();
        sale.cancelledBy = userId;
        sale.cancellationReason = reason;
        sale.balanceDueAtCancellationMinor = sale.balanceDueMinor;
        sale.balanceDueMinor = 0;

        await sale.save({ session });
        cancelledSale = sale;
      },
      {
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
      }
    );

    return cancelledSale;
  } finally {
    await session.endSession();
  }
}

// Export the cancellation function alongside the existing services.

// Record a refund against a cancelled sale without erasing original payments.
async function recordSaleRefund(tenantId, userId, saleId, input = {}) {
  validateTenantId(tenantId);

  if (!userId || !mongoose.isValidObjectId(userId)) {
    throw createError("A valid authenticated user is required", 401);
  }

  if (!mongoose.isValidObjectId(saleId)) {
    throw createError("Invalid sale ID", 400);
  }

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw createError("A valid refund object is required", 400);
  }

  const allowedFields = ["amountMinor", "method", "reference", "reason"];
  const unsupportedField = Object.keys(input).find(
    (field) => !allowedFields.includes(field)
  );

  if (unsupportedField) {
    throw createError(`Unsupported refund field: ${unsupportedField}`, 400);
  }

  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw createError(
      "amountMinor must be a positive integer in santim",
      400
    );
  }

  if (!PAYMENT_METHODS.includes(input.method)) {
    throw createError(
      `Refund method must be one of: ${PAYMENT_METHODS.join(", ")}`,
      400
    );
  }

  if (typeof input.reason !== "string" || !input.reason.trim()) {
    throw createError("A refund reason is required", 400);
  }

  const reason = input.reason.trim();

  if (reason.length > 500) {
    throw createError("Refund reason cannot exceed 500 characters", 400);
  }

  const reference = input.reference ?? "";

  if (typeof reference !== "string" || reference.length > 120) {
    throw createError(
      "Refund reference must be a string of at most 120 characters",
      400
    );
  }

  const session = await mongoose.startSession();
  let updatedSale;

  try {
    await session.withTransaction(
      async () => {
        const sale = await Sale.findOne({
          _id: saleId,
          businessId: tenantId,
        }).session(session);

        if (!sale) {
          throw createError("Sale not found", 404);
        }

        if (sale.saleStatus !== "CANCELLED") {
          throw createError(
            "Only cancelled sales can be refunded through this endpoint",
            409
          );
        }

        const alreadyRefundedMinor = (sale.refunds || []).reduce(
          (sum, refund) => sum + refund.amountMinor,
          0
        );

        const refundableMinor =
          sale.paidAmountMinor - alreadyRefundedMinor;

        if (input.amountMinor > refundableMinor) {
          throw createError(
            "Refund exceeds the amount collected minus previous refunds",
            400
          );
        }

        sale.refunds.push({
          amountMinor: input.amountMinor,
          method: input.method,
          reference: reference.trim(),
          reason,
          refundedBy: userId,
          refundedAt: new Date(),
        });

        // Keep the original payments and sale totals as historical facts.
        await sale.save({ session });

        updatedSale = sale;
      },
      {
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
      }
    );

    return updatedSale;
  } finally {
    await session.endSession();
  }
}

module.exports = {
  createSale,
  recordSalePayment,
  listSales,
  getSaleById,
  cancelSale,
  recordSaleRefund,
};
