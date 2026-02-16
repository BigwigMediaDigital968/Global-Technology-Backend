const express = require("express");
const {
  subscribeNewsletter,
  sendNewsletter,
  getSubscribers,
} = require("../controller/newsletter.controller");

const router = express.Router();

router.post("/subscribe", subscribeNewsletter);
router.post("/send", sendNewsletter);

router.get("/all", getSubscribers);

module.exports = router;
