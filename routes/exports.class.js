const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");

class ExcelService {
  constructor() {
    this.fileCounter = 1;
    this.rowLimit = 25000;
    this.currentRowCount = 0;
    this.workbook = null;
    this.worksheet = null;

    this.generatedFiles = []; 

    this.finalDir = path.join(__dirname, "exports/excels"); 

    if (!fs.existsSync(this.finalDir)) {
      fs.mkdirSync(this.finalDir, { recursive: true });
    }
  }

  async createNewFile() {
    this.tempPath = path.join(this.finalDir, `export_${this.fileCounter}.xlsx`);

    this.workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      filename: this.tempPath,
      useSharedStrings: false,
      useStyles: false,
    });

    this.worksheet = this.workbook.addWorksheet("Sheet1");
    this.currentRowCount = 0;

    this.fileCounter++;
  }

  async moveToFinalLocation() {
    this.generatedFiles.push(this.tempPath);
  }

  async writeBatch(batch) {
    if (!this.workbook) {
      await this.createNewFile();
    }

    for (const doc of batch) {
      this.worksheet.addRow(Object.values(doc)).commit();
      this.currentRowCount++;

      if (this.currentRowCount >= this.rowLimit) {
        await this.workbook.commit();
        console.log(`File ${this.tempPath} created `);
        await this.moveToFinalLocation();
        await this.createNewFile();
      }
    }
  }

  async finalize() {
    if (this.workbook) {
      await this.workbook.commit();
      await this.moveToFinalLocation();
    }
  }

  getGeneratedFiles() {
    return this.generatedFiles;
  }
}

module.exports = ExcelService;