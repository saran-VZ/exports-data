// worker.js
const mongoose = require("mongoose");
const batteryData = mongoose.connection.collection("battery_data");
const ExcelService = require("./../routes/exports.class");
const path = require("path");
const crypto = require("crypto");
const { add } = require("node-7z"); 
const path7zip = require("7zip-bin").path7za;

async function runExport() {
  try{
  const excelService = new ExcelService();
  const batchSize = 5000;
  let batchCounter = 0;
  let totalDocs = 0;
  let batch = [];

  const cursor = batteryData.find({}).batchSize(batchSize);

  for await (const doc of cursor) {
    batch.push(doc);
    totalDocs++;

    if (batch.length === batchSize) {
      await excelService.writeBatch(batch);
      batchCounter++;
      batch = [];
    }
  }

  if (batch.length > 0) {
    await excelService.writeBatch(batch);
    batchCounter++;
  }

  await excelService.finalize();
  console.log("Excel export completed");

  const excelFiles = excelService.getGeneratedFiles(); 
  const zipResult = await createPasswordProtectedZip(excelFiles);

  console.log("Zip file created:", zipResult.zipPath);
  console.log("Password for zip:", zipResult.password);

  return {
    totalDocs,
    totalBatches: batchCounter,
    zipPath: zipResult.zipPath,
    password: zipResult.password,
  };


async function createPasswordProtectedZip(files) {
  return new Promise((resolve, reject) => {
    const zipPath = path.join(__dirname, `export-${Date.now()}.zip`);
    const password = crypto.randomBytes(6).toString("hex"); 

    const myStream = add(zipPath, files, {
      $bin: path7zip,
      password: password,
      recursive: true,
    });

    myStream.on("end", () => {
      console.log(`Encrypted zip created at ${zipPath}`);
      resolve({ zipPath, password });
    });

    myStream.on("error", (err) => reject(err));
  });
}}catch(err){
  console.error("Error during export:", err);
  throw err;
}}

module.exports = { runExport };