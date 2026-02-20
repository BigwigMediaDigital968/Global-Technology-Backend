const fs = require("fs");
const path = require("path");
const Newsletter = require("../models/newsletter.model");
const sendEmail = require("../utils/sendEmail");

/* ==============================
   SUBSCRIBE NEWSLETTER
============================== */
exports.subscribeNewsletter = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const existing = await Newsletter.findOne({ email });

    if (existing) {
      return res.status(400).json({
        message: "Already subscribed",
      });
    }

    await Newsletter.create({
      email,
      source: "newsletter-form",
      status: "active",
    });

    // Optional welcome email
    await sendEmail({
      to: email,
      subject: "Welcome to Our Newsletter 🚀",
      html: `
        <h2>Thank you for subscribing!</h2>
        <p>You will now receive our latest updates.</p>
      `,
    });

    res.status(201).json({
      success: true,
      message: "Subscribed successfully",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ==============================
   SEND NEWSLETTER (ADMIN)
============================== */
exports.sendNewsletter = async (req, res) => {
  try {
    const { subject, content } = req.body;

    if (!subject || !content) {
      return res.status(400).json({
        message: "Subject & content required",
      });
    }

    let emails = [];

    if (req.body.emails) {
      emails = JSON.parse(req.body.emails);
    }

    let subscribers;

    if (emails.length > 0) {
      subscribers = await Newsletter.find({
        email: { $in: emails },
        status: "active",
      });
    } else {
      subscribers = await Newsletter.find({
        status: "active",
      });
    }

    if (subscribers.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No active subscribers found",
      });
    }

    /* ================= Handle Attachments ================= */
    let attachments = [];

    if (req.files && req.files.length > 0) {
      attachments = req.files.map((file) => {
        const fileContent = fs.readFileSync(file.path);

        return {
          name: file.originalname,
          content: fileContent.toString("base64"),
        };
      });
    }

    /* ================= Send Emails ================= */
    await Promise.all(
      subscribers.map((user) =>
        sendEmail({
          to: user.email,
          subject,
          html: content,
          attachments, // ✅ correct
        }),
      ),
    );

    /* ================= Cleanup Files ================= */
    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        fs.unlinkSync(file.path);
      });
    }

    res.status(200).json({
      success: true,
      message: `Newsletter sent to ${subscribers.length} users`,
    });
  } catch (error) {
    console.error("Newsletter Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/* ==============================
   GET ALL SUBSCRIBERS (ADMIN)
============================== */
exports.getSubscribers = async (req, res) => {
  try {
    const subscribers = await Newsletter.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: subscribers.length,
      data: subscribers,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
