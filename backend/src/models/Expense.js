const mongoose = require("mongoose");

// An expense records money the business spent.
// Amounts are integers measured in santim (100 santim = 1 ETB),
// matching the rest of the financial models.
const expenseSchema = new mongoose.Schema(
  {
    // Every expense belongs to exactly one business.
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: [true, "Business ID is required"],
    },

    category: {
      type: String,
      required: [true, "Expense category is required"],
      trim: true,
      maxlength: [80, "Category cannot exceed 80 characters"],
    },

    // Integer santim, greater than zero.
    amountMinor: {
      type: Number,
      required: [true, "Expense amount is required"],
      min: [1, "Expense amount must be greater than zero"],
      validate: {
        validator: Number.isSafeInteger,
        message: "Expense amount must be a whole number of santim",
      },
    },

    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: [500, "Description cannot exceed 500 characters"],
    },

    // The business date the expense was incurred (separate from createdAt).
    date: {
      type: Date,
      required: [true, "Expense date is required"],
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
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

// Efficient period queries scoped to one business.
expenseSchema.index({ businessId: 1, date: -1 });
expenseSchema.index({ businessId: 1, createdAt: -1 });
// Support per-category reporting within a business.
expenseSchema.index({ businessId: 1, category: 1, date: -1 });

module.exports = mongoose.model("Expense", expenseSchema);
