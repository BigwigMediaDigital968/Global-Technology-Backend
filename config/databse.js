const mongoose = require("mongoose");
require("dotenv").config();


const connect=()=>{
    const MongoURL= process.env.MongoURL;
    const DB =process.env.DB;
    mongoose
    .connect(`${MongoURL}/${DB}`, {})
    .then(()=> console.log("Database connected Successfully"))
    .catch((reason)=>{
        console.log(`Unable to connect Databse \n${reason}`);
    });
}

module.exports={connect};