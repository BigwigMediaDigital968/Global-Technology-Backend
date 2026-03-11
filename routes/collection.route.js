const express = require("express");
const router = express.Router();
const collectionController = require("../controller/collection.controller");
const upload = require("../middleware/upload");

// Admin
router.post(
  "/admin",
  upload.single("image"),
  collectionController.createCollection,
);
router.get("/admin", collectionController.getAllCollections);
router.get("/admin/:id", collectionController.getSingleCollection);
router.put(
  "/admin/:id",
  upload.single("image"),
  collectionController.updateCollection,
);
router.delete("/admin/:id", collectionController.deleteCollection);

// Website
router.get("/", collectionController.getActiveCollections);
router.get("/:identifier", collectionController.getSingleActiveCollection); // ✅

module.exports = router;
