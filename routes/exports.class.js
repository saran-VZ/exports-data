const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");
const { tryCatch } = require("bullmq");

class ExcelService {
  constructor() {
    this.fileCounter = 1;
    this.rowLimit = 25000;
    this.currentRowCount = 0;
    this.workbook = null;
    this.worksheet = null;

    this.generatedFiles = []; 

    this.finalDir = path.join(process.env.HOME, "Documents/exports/excels");

    if (!fs.existsSync(this.finalDir)) {
      fs.mkdirSync(this.finalDir, { recursive: true });
    }
  }

  async createNewFile() {
    try {
    this.tempPath = `/tmp/export_${this.fileCounter}.xlsx`;

    this.workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      filename: this.tempPath,
      useSharedStrings: false,
      useStyles: false,
    });

    this.worksheet = this.workbook.addWorksheet("Sheet1");
    this.currentRowCount = 0;

    this.fileCounter++;
  }catch(err){
    throw err;
  }}

  async moveToFinalLocation() {
    const finalPath = path.join(this.finalDir, path.basename(this.tempPath));
    fs.renameSync(this.tempPath, finalPath);

    
    this.generatedFiles.push(finalPath);
  }

  async writeBatch(batch) {
    try {
    if (!this.workbook) {
      await this.createNewFile();
    }

    for (const doc of batch) {
      this.worksheet.addRow(Object.values(doc)).commit();
      this.currentRowCount++;

      if (this.currentRowCount >= this.rowLimit) {
        console.time("FILE COMMIT");
        await this.workbook.commit();
        console.timeEnd("FILE COMMIT");

        await this.moveToFinalLocation();
        await this.createNewFile();
      }
    }
  }catch(err){
    throw err;
  }
  }

  async finalize() {
    try {
    if (this.workbook) {
      await this.workbook.commit();
      await this.moveToFinalLocation();
    }
  }catch(err){
    throw err;
  }}

  getGeneratedFiles() {
    return this.generatedFiles;
  }
}

module.exports = ExcelService;