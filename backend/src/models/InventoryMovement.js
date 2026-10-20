const mongoose = require("mongoose");

// Each document records one stock-changing event.
// Movement records are intended to be historical audit records.
const inventoryMovementSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: false,
    },

    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    movementType: {
      type: String,
      enum: [
        "RECEIVED",
        "DAMAGED",
        "EXPIRED",
        "ADJUSTMENT_INCREASE",
        "ADJUSTMENT_DECREASE",
        "SALE",
        "SALE_CANCELLATION",
      ],
      required: true,
    },

    // Absolute quantity changed; may be fractional for kg, litres, etc.
    quantity: {
      type: Number,
      required: true,
      min: [0, "Movement quantity must be greater than zero"],
      validate: {
        validator: (value) =>
          Number.isFinite(value) && value > 0,
        message: "Movement quantity must be a positive finite number",
      },
    },

    stockBefore: {
      type: Number,
      required: true,
      min: [0, "Stock before cannot be negative"],
      validate: {
        validator: Number.isFinite,
        message: "Stock before must be a finite number",
      },
    },

    stockAfter: {
      type: Number,
      required: true,
      min: [0, "Stock after cannot be negative"],
      validate: {
        validator: Number.isFinite,
        message: "Stock after must be a finite number",
      },
    },

    reason: {
      type: String,
      required: [true, "A reason is required for every stock movement"],
      trim: true,
      maxlength: [500, "Reason cannot exceed 500 characters"],
    },

    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Optional links to the sale or cancellation that caused the movement.
    referenceType: {
      type: String,
      enum: ["SALE", "SALE_CANCELLATION"],
    },

    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  }
);

// Efficient history queries scoped to one business.
inventoryMovementSchema.index({
  businessId: 1,
  createdAt: -1,
});

// Efficient history queries for one product within one business.
inventoryMovementSchema.index({
  businessId: 1,
  productId: 1,
  createdAt: -1,
});

// Helps find movements linked to a specific sale or cancellation.
inventoryMovementSchema.index({
  businessId: 1,
  referenceType: 1,
  referenceId: 1,
});

module.exports = mongoose.model(
  "InventoryMovement",
  inventoryMovementSchema
);
