const slugify = require("slugify");
const Collection = require("../models/collection.model");
const Product = require("../models/product.model");

/* ---------------------------------------------------
   ADMIN – CREATE COLLECTION
--------------------------------------------------- */
exports.createCollection = async (req, res) => {
  try {
    const {
      name,
      slug,
      description,
      status = "active",
      products = [],
    } = req.body;

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

    const image = req.file.path;

    /* -------------------------------
       Parse product IDs
    -------------------------------- */
    let productIds = [];

    if (typeof products === "string") {
      productIds = [products];
    } else if (Array.isArray(products)) {
      productIds = products;
    }

    /* -------------------------------
       Create collection
    -------------------------------- */
    const collection = await Collection.create({
      name,
      slug: finalSlug,
      description,
      image,
      status,
      products: productIds,
    });

    /* -------------------------------
       Sync products → collection
    -------------------------------- */
    if (productIds.length > 0) {
      await Product.updateMany(
        { _id: { $in: productIds } },
        { $set: { collectionName: collection._id } },
      );
    }

    const populated = await Collection.findById(collection._id).populate(
      "products",
    );

    res.status(201).json({
      success: true,
      data: populated,
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
   GET SINGLE COLLECTION (BY ID OR SLUG)
--------------------------------------------------- */
exports.getSingleCollection = async (req, res) => {
  try {
    const { id } = req.params;

    let collection;

    // check if Mongo ObjectId
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      collection = await Collection.findById(id).populate("products");
    } else {
      collection = await Collection.findOne({ slug: id }).populate("products");
    }

    if (!collection) {
      return res.status(404).json({
        success: false,
        message: "Collection not found",
      });
    }

    res.json({
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
      { $unset: { collection: "" } },
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
   WEBSITE – GET SINGLE ACTIVE COLLECTION (BY ID OR SLUG)
--------------------------------------------------- */
exports.getSingleActiveCollection = async (req, res) => {
  try {
    const { identifier } = req.params;

    if (!identifier) {
      return res.status(400).json({
        success: false,
        message: "Collection ID or slug is required",
      });
    }

    let collection;

    // Check if it's a MongoDB ObjectId
    if (identifier.match(/^[0-9a-fA-F]{24}$/)) {
      collection = await Collection.findOne({
        _id: identifier,
        status: "active",
      }).populate({
        path: "products",
        match: { status: "active" },
      });
    } else {
      collection = await Collection.findOne({
        slug: identifier,
        status: "active",
      }).populate({
        path: "products",
        match: { status: "active" },
      });
    }

    if (!collection) {
      return res.status(404).json({
        success: false,
        message: "Collection not found",
      });
    }

    res.json({
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
