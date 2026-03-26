const mongoose = require("mongoose");
const Product = require("../models/product.model");
const Collection = require("../models/collection.model");
const Category = require("../models/categoryModel");
const slugify = require("slugify");

async function resolveCategories({
  categoryIds,
  categoryNames,
  collectionName,
}) {
  const resolved = new Set();

  // 1. Direct IDs passed (already exist)
  if (Array.isArray(categoryIds)) {
    categoryIds.forEach((id) => resolved.add(id.toString()));
  }

  // 2. On-the-fly creation from names
  if (Array.isArray(categoryNames) && categoryNames.length) {
    await Promise.all(
      categoryNames.map(async (name) => {
        name = name.trim();
        let cat = await Category.findOne({
          name: new RegExp(`^${name}$`, "i"),
          collectionName,
        });
        if (!cat) cat = await Category.create({ name, collectionName });

        // Sync to collection
        await Collection.findByIdAndUpdate(collectionName, {
          $addToSet: { categories: cat._id },
        });

        resolved.add(cat._id.toString());
      }),
    );
  }

  return [...resolved];
}

// ── CREATE PRODUCT
exports.createProduct = async (req, res) => {
  try {
    const {
      name,
      slug,
      shortDescription,
      longDescription,
      collectionName,
      status = "active",
    } = req.body;

    if (!name || !collectionName || !shortDescription) {
      return res.status(400).json({
        success: false,
        message: "Name, shortDescription and collection are required",
      });
    }

    // Parse category inputs — support both single value and array
    const categoryIds = [req.body.categoryIds || req.body.category]
      .flat()
      .filter(Boolean);

    const categoryNames = [req.body.categoryNames || req.body.categoryName]
      .flat()
      .filter(Boolean);

    const resolvedCategories = await resolveCategories({
      categoryIds,
      categoryNames,
      collectionName,
    });

    // FAQs
    let faqs = [];
    try {
      faqs = JSON.parse(req.body.faqs || "[]")
        .filter((f) => f.question && f.answer)
        .map((f) => ({
          question: String(f.question),
          answer: String(f.answer),
        }));
    } catch (e) {}

    // Extra details
    let extraDetails = new Map();
    try {
      const parsedExtra = JSON.parse(req.body.extraDetails || "[]");
      extraDetails = new Map(
        parsedExtra
          .filter((d) => d.key && d.value)
          .map((d) => [d.key, d.value]),
      );
    } catch (e) {}

    // Slug
    let finalSlug = slug
      ? slugify(slug, { lower: true, strict: true })
      : slugify(name, { lower: true, strict: true });

    if (await Product.findOne({ slug: finalSlug })) {
      return res
        .status(409)
        .json({ success: false, message: "Slug already exists" });
    }

    const images = req.files?.images ? req.files.images.map((f) => f.path) : [];
    const file = req.files?.file?.[0]?.path || null;

    const product = await Product.create({
      name,
      slug: finalSlug,
      shortDescription,
      longDescription,
      images,
      file,
      extraDetails,
      faqs,
      collectionName,
      category: resolvedCategories, // ← now an array
      status,
    });

    await Collection.findByIdAndUpdate(collectionName, {
      $addToSet: { products: product._id },
    });

    res.status(201).json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── UPDATE PRODUCT
exports.updateProduct = async (req, res) => {
  try {
    const { slug, collectionName } = req.body;
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    // Slug
    if (slug && slug !== product.slug) {
      const finalSlug = slugify(slug, { lower: true, strict: true });
      if (
        await Product.findOne({ slug: finalSlug, _id: { $ne: product._id } })
      ) {
        return res
          .status(409)
          .json({ success: false, message: "Slug already exists" });
      }
      product.slug = finalSlug;
    }

    // Collection switch
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

    // Categories — support replace or append via req.body.categoryMode
    // categoryMode: "replace" (default) | "append"
    const targetCollection = collectionName || product.collectionName;
    const categoryIds = [req.body.categoryIds || req.body.category]
      .flat()
      .filter(Boolean);
    const categoryNames = [req.body.categoryNames || req.body.categoryName]
      .flat()
      .filter(Boolean);

    if (categoryIds.length || categoryNames.length) {
      const resolved = await resolveCategories({
        categoryIds,
        categoryNames,
        collectionName: targetCollection,
      });

      if (req.body.categoryMode === "append") {
        const existing = product.category.map((id) => id.toString());
        const merged = [...new Set([...existing, ...resolved])];
        product.category = merged;
      } else {
        product.category = resolved; // replace
      }
    }

    // FAQs
    if (req.body.faqs) {
      try {
        product.faqs = JSON.parse(req.body.faqs)
          .filter((f) => f.question && f.answer)
          .map((f) => ({
            question: String(f.question),
            answer: String(f.answer),
          }));
      } catch (e) {}
    }

    // Extra details
    if (req.body.extraDetails) {
      try {
        const parsedExtra = JSON.parse(req.body.extraDetails);
        product.extraDetails = new Map(
          parsedExtra
            .filter((d) => d.key && d.value)
            .map((d) => [d.key, d.value]),
        );
      } catch (e) {}
    }

    // Images & file
    if (req.files?.images) {
      product.images = [
        ...product.images,
        ...req.files.images.map((f) => f.path),
      ];
    }
    if (req.files?.file) {
      product.file = req.files.file[0].path;
    }

    product.name = req.body.name || product.name;
    product.shortDescription =
      req.body.shortDescription || product.shortDescription;
    product.longDescription =
      req.body.longDescription || product.longDescription;
    product.status = req.body.status || product.status;

    await product.save();

    const updated = await Product.findById(product._id)
      .populate("collectionName")
      .populate("category", "name slug");

    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAllProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};

    // ── COLLECTION FILTER ──────────────────────────────────────
    if (req.query.collection) {
      const isObjectId = mongoose.Types.ObjectId.isValid(req.query.collection);
      if (isObjectId) {
        filter.collectionName = req.query.collection;
      } else {
        const col = await Collection.findOne({ slug: req.query.collection });
        if (!col)
          return res.json({
            success: true,
            data: [],
            pagination: { total: 0, page, pages: 0 },
          });
        filter.collectionName = col._id;
      }
    }

    // ── CATEGORY FILTER ────────────────────────────────────────
    if (req.query.category) {
      const isObjectId = mongoose.Types.ObjectId.isValid(req.query.category);
      if (isObjectId) {
        filter.category = req.query.category;
      } else {
        const cat = await Category.findOne({ slug: req.query.category });
        if (!cat)
          return res.json({
            success: true,
            data: [],
            pagination: { total: 0, page, pages: 0 },
          });
        filter.category = cat._id;
      }
    }

    // ── STATUS FILTER ──────────────────────────────────────────
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate("collectionName")
        .populate("category", "name slug") // ← ADD
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Product.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: products,
      pagination: { total, page, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET SINGLE PRODUCT (admin)
exports.getSingleProduct = async (req, res) => {
  try {
    const id = req.params.id || req.params.slug;
    const mongoose = require("mongoose");
    const isObjectId = mongoose.Types.ObjectId.isValid(id);

    const product = await Product.findOne(
      isObjectId ? { $or: [{ _id: id }, { slug: id }] } : { slug: id },
    )
      .populate("collectionName")
      .populate("category", "name slug"); // ← ADD

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    res.json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Delete Product
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

// Change product Active Status
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

exports.getActiveProducts = async (req, res) => {
  try {
    const filter = { status: "active" };

    // Filter by collection (slug or ObjectId)
    if (req.query.collection) {
      if (mongoose.Types.ObjectId.isValid(req.query.collection)) {
        filter.collectionName = req.query.collection;
      } else {
        const col = await Collection.findOne({ slug: req.query.collection });
        if (!col) return res.json({ success: true, data: [] });
        filter.collectionName = col._id;
      }
    }

    // Filter by category (slug or ObjectId)
    if (req.query.category) {
      if (mongoose.Types.ObjectId.isValid(req.query.category)) {
        filter.category = { $in: [req.query.category] }; // ← $in because array field
      } else {
        const cat = await Category.findOne({ slug: req.query.category });
        if (!cat) return res.json({ success: true, data: [] });
        filter.category = { $in: [cat._id] };
      }
    }

    const products = await Product.find(filter)
      .populate("collectionName", "name slug")
      .populate("category", "name slug")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

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

exports.getCategoriesByCollection = async (req, res) => {
  try {
    const { collectionId } = req.params;
    const categories = await Category.find({
      collectionName: collectionId,
      status: "active",
    }).sort("name");

    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
