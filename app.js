require('dotenv').config(); 
const express = require("express")
const app = express()
const mongoose = require("mongoose");
const swaggerUi = require("swagger-ui-express");

const exportsRouter= require("./routes/index")
const swaggerSpec = require("./config/swagger");


require("./jobs/worker");
require("./jobs/cleanup.worker");

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

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/',exportsRouter)

port= process.env.PORT

app.listen(port ,"0.0.0.0",()=>{
    console.log(`server is running at ${port}`)
})