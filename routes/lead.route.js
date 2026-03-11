const express = require("express");
const {
  createLead,
  verifyOtp,
  getAllLeads,
  updateLead,
  deleteLead,
  createLeadWithoutOTP,
} = require("../controller/lead.controller");

const router = express.Router();

// Create lead + send OTP
router.post("/create-lead", createLead);
router.post("/create", createLeadWithoutOTP);

// Verify OTP
router.post("/verify-lead", verifyOtp);

// Get all leads (Admin)
router.get("/get-lead", getAllLeads);

// Update lead (Admin)
router.put("/update-lead/:id", updateLead);

// Delete lead (Admin)
router.delete("/delete-lead/:id", deleteLead);

module.exports = router;
