const express = require("express");
const uploadNews = require("../middleware/uploadNews");
const {
  subscribeNewsletter,
  sendNewsletter,
  getSubscribers,
  verifyUnsubscribe,
  unsubscribeNewsletter,
} = require("../controller/newsletter.controller");

const router = express.Router();

router.post("/subscribe", subscribeNewsletter);

// 👇 Accept attachment
router.post("/send", uploadNews.array("attachments", 10), sendNewsletter);

router.get("/all", getSubscribers);

// ── Unsubscribe routes ──────────────────────────
// GET  /api/newsletter/unsubscribe/verify?email=...&token=...
router.get("/unsubscribe/verify", verifyUnsubscribe);

// POST /api/newsletter/unsubscribe
// Body: { email, token, reason? }
router.post("/unsubscribe", unsubscribeNewsletter);

module.exports = router;
