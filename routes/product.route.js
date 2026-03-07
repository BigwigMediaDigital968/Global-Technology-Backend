const express = require("express");
const router = express.Router();
const productController = require("../controller/product.controller.js");
const upload = require("../middleware/upload");

/* =================================================
   ADMIN ROUTES
================================================= */

// Create
router.post("/admin", upload.array("images", 10), productController.createProduct);

// Get all
router.get("/admin", productController.getAllProducts);

// Get one
router.get("/admin/:id", productController.getSingleProduct);

// Update
router.put("/admin/:id", upload.array("images", 10), productController.updateProduct);

// Delete
router.delete("/admin/:id", productController.deleteProduct);

// Change status
router.patch("/admin/:id/status", productController.changeProductStatus);

/* =================================================
   WEBSITE ROUTES
================================================= */

// Get all active products
router.get("/", productController.getActiveProducts);

// Get single product by slug (SEO)
router.get("/:slug", productController.getSingleProduct);

module.exports = router;