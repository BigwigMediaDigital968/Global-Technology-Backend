const express = require("express");
const router = express.Router();
const collectionController = require("../controller/collection.controller");
const upload = require("../middleware/upload");

// Admin
router.post("/", upload.single("image"), collectionController.createCollection);
router.get("/admin", collectionController.getAllCollections);
router.put(
  "/admin/:id",
  upload.single("image"),
  collectionController.updateCollection
);
router.delete("/admin/:id", collectionController.deleteCollection);

// Website
router.get("/", collectionController.getActiveCollections);

module.exports = router;