const mongoose = require("mongoose");
const slugify = require("slugify");

const FAQSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    answer: { type: String, required: true },
  },
  { _id: false }
);

const SizeSchema = new mongoose.Schema(
  {
    size: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const ProductSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      unique: true,
      index: true,
    },

    description: String,

    images: [String],

    sizes: [SizeSchema],

    price: {
      type: Number,
      required: true,
    },

    extraDetails: {
      type: Map,
      of: String,
    },

    faqs: [FAQSchema],

    collectionName: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Collection",
      required: true,
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true }
);

/* 🔥 Smart Slug Generator */
ProductSchema.pre("save", async function (next) {
  if (!this.slug) {
    let baseSlug = slugify(this.name, { lower: true, strict: true });
    let slug = baseSlug;
    let count = 1;

    while (await mongoose.models.Product.findOne({ slug })) {
      slug = `${baseSlug}-${count++}`;
    }

    this.slug = slug;
  }

  next();
});

module.exports = mongoose.model("Product", ProductSchema);