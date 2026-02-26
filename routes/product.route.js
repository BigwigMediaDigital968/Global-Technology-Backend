const express = require("express");
const router = express.Router();
const productController = require("../controller/product.controller.js");
const upload = require("../middleware/upload");

/* =================================================
   ADMIN ROUTES
================================================= */

// Create product
router.post("/admin/add", upload.array("images", 10), productController.createProduct);

// Get all products (admin)
router.get("/admin/get", productController.getAllProducts);

// Get single product (by ID)
router.get("/admin/get/:id", productController.getSingleProduct);

// Update product
router.put("/admin/update/:id", upload.array("images", 10), productController.updateProduct);

// Delete product
router.delete("/admin/:id", productController.deleteProduct);

// Change product status (active / inactive)
router.patch(
  "/admin/:id/status",
  productController.changeProductStatus,
);

/* =================================================
   WEBSITE ROUTES
================================================= */

// Get all active products
router.get("/", productController.getActiveProducts);

// Get single product by slug (SEO)
router.get("/:slug", productController.getSingleProduct);

module.exports = router;