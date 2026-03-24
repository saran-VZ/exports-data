const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");
const logger = require("./../utils/logger");

class ExcelSimpleService {
  constructor(outputDir, exportDoc, collectionName) {
    this.partCounter = 1;                                       // counts the no. of excel files created for a collection 
    this.rowLimit = parseInt(process.env.EXCEL_MAX_ROWS);
    this.currentRowCount = 0;
    this.workbook = null;
    this.worksheet = null;
    this.exportId = exportDoc._id?.toString() || "unknown";
    this.finalDir = outputDir;
    this.collectionName = String(collectionName);
    this.headerKeys = null;
    this.headerKeySet = new Set();
    this.headerWritten = false;

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
      this.headerWritten = false;
      this.partCounter++;
    } catch (err) {
      throw err;
    }
  }

  async commitCurrentFile() {
    if (this.workbook) {
      await this.workbook.commit();
      logger.info(` ${path.basename(this.tempPath)} created`);
      this.workbook = null;
    }
  }

  ensureHeaderKeys(doc) {
    const keys = Object.keys(doc);
    let changed = false;

    if (!this.headerKeys) {
      this.headerKeys = keys;
      this.headerKeySet = new Set(keys);
      return true;
    }

    for (const key of keys) {
      if (!this.headerKeySet.has(key)) {
        this.headerKeySet.add(key);
        this.headerKeys.push(key);
        changed = true;
      }
    }

    return changed;
  }

  writeHeaderIfNeeded() {
    if (!this.headerWritten && this.headerKeys.length > 0) {
      this.worksheet.addRow(this.headerKeys).commit();
      this.headerWritten = true;
    }
  }

  async writeBatch(batch) {
    try {
      if (!this.workbook) {
        await this.createNewFile();
      }

      for (const doc of batch) {
        if (!this.workbook) {
          await this.createNewFile();
        }

        const headerChanged = this.ensureHeaderKeys(doc);

        if (headerChanged && this.headerWritten) {
          await this.commitCurrentFile();
          await this.createNewFile();
        }

        this.writeHeaderIfNeeded();                                   //adds headers 
        const row = this.headerKeys.map((key) => doc[key]);
        this.worksheet.addRow(row).commit();                            // writes each document as a new row in excel and commits immediately
        this.currentRowCount++;
 
        if (this.currentRowCount >= this.rowLimit) {                   
          await this.commitCurrentFile();                               // if rowlimit is reached, commits the current file; new file on next row
        }
      }
    } catch (err) {
      throw err;
    }
  }

  async finalize() {                                               // commits the remaining rows in the last file and finalizes the workbook
    try {
      if (this.workbook) {
        await this.commitCurrentFile();
      }
    } catch (err) {
      throw err;
    }
  }
}

module.exports = { ExcelSimpleService };
