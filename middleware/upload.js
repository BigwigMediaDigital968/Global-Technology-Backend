const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    if (file.fieldname === "file") {
      return {
        folder: "products/files",
        resource_type: "raw",
      };
    }

    return {
      folder: "products/images",
      allowed_formats: ["jpg", "png", "jpeg", "webp"],
      transformation: [{ quality: "auto", fetch_format: "auto" }],
    };
  },
});

const upload = multer({ storage });

module.exports = upload;
