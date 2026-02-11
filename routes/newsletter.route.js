const express = require("express");
const {
  subscribeNewsletter,
  sendNewsletter,
} = require("../controller/newsletter.controller");

const router = express.Router();

router.post("/subscribe", subscribeNewsletter);
router.post("/send", sendNewsletter);

module.exports = router;
