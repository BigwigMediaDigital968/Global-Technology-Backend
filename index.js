const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { connect } = require("./config/database");

const userRoute = require("./routes/user.route");
const leadRoute = require("./routes/lead.route");
const newsletterRoute = require("./routes/newsletter.route");
const productRoutes = require("./routes/product.route");
const collectionRoutes = require("./routes/collection.route");
const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/user", userRoute);
app.use("/api/lead", leadRoute);
app.use("/api/newsletter", newsletterRoute);
app.use("/api/products", productRoutes);
app.use("/api/collections", collectionRoutes);

app.listen(process.env.PORT, async () => {
  try {
    await connect();
    console.log("✅ Database Connected");
  } catch (error) {
    console.log("❌ Database Connection failed", error);
  }

  console.log(`🚀 Server running on port ${process.env.PORT}`);
});
