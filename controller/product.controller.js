const Product = require("../models/product.model");
const Collection = require("../models/collection.model");
const slugify = require("slugify");

/* ---------------------------------------------------
   CREATE PRODUCT
--------------------------------------------------- */
exports.createProduct = async (req, res) => {
  try {
    const {
      name,
      slug,
      description,
      sizes = [],
      price,
      extraDetails = {},
      faqs = [],
      collection,
      status = "active",
    } = req.body;

    if (!name || !price || !collection) {
      return res.status(400).json({
        success: false,
        message: "Name, price and collection are required",
      });
    }

    /* -------------------------------
       Handle slug (custom or auto)
    -------------------------------- */
    let finalSlug = slug
      ? slugify(slug, { lower: true, strict: true })
      : slugify(name, { lower: true, strict: true });

    const slugExists = await Product.findOne({ slug: finalSlug });
    if (slugExists) {
      return res.status(409).json({
        success: false,
        message: "Slug already exists",
      });
    }

    /* -------------------------------
       Handle images (Cloudinary)
    -------------------------------- */
    const images = req.files?.map((file) => file.path) || [];

    const product = await Product.create({
      name,
      slug: finalSlug,
      description,
      images,
      sizes,
      price,
      extraDetails,
      faqs,
      collection,
      status,
    });

    /* -------------------------------
       Sync collection
    -------------------------------- */
    await Collection.findByIdAndUpdate(collection, {
      $addToSet: { products: product._id },
    });

    res.status(201).json({
      success: true,
      data: product,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
/* ---------------------------------------------------
   GET ALL PRODUCTS (ADMIN)
--------------------------------------------------- */
exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find()
      .populate("collection")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ---------------------------------------------------
   GET SINGLE PRODUCT (ID OR SLUG)
--------------------------------------------------- */
exports.getSingleProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findOne({
      $or: [{ _id: id }, { slug: id }],
    }).populate("collection");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ---------------------------------------------------
   UPDATE PRODUCT
--------------------------------------------------- */
exports.updateProduct = async (req, res) => {
  try {
    const { slug, collection } = req.body;

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    /* -------------------------------
       Handle slug update
    -------------------------------- */
    if (slug && slug !== product.slug) {
      const finalSlug = slugify(slug, { lower: true, strict: true });

      const exists = await Product.findOne({
        slug: finalSlug,
        _id: { $ne: product._id },
      });

      if (exists) {
        return res.status(409).json({
          success: false,
          message: "Slug already exists",
        });
      }

      product.slug = finalSlug;
    }

    /* -------------------------------
       Handle collection change
    -------------------------------- */
    if (
      collection &&
      collection.toString() !== product.collection.toString()
    ) {
      await Collection.findByIdAndUpdate(product.collection, {
        $pull: { products: product._id },
      });

      await Collection.findByIdAndUpdate(collection, {
        $addToSet: { products: product._id },
      });

      product.collection = collection;
    }

    /* -------------------------------
       Handle images (append only)
       Order comes from frontend
    -------------------------------- */
    if (req.files?.length) {
      const newImages = req.files.map((file) => file.path);
      product.images = [...product.images, ...newImages];
    }

    /* -------------------------------
       Update remaining fields
    -------------------------------- */
    Object.assign(product, req.body);
    await product.save();

    const updated = await Product.findById(product._id).populate("collection");

    res.json({
      success: true,
      data: updated,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/* ---------------------------------------------------
   DELETE PRODUCT
--------------------------------------------------- */
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // ✅ Remove from collection
    await Collection.findByIdAndUpdate(product.collection, {
      $pull: { products: product._id },
    });

    res.json({ success: true, message: "Product deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ---------------------------------------------------
   CHANGE PRODUCT STATUS (ACTIVE / INACTIVE)
--------------------------------------------------- */
exports.changeProductStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value",
      });
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true },
    );

    res.json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ---------------------------------------------------
   GET ACTIVE PRODUCTS (WEBSITE)
--------------------------------------------------- */
exports.getActiveProducts = async (req, res) => {
  try {
    const products = await Product.find({ status: "active" })
      .populate("collection")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};