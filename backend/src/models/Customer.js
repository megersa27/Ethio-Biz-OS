const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    // A customer record belongs to one business.
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: [true, "Customer name is required"],
      trim: true,
      maxlength: [150, "Customer name cannot exceed 150 characters"],
    },

    phone: {
      type: String,
      trim: true,
      default: "",
      maxlength: [30, "Phone number cannot exceed 30 characters"],
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      maxlength: [254, "Email cannot exceed 254 characters"],
    },

    address: {
      type: String,
      trim: true,
      default: "",
      maxlength: [300, "Address cannot exceed 300 characters"],
    },

    notes: {
      type: String,
      trim: true,
      default: "",
      maxlength: [500, "Notes cannot exceed 500 characters"],
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

// Support searches within the authenticated business.
customerSchema.index({ businessId: 1, name: 1 });
customerSchema.index({ businessId: 1, phone: 1 });

module.exports = mongoose.model("Customer", customerSchema);
