require('dotenv').config(); 
const express = require("express")
const app = express()
const mongoose = require("mongoose");

const exportsRouter= require("./routes/exports.controller")

app.use(express.json())

async function connectToDB() {
  try {
    await mongoose.connect(process.env.mongodb_url);
    console.log("DB Connected");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
  }
}

connectToDB();

app.use('/',exportsRouter)

port= process.env.PORT

app.listen(port ,()=>{
    console.log(`server is running at ${port}`)
})