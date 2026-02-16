const express = require("express");
const router = express.Router();
const productController = require("../controller/product.controller.js");

// Admin
router.post("/", productController.createProduct);
router.get("/admin", productController.getAllProducts);
router.get("/admin/:id", productController.getSingleProduct);
router.put("/admin/:id", productController.updateProduct);
router.delete("/admin/:id", productController.deleteProduct);

// Website
router.get("/", productController.getActiveProducts);

module.exports = router;
