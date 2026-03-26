const express = require("express");
const router = express.Router();
const Category = require("../models/categoryModel");
const Collection = require("../models/collection.model");

// GET all active categories (optionally filter by collection)
router.get("/", async (req, res) => {
  try {
    const filter = { status: "active" };
    if (req.query.collection) filter.collectionName = req.query.collection;

    const categories = await Category.find(filter)
      .populate("collectionName", "name slug")
      .sort("name");

    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET categories by collection
router.get("/by-collection/:collectionId", async (req, res) => {
  try {
    const categories = await Category.find({
      collectionName: req.params.collectionId,
      status: "active",
    })
      .populate("collectionName", "name slug") // ✅ ADD THIS
      .sort("name");

    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST single category (existing, kept for backward compat)
router.post("/", async (req, res) => {
  try {
    const { name, collectionName } = req.body;

    let category = await Category.findOne({
      name: new RegExp(`^${name}$`, "i"),
      collectionName,
    });

    if (!category) {
      category = await Category.create({ name, collectionName });
    }

    // Sync to collection
    await Collection.findByIdAndUpdate(collectionName, {
      $addToSet: { categories: category._id },
    });

    res.status(201).json({ success: true, data: category });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post("/bulk", async (req, res) => {
  try {
    const { names, collectionName } = req.body;

    if (!Array.isArray(names) || !names.length || !collectionName) {
      return res.status(400).json({
        success: false,
        message: "names (array) and collectionName are required",
      });
    }

    const results = await Promise.all(
      names.map(async (name) => {
        name = name.trim();
        let cat = await Category.findOne({
          name: new RegExp(`^${name}$`, "i"),
          collectionName,
        });
        if (!cat) cat = await Category.create({ name, collectionName });
        return cat;
      }),
    );

    // Sync all created categories to the collection in one shot
    await Collection.findByIdAndUpdate(collectionName, {
      $addToSet: { categories: { $each: results.map((c) => c._id) } },
    });

    res.status(201).json({ success: true, data: results });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PUT /api/categories/:id
router.put("/:id", async (req, res) => {
  try {
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { name: req.body.name, status: req.body.status },
      { new: true },
    );
    res.json({ success: true, data: category });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/categories/:id
router.delete("/:id", async (req, res) => {
  try {
    await Category.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Category deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
