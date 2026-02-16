const Collection = require("../models/collection.model");
const Product = require("../models/product.model");

// ADMIN – Create Collection
exports.createCollection = async (req, res) => {
  try {
    const { name, slug, description, image } = req.body;

    const collection = await Collection.create({
      name,
      slug,
      description,
      image,
    });

    res.status(201).json(collection);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get Collection
exports.getAllCollections = async (req, res) => {
  try {
    const collections = await Collection.find().populate("products");

    res.json(collections);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update collection
exports.updateCollection = async (req, res) => {
  try {
    const updated = await Collection.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true },
    ).populate("products");

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Delete Collection
exports.deleteCollection = async (req, res) => {
  try {
    const collection = await Collection.findByIdAndDelete(req.params.id);

    if (collection) {
      await Product.updateMany(
        { collection: collection._id },
        { $unset: { collection: "" } },
      );
    }

    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// WEBSITE – Active Collections Only
exports.getActiveCollections = async (req, res) => {
  try {
    const collections = await Collection.find({ status: "active" }).populate({
      path: "products",
      match: { status: "active" },
    });

    res.json(collections);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
