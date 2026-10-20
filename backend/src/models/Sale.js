const mongoose = require("mongoose");

function isNonNegativeSafeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

// Preserve product details as they were at the time of sale.
const saleItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    productName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    unit: {
      type: String,
      enum: ["piece", "kg", "g", "litre", "ml", "box", "pack"],
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      validate: {
        validator: (value) => Number.isFinite(value) && value > 0,
        message: "Quantity must be a positive finite number",
      },
    },

    // Prices and totals are integers measured in santim.
    costPriceMinor: {
      type: Number,
      required: true,
      validate: {
        validator: isNonNegativeSafeInteger,
        message: "Cost price must be a non-negative integer in santim",
      },
    },

    sellingPriceMinor: {
      type: Number,
      required: true,
      validate: {
        validator: isNonNegativeSafeInteger,
        message: "Selling price must be a non-negative integer in santim",
      },
    },

    costTotalMinor: {
      type: Number,
      required: true,
      validate: {
        validator: isNonNegativeSafeInteger,
        message: "Cost total must be a non-negative integer in santim",
      },
    },

    lineTotalMinor: {
      type: Number,
      required: true,
      validate: {
        validator: isNonNegativeSafeInteger,
        message: "Line total must be a non-negative integer in santim",
      },
    },
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    amountMinor: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: "Payment amount must be an integer in santim",
      },
    },

    method: {
      type: String,
      enum: ["cash", "mobile_money", "bank_transfer", "other"],
      required: true,
    },

    reference: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },

    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    paidAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  { _id: false }
);

const refundSchema = new mongoose.Schema(
  {
    amountMinor: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: (value) => Number.isSafeInteger(value) && value > 0,
        message: "Refund amount must be a positive integer in santim",
      },
    },

    method: {
      type: String,
      enum: ["cash", "mobile_money", "bank_transfer", "other"],
      required: true,
    },

    reference: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },

    reason: {
      type: String,
      trim: true,
      required: true,
      maxlength: 500,
    },

    refundedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    refundedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  { timestamps: false }
);

const saleSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },

    saleStatus: {
      type: String,
      enum: ["COMPLETED", "CANCELLED"],
      default: "COMPLETED",
      required: true,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    cancellationReason: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },

    balanceDueAtCancellationMinor: {
      type: Number,
      default: null,
      validate: {
        validator: (value) =>
          value === null || isNonNegativeSafeInteger(value),
        message: "Cancellation balance must be a non-negative integer in santim",
      },
    },

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },

    soldBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    items: {
      type: [saleItemSchema],
      required: true,
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: "A sale must contain at least one item",
      },
    },

    totalAmountMinor: {
      type: Number,
      required: true,
      validate: {
        validator: isNonNegativeSafeInteger,
        message: "Sale total must be a non-negative integer in santim",
      },
    },

    totalCostMinor: {
      type: Number,
      required: true,
      validate: {
        validator: isNonNegativeSafeInteger,
        message: "Total cost must be a non-negative integer in santim",
      },
    },

    paidAmountMinor: {
      type: Number,
      required: true,
      validate: {
        validator: isNonNegativeSafeInteger,
        message: "Paid amount must be a non-negative integer in santim",
      },
    },

    balanceDueMinor: {
      type: Number,
      required: true,
      validate: {
        validator: isNonNegativeSafeInteger,
        message: "Outstanding balance must be a non-negative integer in santim",
      },
    },

    paymentStatus: {
      type: String,
      enum: ["PAID", "PARTIAL", "UNPAID"],
      required: true,
    },

    payments: {
      type: [paymentSchema],
      default: [],
    },

    refunds: {
      type: [refundSchema],
      default: [],
    },

    notes: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

// Efficiently retrieve recent sales within a business.
saleSchema.index({ businessId: 1, createdAt: -1 });
saleSchema.index({ businessId: 1, customerId: 1, createdAt: -1 });

// Validate relationships between sale totals, balances and payments.
saleSchema.pre("validate", function () {
  const items = this.items || [];
  const payments = this.payments || [];

  if (items.length > 0) {
    const itemTotalsValid = items.every(
      (item) =>
        isNonNegativeSafeInteger(item.lineTotalMinor) &&
        isNonNegativeSafeInteger(item.costTotalMinor)
    );

    if (itemTotalsValid) {
      const itemTotal = items.reduce(
        (sum, item) => sum + item.lineTotalMinor,
        0
      );
      const itemCost = items.reduce(
        (sum, item) => sum + item.costTotalMinor,
        0
      );

      if (
        !Number.isSafeInteger(itemTotal) ||
        itemTotal !== this.totalAmountMinor
      ) {
        this.invalidate(
          "totalAmountMinor",
          "Sale total must equal the sum of item totals"
        );
      }

      if (
        !Number.isSafeInteger(itemCost) ||
        itemCost !== this.totalCostMinor
      ) {
        this.invalidate(
          "totalCostMinor",
          "Total cost must equal the sum of item costs"
        );
      }
    }
  }

  const refunds = this.refunds || [];
  const refundTotal = refunds.reduce(
    (sum, refund) => sum + refund.amountMinor,
    0
  );

  if (
    !Number.isSafeInteger(refundTotal) ||
    refundTotal < 0 ||
    refundTotal > this.paidAmountMinor
  ) {
    this.invalidate(
      "refunds",
      "Total refunds cannot exceed the amount originally collected"
    );
  }

  const paymentTotal = payments.reduce(
    (sum, payment) => sum + payment.amountMinor,
    0
  );

  if (
    !Number.isSafeInteger(paymentTotal) ||
    paymentTotal !== this.paidAmountMinor
  ) {
    this.invalidate(
      "paidAmountMinor",
      "Paid amount must equal the recorded payments"
    );
  }

  if (
    Number.isSafeInteger(this.totalAmountMinor) &&
    Number.isSafeInteger(this.paidAmountMinor) &&
    Number.isSafeInteger(this.balanceDueMinor)
  ) {
    if (
      this.saleStatus !== "CANCELLED" &&
      this.paidAmountMinor + this.balanceDueMinor !==
      this.totalAmountMinor
    ) {
      this.invalidate(
        "balanceDueMinor",
        "Paid amount plus outstanding balance must equal the sale total"
      );
    }

    const expectedStatus =
      this.paidAmountMinor === this.totalAmountMinor
        ? "PAID"
        : this.paidAmountMinor === 0
          ? "UNPAID"
          : "PARTIAL";

    if (this.paymentStatus !== expectedStatus) {
      this.invalidate(
        "paymentStatus",
        "Payment status does not match the payment amounts"
      );
    }
  }

  if (this.saleStatus === "CANCELLED") {
    if (!this.cancelledAt) {
      this.invalidate("cancelledAt", "Cancellation time is required");
    }

    if (!this.cancelledBy) {
      this.invalidate("cancelledBy", "Cancelling user is required");
    }

    if (!isNonNegativeSafeInteger(this.balanceDueAtCancellationMinor)) {
      this.invalidate(
        "balanceDueAtCancellationMinor",
        "Original outstanding balance is required"
      );
    } else if (
      this.paidAmountMinor + this.balanceDueAtCancellationMinor !==
      this.totalAmountMinor
    ) {
      this.invalidate(
        "balanceDueAtCancellationMinor",
        "Paid amount plus original balance must equal the sale total"
      );
    }

    if (this.balanceDueMinor !== 0) {
      this.invalidate(
        "balanceDueMinor",
        "A cancelled sale cannot retain a collectible balance"
      );
    }
  } else if (
    this.cancelledAt ||
    this.cancelledBy ||
    this.cancellationReason ||
    this.balanceDueAtCancellationMinor !== null
  ) {
    this.invalidate(
      "saleStatus",
      "Cancellation details require a cancelled sale"
    );
  }

  if (this.balanceDueMinor > 0 && !this.customerId) {
    this.invalidate(
      "customerId",
      "A customer is required for an unpaid balance"
    );
  }
});

module.exports = mongoose.model("Sale", saleSchema);
