const Lead = require("../models/leadmodel");
const sendEmail = require("../utils/sendEmail");

/* =======================
   Helper: Generate OTP
======================= */
const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();
const Newsletter = require("../models/newsletter.model");

/* =======================
   CREATE LEAD + SEND OTP
======================= */
// exports.createLead = async (req, res) => {
//   try {
//     const { name, email, phone, message } = req.body;

//     if (!name || !email || !phone || !message) {
//       return res.status(400).json({ message: "All fields are required" });
//     }

//     // Check existing email
//     const existingLead = await Lead.findOne({ email });
//     if (existingLead) {
//       return res.status(409).json({ message: "Email already exists" });
//     }

//     const otp = generateOTP();

//     const lead = await Lead.create({
//       name,
//       email,
//       phone,
//       message,
//       otp,
//       otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
//     });

//     // 📩 Send OTP to user
//     await sendEmail({
//       to: email,
//       subject: "OTP Verification - Global Technologies",
//       html: `
//         <p>Hello ${name},</p>
//         <p>Your OTP is:</p>
//         <h2>${otp}</h2>
//         <p>Valid for 5 minutes.</p>
//       `,
//     });

//     // 📩 Send lead details to admin (even if not verified)
//     await sendEmail({
//       to: "anuragkumarmait@gmail.com",
//       subject: "New Lead Received - Global Technologies",
//       html: `
//         <h3>New Lead</h3>
//         <p><b>Name:</b> ${name}</p>
//         <p><b>Email:</b> ${email}</p>
//         <p><b>Phone:</b> ${phone}</p>
//         <p><b>Message:</b> ${message}</p>
//         <p><b>Verified:</b> ❌</p>
//       `,
//     });

//     res.status(201).json({
//       success: true,
//       leadId: lead._id,
//       message: "Lead created & OTP sent",
//     });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };
exports.createLead = async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;

    if (!name || !email || !phone || !message) {
      return res.status(400).json({ message: "All fields are required" });
    }

    let lead = await Lead.findOne({ email });

    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

    /* ==================================
       CASE 1: Lead Exists
    ================================== */
    if (lead) {
      // If already verified → stop
      if (lead.isVerified) {
        return res.status(400).json({
          message: "Email already verified. Please proceed.",
        });
      }

      // If not verified → resend OTP (NO error message)
      lead.name = name; // update details (optional)
      lead.phone = phone;
      lead.message = message;
      lead.otp = otp;
      lead.otpExpiresAt = otpExpiry;

      await lead.save();

      await sendEmail({
        to: email,
        subject: "OTP Verification - Global Technologies",
        html: `
          <p>Hello ${name},</p>
          <p>Your new OTP is:</p>
          <h2>${otp}</h2>
          <p>Valid for 5 minutes.</p>
        `,
      });

      return res.status(200).json({
        success: true,
        message: "OTP sent successfully",
      });
    }

    /* ==================================
       CASE 2: New Lead
    ================================== */
    lead = await Lead.create({
      name,
      email,
      phone,
      message,
      otp,
      otpExpiresAt: otpExpiry,
    });

    await sendEmail({
      to: email,
      subject: "OTP Verification - Global Technologies",
      html: `
        <p>Hello ${name},</p>
        <p>Your OTP is:</p>
        <h2>${otp}</h2>
        <p>Valid for 5 minutes.</p>
      `,
    });

    await sendEmail({
      to: process.env.ADMIN_EMAIL || "anuragkumarmait@gmail.com",
      subject: "New Lead Received - Global Technologies",
      html: `
        <h3>New Lead</h3>
        <p><b>Name:</b> ${name}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Phone:</b> ${phone}</p>
        <p><b>Message:</b> ${message}</p>
        <p><b>Verified:</b> ❌</p>
      `,
    });

    return res.status(201).json({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* =======================
   VERIFY OTP
======================= */
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email & OTP required" });
    }

    const lead = await Lead.findOne({ email });

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    if (lead.isVerified) {
      return res.status(400).json({ message: "Already verified" });
    }

    if (lead.otp !== otp || lead.otpExpiresAt < new Date()) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // ✅ Mark lead verified
    lead.isVerified = true;
    lead.otp = undefined;
    lead.otpExpiresAt = undefined;
    await lead.save();

    /* ===============================
       ADD TO NEWSLETTER AUTOMATICALLY
    =============================== */

    const existingSubscriber = await Newsletter.findOne({ email });

    if (!existingSubscriber) {
      await Newsletter.create({
        email: lead.email,
        source: "lead-verification",
        status: "active",
      });
    } else {
      existingSubscriber.status = "active";
      await existingSubscriber.save();
    }

    /* ===============================
       SEND CONFIRMATION EMAIL
    =============================== */

    await sendEmail({
      to: lead.email,
      subject: "Thank You for Contacting Global Technologies",
      html: `
        <p>Hello ${lead.name},</p>
        <p>Your email has been verified successfully.</p>
        <p>You are now subscribed to our latest updates & news.</p>
        <br/>
        <p>Regards,<br/>Global Technologies</p>
      `,
    });

    await sendEmail({
      to: process.env.ADMIN_EMAIL || "anuragkumarmait@gmail.com",
      subject: "Lead Verified & Added to Newsletter",
      html: `
        <p><b>${lead.name}</b> verified OTP.</p>
        <p>Email: ${lead.email}</p>
        <p>Status: Added to Newsletter (Active)</p>
      `,
    });

    res.status(200).json({
      success: true,
      message: "OTP verified & added to newsletter",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* =======================
   GET ALL LEADS
======================= */
exports.getAllLeads = async (req, res) => {
  try {
    const leads = await Lead.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: leads });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* =======================
   UPDATE LEAD
======================= */
exports.updateLead = async (req, res) => {
  try {
    const lead = await Lead.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    res.status(200).json({ success: true, data: lead });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* =======================
   DELETE LEAD
======================= */
exports.deleteLead = async (req, res) => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    res.status(200).json({ success: true, message: "Lead deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
