
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: [true, "Business ID is required"],
      index: true,
    },

    name: {
      type: String,
      required: [true, "User name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
      set: (value) =>
        typeof value === "string" && value.trim()
          ? value.trim().toLowerCase()
          : null,
    },

    phone: {
      type: String,
      trim: true,
      default: null,
      set: (value) =>
        typeof value === "string" && value.trim()
          ? value.trim()
          : null,
    },

    passwordHash: {
      type: String,
      required: [true, "Password hash is required"],
      select: false,
    },

    role: {
      type: String,
      enum: ["OWNER", "STAFF"],
      default: "STAFF",
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

// Require at least one login identifier.
userSchema.pre("validate", function () {
  if (!this.email && !this.phone) {
    this.invalidate(
      "email",
      "An email address or phone number is required"
    );
  }
});

// Enforce unique email addresses when an email is provided.
userSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $type: "string" } },
  }
);

// Enforce unique phone numbers when a phone is provided.
userSchema.index(
  { phone: 1 },
  {
    unique: true,
    partialFilterExpression: { phone: { $type: "string" } },
  }
);

module.exports = mongoose.model("User", userSchema);