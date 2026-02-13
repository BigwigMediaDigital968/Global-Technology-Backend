const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    userId: String,
    name: String,
    email: {
      type: String,
      unique: true,
      required: true,
    },
    phone: String,
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      default: "user",
    },
    isVerified: {
      type: Boolean,
      default: false,
    },

    // OTP (for register)
    otp: String,
    otpExpiresAt: Date,

    // RESET PASSWORD FIELDS
    resetPasswordToken: String,
    resetPasswordExpires: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
