const fs = require("fs");
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
          contentType: file.mimetype,
        };
      });
    }

    /* ================= Send Emails ================= */
    // await Promise.all(
    //   subscribers.map((user) =>
    //     sendEmail({
    //       to: user.email,
    //       subject,
    //       html: content,
    //       attachments, // ✅ correct
    //     }),
    //   ),
    // );

    const delay = (ms) => new Promise((res) => setTimeout(res, ms));

    for (const user of subscribers) {
      await sendEmail({ to: user.email, subject, html: content, attachments });
      await delay(100); // 100ms between each email
    }

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

// ─────────────────────────────────────────────────────────────
// ADD THESE TWO FUNCTIONS to your newsletter.controller.js
// ─────────────────────────────────────────────────────────────

const crypto = require("crypto");

/* ══════════════════════════════════════════════
   HELPER — generate a signed unsubscribe token
   Uses HMAC-SHA256 so tokens can't be forged.
   No DB storage needed — stateless verification.
══════════════════════════════════════════════ */
const UNSUB_SECRET =
  process.env.UNSUBSCRIBE_SECRET || "gt-unsub-secret-change-me";

const generateUnsubToken = (email) => {
  return crypto
    .createHmac("sha256", UNSUB_SECRET)
    .update(email.toLowerCase().trim())
    .digest("hex");
};

const verifyUnsubToken = (email, token) => {
  const expected = generateUnsubToken(email);
  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(token, "hex"),
  );
};

/* ══════════════════════════════════════════════
   EXPORT HELPER — use this in sendEmail util
   to auto-append unsubscribe links in every mail

   Usage in newsletter.controller.js sendNewsletter:
     const unsubToken = generateUnsubToken(user.email);
     const unsubUrl = `${process.env.NEXT_PUBLIC_BASE_URI}/unsubscribe?email=${encodeURIComponent(user.email)}&token=${unsubToken}`;
     // Append to html content or pass to template
══════════════════════════════════════════════ */
exports.generateUnsubToken = generateUnsubToken;

/* ══════════════════════════════════════════════
   GET /api/newsletter/unsubscribe/verify
   ?email=...&token=...

   Called by the frontend page to check if the
   token is valid before showing the confirm UI.
══════════════════════════════════════════════ */
exports.verifyUnsubscribe = async (req, res) => {
  try {
    const { email, token } = req.query;

    if (!email || !token) {
      return res.status(400).json({
        success: false,
        message: "Missing email or token.",
      });
    }

    // Validate token length to prevent timing attacks on bad input
    if (token.length !== 64) {
      return res.status(400).json({
        success: false,
        message: "Invalid token format.",
      });
    }

    const valid = verifyUnsubToken(email, token);

    if (!valid) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired unsubscribe link.",
      });
    }

    // Check subscriber exists and is still active
    const subscriber = await Newsletter.findOne({
      email: email.toLowerCase().trim(),
    });

    if (!subscriber) {
      return res.status(404).json({
        success: false,
        message: "Email address not found in our list.",
      });
    }

    if (subscriber.status === "unsubscribed") {
      return res.status(200).json({
        success: true,
        alreadyUnsubscribed: true,
        message: "You are already unsubscribed.",
      });
    }

    return res.status(200).json({
      success: true,
      alreadyUnsubscribed: false,
      message: "Token valid. Ready to unsubscribe.",
      email: subscriber.email,
    });
  } catch (error) {
    console.error("Verify Unsubscribe Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/* ══════════════════════════════════════════════
   POST /api/newsletter/unsubscribe
   Body: { email, token, reason? }

   Marks subscriber as unsubscribed and sends
   a confirmation email to them.
══════════════════════════════════════════════ */
exports.unsubscribeNewsletter = async (req, res) => {
  try {
    const { email, token, reason } = req.body;

    if (!email || !token) {
      return res.status(400).json({
        success: false,
        message: "Missing email or token.",
      });
    }

    if (token.length !== 64) {
      return res.status(400).json({
        success: false,
        message: "Invalid token format.",
      });
    }

    const valid = verifyUnsubToken(email, token);

    if (!valid) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired unsubscribe link.",
      });
    }

    const subscriber = await Newsletter.findOne({
      email: email.toLowerCase().trim(),
    });

    if (!subscriber) {
      return res.status(404).json({
        success: false,
        message: "Email address not found.",
      });
    }

    if (subscriber.status === "unsubscribed") {
      return res.status(200).json({
        success: true,
        alreadyUnsubscribed: true,
        message: "Already unsubscribed.",
      });
    }

    // Mark as unsubscribed
    subscriber.status = "unsubscribed";
    subscriber.unsubscribedAt = new Date();
    if (reason) subscriber.unsubscribeReason = reason;
    await subscriber.save();

    // Send confirmation email to the user
    await sendEmail({
      to: email,
      subject: "You've been unsubscribed — Global Technologies",
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  body{margin:0;padding:0;background:#f4f4f0;font-family:Arial,sans-serif;}
  .wrap{max-width:520px;margin:40px auto;background:#fff;border:1px solid #e0ded8;}
  .hdr{background:#0a0a0a;padding:22px 32px;border-bottom:3px solid #D4A017;}
  .logo{color:#fff;font-size:16px;font-weight:700;}
  .logo span{display:block;font-size:9px;color:#D4A017;letter-spacing:2px;text-transform:uppercase;margin-top:2px;}
  .body{padding:36px 32px;}
  .icon{width:56px;height:56px;background:#f5f3ed;border:1px solid #e8e6e0;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;}
  h1{font-size:20px;font-weight:700;color:#0a0a0a;text-align:center;margin-bottom:10px;}
  p{font-size:13px;color:#555;line-height:1.75;text-align:center;margin-bottom:16px;}
  .re-sub{display:inline-block;background:#D4A017;color:#0a0a0a;font-size:12px;font-weight:700;text-decoration:none;padding:11px 24px;text-transform:uppercase;letter-spacing:0.5px;}
  .footer{background:#f9f7f1;padding:20px 32px;border-top:1px solid #e8e6e0;text-align:center;font-size:11px;color:#aaa;line-height:1.8;}
</style>
</head>
<body>
<div class="wrap">
  <div class="hdr"><div class="logo">Global Technologies<span>Est. India</span></div></div>
  <div class="body">
    <h1>You've been unsubscribed</h1>
    <p>We've removed <strong>${email}</strong> from our mailing list. You won't receive any further newsletters from us.</p>
    <p>If this was a mistake or you change your mind, you can re-subscribe anytime on our website.</p>
    <p><a href="${process.env.NEXT_PUBLIC_BASE_URI}" class="re-sub">Visit Our Website</a></p>
    <p style="font-size:12px;color:#aaa;margin-top:24px;">Questions? Contact us at <a href="mailto:support@globaltechnologiesindia.com" style="color:#D4A017;text-decoration:none;">support@globaltechnologiesindia.com</a></p>
  </div>
  <div class="footer">© 2026 Global Technologies. All rights reserved.</div>
</div>
</body>
</html>`,
    });

    res.status(200).json({
      success: true,
      message: "Successfully unsubscribed.",
    });
  } catch (error) {
    console.error("Unsubscribe Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/* ══════════════════════════════════════════════
   OPTIONAL — UPDATE sendNewsletter to inject
   personalised unsubscribe links into every email.

   In your existing sendNewsletter controller,
   replace the Promise.all block with this:
══════════════════════════════════════════════ */
exports.sendNewsletterWithUnsubLink = async (
  subscribers,
  subject,
  content,
  attachments,
) => {
  const { generateUnsubToken } = exports;

  await Promise.all(
    subscribers.map((user) => {
      const token = generateUnsubToken(user.email);
      const unsubUrl = `${process.env.NEXT_PUBLIC_BASE_URI}/unsubscribe?email=${encodeURIComponent(user.email)}&token=${token}`;

      // Inject unsubscribe footer into HTML content
      const unsubFooter = `
<div style="text-align:center;padding:16px;font-size:11px;color:#aaa;border-top:1px solid #eee;margin-top:24px;">
  You're receiving this because you subscribed at globaltechnologiesindia.com.<br/>
  <a href="${unsubUrl}" style="color:#D4A017;text-decoration:none;">Unsubscribe</a>
  &nbsp;|&nbsp;
  <a href="${process.env.NEXT_PUBLIC_BASE_URI}/privacy-policy" style="color:#D4A017;text-decoration:none;">Privacy Policy</a>
</div>`;

      const htmlWithFooter =
        content.replace("</body>", `${unsubFooter}</body>`) ||
        content + unsubFooter;

      return sendEmail({
        to: user.email,
        subject,
        html: htmlWithFooter,
        attachments,
      });
    }),
  );
};
