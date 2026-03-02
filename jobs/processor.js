const ExcelService = require("../routes/exports.class");
const mongoose = require("mongoose");
const batteryData = mongoose.connection.collection("battery_data");

async function runExport(exportDoc) {
  const excelService = new ExcelService();
  const batchSize = 1000;
  let batch = [];
  let totalDocs = 0;

  const cursor = batteryData.find({}).batchSize(2000);

  for await (const doc of cursor) {
    batch.push(doc);
    totalDocs++;

    if (batch.length === batchSize) {
      await excelService.writeBatch(batch);
      batch = [];
    
      if (exportDoc) {
        exportDoc.progress = Math.floor((totalDocs / (await batteryData.countDocuments())) * 100);
        await exportDoc.save();
      }
    }
  }

  if (batch.length > 0) await excelService.writeBatch(batch);
  await excelService.finalize();

  return { totalDocs, filePath: excelService.getFilePath() };
}

module.exports = { runExport };