const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure temp folder exists
const tempDir = path.join(__dirname, "../temp");
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Route attachments to local disk, other files to your existing flow
    if (file.fieldname === "attachments") {
      cb(null, tempDir);
    } else {
      cb(null, tempDir); // adjust if you have other upload routes
    }
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const uploadNews = multer({ storage });

module.exports = uploadNews;
