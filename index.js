const express = require("express");
const cors = require("cors");
const {connect}=require("./config/databse");

const leadroute =require("./routes/lead.route");

require("dotenv").config();

const app =express();
app.use(express.json());
app.use(cors());

const newsletterRoute = require("./routes/newsletter.route");

app.use("/api/newsletter", newsletterRoute);


app.use("/api/lead",leadroute);

app.listen(process.env.PORT, async()=> {
    try{
        await connect();
    }
    catch(error){
        console.log("❌ Database Connection failed ", error);
    }
    console.log(`🚀 Server is listening on port ${process.env.PORT}`);
});