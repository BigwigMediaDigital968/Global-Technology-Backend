const express = require("express");
const router = express.Router();
const collectionController = require("../controller/collection.controller.js");

// Admin
router.post("/", collectionController.createCollection);
router.get("/admin", collectionController.getAllCollections);
router.put("/admin/:id", collectionController.updateCollection);
router.delete("/admin/:id", collectionController.deleteCollection);

// Website
router.get("/", collectionController.getActiveCollections);

module.exports = router;
