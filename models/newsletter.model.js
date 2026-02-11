const mongoose = require("mongoose");

const NewsletterSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    source: {
      type: String,
      enum: ["newsletter-form", "lead-verification"],
      default: "newsletter-form",
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    subscribedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Newsletter", NewsletterSchema);
