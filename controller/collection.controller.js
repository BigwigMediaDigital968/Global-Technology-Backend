const slugify = require("slugify");
const Collection = require("../models/collection.model");
const Product = require("../models/product.model");

/* ---------------------------------------------------
   ADMIN – CREATE COLLECTION
--------------------------------------------------- */
exports.createCollection = async (req, res) => {
  try {
    const { name, slug, description, status = "active" } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Collection name is required",
      });
    }

    /* -------------------------------
       Slug handling
    -------------------------------- */
    const finalSlug = slug
      ? slugify(slug, { lower: true, strict: true })
      : slugify(name, { lower: true, strict: true });

    const slugExists = await Collection.findOne({ slug: finalSlug });
    if (slugExists) {
      return res.status(409).json({
        success: false,
        message: "Slug already exists",
      });
    }

    /* -------------------------------
       Image (Cloudinary)
    -------------------------------- */
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Collection banner image is required",
      });
    }

    const image = req.file.path; // Cloudinary URL

    const collection = await Collection.create({
      name,
      slug: finalSlug,
      description,
      image,
      status,
    });

    res.status(201).json({
      success: true,
      data: collection,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/* ---------------------------------------------------
   ADMIN – GET ALL COLLECTIONS
--------------------------------------------------- */
exports.getAllCollections = async (req, res) => {
  try {
    const collections = await Collection.find()
      .populate("products")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: collections,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ---------------------------------------------------
   ADMIN – UPDATE COLLECTION
--------------------------------------------------- */
exports.updateCollection = async (req, res) => {
  try {
    const { slug } = req.body;
    const collection = await Collection.findById(req.params.id);

    if (!collection) {
      return res.status(404).json({
        success: false,
        message: "Collection not found",
      });
    }

    /* -------------------------------
       Slug update
    -------------------------------- */
    if (slug && slug !== collection.slug) {
      const finalSlug = slugify(slug, { lower: true, strict: true });

      const exists = await Collection.findOne({
        slug: finalSlug,
        _id: { $ne: collection._id },
      });

      if (exists) {
        return res.status(409).json({
          success: false,
          message: "Slug already exists",
        });
      }

      collection.slug = finalSlug;
    }

    /* -------------------------------
       Image update (optional)
    -------------------------------- */
    if (req.file) {
      collection.image = req.file.path; // Cloudinary URL
    }

    Object.assign(collection, req.body);
    await collection.save();

    res.json({
      success: true,
      data: collection,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ---------------------------------------------------
   ADMIN – DELETE COLLECTION
--------------------------------------------------- */
exports.deleteCollection = async (req, res) => {
  try {
    const collection = await Collection.findById(req.params.id);

    if (!collection) {
      return res.status(404).json({
        success: false,
        message: "Collection not found",
      });
    }

    /* -------------------------------
       Remove collection reference
    -------------------------------- */
    await Product.updateMany(
      { collection: collection._id },
      { $unset: { collection: "" } }
    );

    await collection.deleteOne();

    res.json({
      success: true,
      message: "Collection deleted successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ---------------------------------------------------
   WEBSITE – ACTIVE COLLECTIONS
--------------------------------------------------- */
exports.getActiveCollections = async (req, res) => {
  try {
    const collections = await Collection.find({ status: "active" }).populate({
      path: "products",
      match: { status: "active" },
    });

    res.json({
      success: true,
      data: collections,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};