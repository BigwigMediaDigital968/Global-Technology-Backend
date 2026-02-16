const Product = require("../models/product.model");
const Collection = require("../models/collection.model");

// Create Product
exports.createProduct = async (req, res) => {
  try {
    const { name, slug, description, price, images, collection } = req.body;

    const newProduct = await Product.create({
      name,
      slug,
      description,
      price,
      images,
      collection,
    });

    // Push product into collection
    await Collection.findByIdAndUpdate(collection, {
      $push: { products: newProduct._id },
    });

    res.status(201).json(newProduct);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get All Products (with populate)
exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find().populate("collection");

    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get Single Product
exports.getSingleProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate(
      "collection",
    );

    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update Product
exports.updateProduct = async (req, res) => {
  try {
    const updated = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    }).populate("collection");

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Delete Product
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (product) {
      await Collection.findByIdAndUpdate(product.collection, {
        $pull: { products: product._id },
      });
    }

    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Website active product show
exports.getActiveProducts = async (req, res) => {
  try {
    const products = await Product.find({ status: "active" }).populate(
      "collection",
    );

    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
