const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");
const logger = require("./../utils/logger");

class ExcelSimpleService {
  constructor(outputDir, exportDoc, collectionName) {
    this.partCounter = 1;
    this.rowLimit = 20000;
    this.currentRowCount = 0;
    this.workbook = null;
    this.worksheet = null;
    this.exportId = exportDoc._id?.toString() || "unknown";
    this.finalDir = outputDir;
    this.collectionName = String(collectionName);

    if (!fs.existsSync(this.finalDir)) {
      fs.mkdirSync(this.finalDir, { recursive: true });
    }
  }

  async createNewFile() {
    try {
      const fileName = `${this.collectionName}_part${this.partCounter}.xlsx`;
      const sheetName = `part${this.partCounter}`;

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
          logger.info(`[V2] ${path.basename(this.tempPath)} created`);
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
        logger.info(`[V2] ${path.basename(this.tempPath)} created`);
        this.workbook = null;
      }
    } catch (err) {
      throw err;
    }
  }
}

module.exports = { ExcelSimpleService };