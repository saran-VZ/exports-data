require('dotenv').config(); 
const express = require("express")
const app = express()
const mongoose = require("mongoose");

const exportsRouter= require("./routes/index")
const swaggerDocs = require("./docs/swagger");

require("./jobs/worker");
require("./jobs/cleanup.worker");

app.use(express.json())

async function connectToDB() {
  try {
    await mongoose.connect(process.env.mongodb_url);
    console.log("Mongo Connected");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
  }
}

connectToDB();

swaggerDocs(app);
app.use('/',exportsRouter)

port = process.env.PORT

app.listen(port ,"0.0.0.0",()=>{
    console.log(`server is running at ${port}`)
    console.log(`Swagger docs is available at http://localhost:${port}/api-docs`)
})