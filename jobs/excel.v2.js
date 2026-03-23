const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");
const logger = require("./../utils/logger");

class ExcelSimpleService {
  constructor(outputDir, exportDoc, collectionName) {
    this.partCounter = 1;                                       // counts the no of excel files created for a collection 
    this.rowLimit = parseInt(process.env.EXCEL_MAX_ROWS);
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

      this.workbook = new ExcelJS.stream.xlsx.WorkbookWriter({                   // streaming workbook to instantly commit each rows to reduce memory usage
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
        this.worksheet.addRow(Object.values(doc)).commit();            // writes each document as a new row in excel and commits immediately
        this.currentRowCount++;
 
        if (this.currentRowCount >= this.rowLimit) {                   
          await this.workbook.commit();                               // if rowlimit is reached, commits the current file and creates a new file
          logger.info(` ${path.basename(this.tempPath)} created`);
          await this.createNewFile();
        }
      }
    } catch (err) {
      throw err;
    }
  }

  async finalize() {                                                    // commits the remaining rows in the last file and finalizes the workbook
    try {
      if (this.workbook) {
        await this.workbook.commit();
        logger.info(` ${path.basename(this.tempPath)} created`);
        this.workbook = null;
      }
    } catch (err) {
      throw err;
    }
  }
}

module.exports = { ExcelSimpleService };