const slugify = require("slugify");
const Collection = require("../models/collection.model");
const Product = require("../models/product.model");
const Category = require("../models/categoryModel"); // add at top if missing

/* ---------------------------------------------------
   ADMIN – CREATE COLLECTION (with categories)
--------------------------------------------------- */
exports.createCollection = async (req, res) => {
  console.log("req.body:", req.body); // ← add this
  console.log("req.file:", req.file); // ← and this
  try {
    const {
      name,
      slug,
      description,
      status = "active",
      products = [],
    } = req.body;

    if (!name) {
      return res
        .status(400)
        .json({ success: false, message: "Collection name is required" });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Collection banner image is required",
      });
    }

    const finalSlug = slug
      ? slugify(slug, { lower: true, strict: true })
      : slugify(name, { lower: true, strict: true });

    if (await Collection.findOne({ slug: finalSlug })) {
      return res
        .status(409)
        .json({ success: false, message: "Slug already exists" });
    }

    let productIds = typeof products === "string" ? [products] : products;

    // Create collection first (need _id for category sync)
    const collection = await Collection.create({
      name,
      slug: finalSlug,
      description,
      image: req.file.path,
      status,
      products: productIds,
    });

    // ── CATEGORIES (names or IDs) ──────────────────────────
    const categoryNames = [req.body.categoryNames || req.body.categoryName]
      .flat()
      .filter(Boolean);

    const categoryIds = [req.body.categoryIds || req.body.category]
      .flat()
      .filter(Boolean);

    const resolvedCategoryIds = [...categoryIds]; // direct IDs

    // Create on-the-fly categories and collect their IDs
    if (categoryNames.length) {
      const created = await Promise.all(
        categoryNames.map(async (name) => {
          name = name.trim();
          let cat = await Category.findOne({
            name: new RegExp(`^${name}$`, "i"),
            collectionName: collection._id,
          });
          if (!cat)
            cat = await Category.create({
              name,
              collectionName: collection._id,
            });
          return cat._id;
        }),
      );
      resolvedCategoryIds.push(...created.map((id) => id.toString()));
    }

    // Save categories to collection
    if (resolvedCategoryIds.length) {
      collection.categories = [...new Set(resolvedCategoryIds)];
      await collection.save();
    }

    if (productIds.length) {
      await Product.updateMany(
        { _id: { $in: productIds } },
        { $set: { collectionName: collection._id } },
      );
    }

    const populated = await Collection.findById(collection._id)
      .populate("products")
      .populate("categories", "name slug");

    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ---------------------------------------------------
   ADMIN – UPDATE COLLECTION (with categories)
--------------------------------------------------- */
exports.updateCollection = async (req, res) => {
  try {
    const collection = await Collection.findById(req.params.id);

    if (!collection) {
      return res
        .status(404)
        .json({ success: false, message: "Collection not found" });
    }

    // Slug
    if (req.body.slug && req.body.slug !== collection.slug) {
      const finalSlug = slugify(req.body.slug, { lower: true, strict: true });
      if (
        await Collection.findOne({
          slug: finalSlug,
          _id: { $ne: collection._id },
        })
      ) {
        return res
          .status(409)
          .json({ success: false, message: "Slug already exists" });
      }
      collection.slug = finalSlug;
    }

    // Image
    if (req.file) collection.image = req.file.path;

    // Basic fields
    if (req.body.name) collection.name = req.body.name;
    if (req.body.description !== undefined)
      collection.description = req.body.description;
    if (req.body.status) collection.status = req.body.status;

    // ── CATEGORIES ─────────────────────────────────────────
    const categoryNames = [req.body.categoryNames || req.body.categoryName]
      .flat()
      .filter(Boolean);
    const categoryIds = [req.body.categoryIds || req.body.category]
      .flat()
      .filter(Boolean);

    if (categoryNames.length || categoryIds.length) {
      const resolved = [...categoryIds];

      if (categoryNames.length) {
        const created = await Promise.all(
          categoryNames.map(async (name) => {
            name = name.trim();
            let cat = await Category.findOne({
              name: new RegExp(`^${name}$`, "i"),
              collectionName: collection._id,
            });
            if (!cat)
              cat = await Category.create({
                name,
                collectionName: collection._id,
              });
            return cat._id.toString();
          }),
        );
        resolved.push(...created);
      }

      // categoryMode: "replace" (default) | "append"
      if (req.body.categoryMode === "append") {
        const existing = collection.categories.map((id) => id.toString());
        collection.categories = [...new Set([...existing, ...resolved])];
      } else {
        collection.categories = [...new Set(resolved)];
      }
    }

    await collection.save();

    if (req.body.products !== undefined) {
      const newProductIds = [req.body.products].flat().filter(Boolean);

      // Remove this collection from old products
      await Product.updateMany(
        { collectionName: collection._id, _id: { $nin: newProductIds } },
        { $unset: { collectionName: "" } },
      );

      // Set this collection on new products
      if (newProductIds.length) {
        await Product.updateMany(
          { _id: { $in: newProductIds } },
          { $set: { collectionName: collection._id } },
        );
      }

      collection.products = newProductIds;
      await collection.save();
    }

    const updated = await Collection.findById(collection._id)
      .populate("products")
      .populate("categories", "name slug");

    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ---------------------------------------------------
   WEBSITE – ACTIVE COLLECTIONS (categories embedded)
--------------------------------------------------- */
exports.getActiveCollections = async (req, res) => {
  try {
    const collections = await Collection.find({ status: "active" })
      .populate({ path: "products", match: { status: "active" } })
      .populate({
        path: "categories",
        match: { status: "active" },
        select: "name slug",
      });

    res.json({ success: true, data: collections });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ---------------------------------------------------
   WEBSITE – SINGLE ACTIVE COLLECTION (categories embedded)
--------------------------------------------------- */
exports.getSingleActiveCollection = async (req, res) => {
  try {
    const { identifier } = req.params;
    const query = identifier.match(/^[0-9a-fA-F]{24}$/)
      ? { _id: identifier, status: "active" }
      : { slug: identifier, status: "active" };

    const collection = await Collection.findOne(query)
      .populate({ path: "products", match: { status: "active" } })
      .populate({
        path: "categories",
        match: { status: "active" },
        select: "name slug",
      });

    if (!collection) {
      return res
        .status(404)
        .json({ success: false, message: "Collection not found" });
    }

    res.json({ success: true, data: collection });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET ALL COLLECTIONS (admin)
exports.getAllCollections = async (req, res) => {
  try {
    const collections = await Collection.find()
      .populate("products")
      .populate("categories", "name slug") // ← ADD
      .sort({ createdAt: -1 });

    res.json({ success: true, data: collections });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET SINGLE COLLECTION (admin)
exports.getSingleCollection = async (req, res) => {
  try {
    const { id } = req.params;

    let collection;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      collection = await Collection.findById(id)
        .populate("products")
        .populate("categories", "name slug"); // ← ADD
    } else {
      collection = await Collection.findOne({ slug: id })
        .populate("products")
        .populate("categories", "name slug"); // ← ADD
    }

    if (!collection) {
      return res
        .status(404)
        .json({ success: false, message: "Collection not found" });
    }

    res.json({ success: true, data: collection });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

//  ADMIN – DELETE COLLECTION
exports.deleteCollection = async (req, res) => {
  try {
    const collection = await Collection.findById(req.params.id);

    if (!collection) {
      return res.status(404).json({
        success: false,
        message: "Collection not found",
      });
    }

    await Product.updateMany(
      { collectionName: collection._id },
      { $unset: { collectionName: "" } },
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
