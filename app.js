require('dotenv').config(); 
const express = require("express")
const app = express()
const mongoose = require("mongoose");
const logger = require("./utils/logger");
const archiver = require("archiver");
const zipEncrypted = require("archiver-zip-encrypted");
archiver.registerFormat("zip-encrypted", zipEncrypted);

const exportsRouter= require("./routes/index")
const swaggerDocs = require("./docs/swagger");

require("./jobs/worker");
require("./jobs/cleanup.worker");

app.use(express.json())

async function connectToDB() {
  try {
    await mongoose.connect(process.env.mongodb_url);
    logger.info("Mongo Connected");
  } catch (error) {
    logger.error("MongoDB connection failed: %s", error.message);
  }
}

connectToDB();

swaggerDocs(app);
app.use('/',exportsRouter)

port = process.env.PORT

app.listen(port ,"0.0.0.0",()=>{
    logger.info(`server is running at ${port}`)
    logger.info(`Swagger docs is available at http://localhost:${port}/api-docs`)
})
