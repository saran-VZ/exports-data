const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");

class ExcelService {
  constructor(outputDir, exportDoc, identifier) {
    this.partCounter = 1;         
    this.rowLimit = 25000;
    this.currentRowCount = 0;
    this.workbook = null;
    this.worksheet = null;
    this.generatedFiles = [];
    this.exportId = exportDoc?._id?.toString() || "unknown";
    this.finalDir = outputDir;

    this.identifier = identifier.replace(/[^a-zA-Z0-9_-]/g, "_");

    if (!fs.existsSync(this.finalDir)) {
      fs.mkdirSync(this.finalDir, { recursive: true });
    }
  }

  async createNewFile() {
    try {
      const fileName = `${this.identifier}_part${this.partCounter}.xlsx`;
      const sheetName = `${this.identifier}_part${this.partCounter}`
        .substring(0, 31); 

      this.tempPath = path.join(this.finalDir, fileName);

      this.workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
        filename: this.tempPath,
        useSharedStrings: false,
        useStyles: false,
      });

      this.worksheet = this.workbook.addWorksheet(sheetName);

      this.currentRowCount = 0;
      this.partCounter++;
    } catch (err) {
      throw err;
    }
  }

  async moveToFinalLocation() {
    this.generatedFiles.push(this.tempPath);
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
          await this.workbook.commit();
          console.log(`${path.basename(this.tempPath)} created`);
          await this.moveToFinalLocation();
          await this.createNewFile();
        }
      }
    } catch (err) {
      throw err;
    }
  }

  async finalize() {
    try {
      if (this.workbook) {
        await this.workbook.commit();
        await this.moveToFinalLocation();
        this.workbook = null;
      }
    } catch (err) {
      throw err;
    }
  }

  getGeneratedFiles() {
    return this.generatedFiles;
  }
}

module.exports = ExcelService;