
const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    // Every product belongs to exactly one business.
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: [true, "Business ID is required"],
    },

    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      maxlength: [150, "Product name cannot exceed 150 characters"],
    },

    category: {
      type: String,
      trim: true,
      default: "General",
      maxlength: [80, "Category cannot exceed 80 characters"],
    },

    unit: {
      type: String,
      enum: ["piece", "kg", "g", "litre", "ml", "box", "pack"],
      default: "piece",
      required: true,
    },

    // Prices use integer santim: 100 santim = 1 ETB.
    costPriceMinor: {
      type: Number,
      required: [true, "Cost price is required"],
      min: [0, "Cost price cannot be negative"],
      validate: {
        validator: Number.isSafeInteger,
        message: "Cost price must be a whole number of santim",
      },
    },

    sellingPriceMinor: {
      type: Number,
      required: [true, "Selling price is required"],
      min: [0, "Selling price cannot be negative"],
      validate: {
        validator: Number.isSafeInteger,
        message: "Selling price must be a whole number of santim",
      },
    },

    stockQuantity: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Stock quantity cannot be negative"],
      validate: {
        validator: (value) => Number.isFinite(value),
        message: "Stock quantity must be a finite number",
      },
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Efficiently find products belonging to one business.
productSchema.index({ businessId: 1, name: 1 });
productSchema.index({ businessId: 1, createdAt: -1 });

module.exports = mongoose.model("Product", productSchema);