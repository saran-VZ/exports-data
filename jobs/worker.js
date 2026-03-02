const mongoose = require("mongoose");
const ExcelService = require("./../routes/exports.class");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { add } = require("node-7z");

// System 7z binary inside Docker
const SYSTEM_7ZIP = "/usr/bin/7z";

const EXCEL_DIR = path.join(__dirname, "..", "exports", "excels");
const ZIP_DIR = path.join(__dirname, "..", "exports", "jobs");

fs.mkdirSync(EXCEL_DIR, { recursive: true });
fs.mkdirSync(ZIP_DIR, { recursive: true });


const batteryData = mongoose.connection.collection("battery_data");

async function runExport() {
  try {
    const excelService = new ExcelService(EXCEL_DIR); 
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
  } catch (err) {
    console.error("Error during export:", err);
    throw err;
  }
}


async function createPasswordProtectedZip(files) {
  return new Promise((resolve, reject) => {
    const zipPath = path.join(ZIP_DIR, `export-${Date.now()}.zip`);
    const password = crypto.randomBytes(6).toString("hex");

    const filesForZip = files.map((f) => path.basename(f));

    const zipStream = add(zipPath, filesForZip, {
      $bin: SYSTEM_7ZIP,
      password,
      recursive: true,
      cwd: EXCEL_DIR, 
    });

    zipStream.on("end", () => {
      console.log(`Encrypted zip created at ${zipPath}`);
      resolve({ zipPath, password });
    });

    zipStream.on("error", (err) => {
      console.error("7z zip error:", err);
      reject(err);
    });
  });
}

module.exports = { runExport };