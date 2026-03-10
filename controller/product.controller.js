const Product = require("../models/product.model");
const Collection = require("../models/collection.model");
const slugify = require("slugify");

exports.createProduct = async (req, res) => {
  try {
    const {
      name,
      slug,
      description,
      collectionName,
      status = "active",
    } = req.body;

    if (!name || !collectionName) {
      return res.status(400).json({
        success: false,
        message: "Name and collection are required",
      });
    }

    /* ── SIZES (already parsed by multer) ── */
    const rawSizes = req.body.sizes || [];
    const sizes = (Array.isArray(rawSizes) ? rawSizes : [rawSizes])
      .filter((s) => s.size && s.price)
      .map((s) => ({ size: String(s.size), price: Number(s.price) }));

    if (!sizes.length) {
      return res.status(400).json({
        success: false,
        message: "At least one size with price is required",
      });
    }

    /* ── PRICE ── */
    const price = Math.min(...sizes.map((s) => s.price));

    /* ── FAQS (already parsed by multer) ── */
    const rawFaqs = req.body.faqs || [];
    const faqs = (Array.isArray(rawFaqs) ? rawFaqs : [rawFaqs])
      .filter((f) => f.question && f.answer)
      .map((f) => ({ question: f.question, answer: f.answer }));

    /* ── EXTRA DETAILS ── */
    const rawExtra = req.body.extraDetails || {};
    const extraDetails = new Map(
      Object.entries(rawExtra).filter(([key, value]) => key && value),
    );

    /* ── SLUG ── */
    let finalSlug = slug
      ? slugify(slug, { lower: true, strict: true })
      : slugify(name, { lower: true, strict: true });

    const slugExists = await Product.findOne({ slug: finalSlug });
    if (slugExists) {
      return res
        .status(409)
        .json({ success: false, message: "Slug already exists" });
    }

    /* ── IMAGES ── */
    const images = req.files?.map((file) => file.path || file.filename) || [];

    /* ── CREATE ── */
    const product = await Product.create({
      name,
      slug: finalSlug,
      description,
      images,
      sizes,
      price,
      extraDetails,
      faqs,
      collectionName,
      status,
    });

    await Collection.findByIdAndUpdate(collectionName, {
      $addToSet: { products: product._id },
    });

    res.status(201).json({ success: true, data: product });
  } catch (err) {
    console.error(
      "FULL ERR:",
      JSON.stringify(err, Object.getOwnPropertyNames(err), 2),
    ); // ADD THIS
    console.error("ERROR NAME:", err.name);
    console.error("ERROR MESSAGE:", err.message);
    console.error("VALIDATION ERRORS:", JSON.stringify(err.errors, null, 2));
    console.error("FULL STACK:", err.stack);

    res.status(500).json({
      success: false,
      message: err.message,
      errors: err.errors, // send this to frontend too
    });
  }
};

/* ---------------------------------------------------
   GET ALL PRODUCTS WITH PAGINATION
--------------------------------------------------- */
exports.getAllProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const products = await Product.find()
      .populate("collectionName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Product.countDocuments();

    res.json({
      success: true,
      data: products,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ---------------------------------------------------
   GET SINGLE PRODUCT
--------------------------------------------------- */
exports.getSingleProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findOne({
      $or: [{ _id: id }, { slug: id }],
    }).populate("collectionName");

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
    const { slug, collectionName } = req.body;

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    /* -- SLUG -- */
    if (slug && slug !== product.slug) {
      const finalSlug = slugify(slug, { lower: true, strict: true });
      const exists = await Product.findOne({
        slug: finalSlug,
        _id: { $ne: product._id },
      });
      if (exists) {
        return res
          .status(409)
          .json({ success: false, message: "Slug already exists" });
      }
      product.slug = finalSlug;
    }

    /* -- COLLECTION -- */
    if (
      collectionName &&
      collectionName.toString() !== product.collectionName.toString()
    ) {
      await Collection.findByIdAndUpdate(product.collectionName, {
        $pull: { products: product._id },
      });
      await Collection.findByIdAndUpdate(collectionName, {
        $addToSet: { products: product._id },
      });
      product.collectionName = collectionName;
    }

    /* -- SIZES + PRICE (multer already parses these) -- */
    const rawSizes = req.body.sizes || [];
    const sizes = (Array.isArray(rawSizes) ? rawSizes : [rawSizes])
      .filter((s) => s.size && s.price)
      .map((s) => ({ size: String(s.size), price: Number(s.price) }));

    if (sizes.length) {
      product.sizes = sizes;
      product.price = Math.min(...sizes.map((s) => s.price));
    }

    /* -- FAQS (was never being updated before!) -- */
    const rawFaqs = req.body.faqs || [];
    const faqs = (Array.isArray(rawFaqs) ? rawFaqs : [rawFaqs])
      .filter((f) => f.question && f.answer)
      .map((f) => ({ question: String(f.question), answer: String(f.answer) }));

    if (faqs.length) {
      product.faqs = faqs;
    }

    /* -- EXTRA DETAILS -- */
    const rawExtra = req.body.extraDetails || {};
    if (Object.keys(rawExtra).length) {
      product.extraDetails = new Map(
        Object.entries(rawExtra).filter(([k, v]) => k && v),
      );
    }

    /* -- IMAGES -- */
    if (req.files?.length) {
      const newImages = req.files.map((file) => file.path);
      product.images = [...product.images, ...newImages];
    }

    /* -- BASIC FIELDS -- */
    product.name = req.body.name || product.name;
    product.description = req.body.description || product.description;
    product.status = req.body.status || product.status;

    await product.save();

    const updated = await Product.findById(product._id).populate(
      "collectionName",
    );

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
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

    await Collection.findByIdAndUpdate(product.collectionName, {
      $pull: { products: product._id },
    });

    res.json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ---------------------------------------------------
   CHANGE STATUS
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
   GET ACTIVE PRODUCTS
--------------------------------------------------- */
exports.getActiveProducts = async (req, res) => {
  try {
    const products = await Product.find({ status: "active" })
      .populate("collectionName")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Bulk product delete
exports.bulkDeleteProducts = async (req, res) => {
  try {
    const { ids } = req.body;

    await Product.deleteMany({
      _id: { $in: ids },
    });

    res.json({
      success: true,
      message: "Products deleted",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
