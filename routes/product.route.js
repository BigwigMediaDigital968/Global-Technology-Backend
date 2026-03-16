const express = require("express");
const router = express.Router();
const productController = require("../controller/product.controller.js");
const upload = require("../middleware/upload");

// Create product
router.post(
  "/admin",
  upload.fields([
    { name: "images", maxCount: 10 },
    { name: "file", maxCount: 1 },
  ]),
  productController.createProduct,
);

// Get all products (admin)
router.get("/admin", productController.getAllProducts);

// Get one product (admin & website)
router.get("/admin/:id", productController.getSingleProduct);

// Update product
router.put(
  "/admin/:id",
  upload.fields([
    { name: "images", maxCount: 10 },
    { name: "file", maxCount: 1 },
  ]),
  productController.updateProduct,
);

// Delete product(s)
router.delete("/admin/:id", productController.deleteProduct);
router.delete("/admin", productController.bulkDeleteProducts);

// Change status (active/inactive)
router.patch("/admin/:id/status", productController.changeProductStatus);

// Get all active products for website
router.get("/", productController.getActiveProducts);

// Get single product by slug (SEO) or ID (fallback)
router.get("/:slug", productController.getSingleProduct);

module.exports = router;
