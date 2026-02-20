const express = require("express");
const upload = require("../middleware/upload");
const {
  subscribeNewsletter,
  sendNewsletter,
  getSubscribers,
} = require("../controller/newsletter.controller");

const router = express.Router();

router.post("/subscribe", subscribeNewsletter);

// 👇 Accept attachment
router.post("/send", upload.array("attachments", 10), sendNewsletter);

router.get("/all", getSubscribers);

module.exports = router;
