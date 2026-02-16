const express = require("express");

const {
  registerUser,
  verifyOtp,
  loginUser,
  forgotPassword,
  resetPassword,
  getProfile,
  updateMyProfile,
  getAllUsers,
  updateUserByAdmin,
  deleteUser,
} = require("../controller/user.controller");

const { protect, adminOnly } = require("../middleware/auth.middleware");

const router = express.Router();

// PUBLIC
router.post("/register", registerUser);
router.post("/verify-otp", verifyOtp);
router.post("/login", loginUser);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

// USER
router.get("/profile", protect, getProfile);
router.put("/update", protect, updateMyProfile);

// ADMIN
router.get("/all-users", protect, adminOnly, getAllUsers);
router.put("/admin/update/:id", protect, adminOnly, updateUserByAdmin);
router.delete("/delete/:id", protect, adminOnly, deleteUser);

module.exports = router;
