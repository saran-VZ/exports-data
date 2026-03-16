const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");
const logger = require("./../utils/logger");

class ExcelService {
  constructor(outputDir, exportDoc, identifier) {
    this.partCounter = 1;         
    this.rowLimit = 20000;
    this.currentRowCount = 0;
    this.workbook = null;
    this.worksheet = null;
    this.generatedFiles = [];
    this.exportId = exportDoc._id?.toString() || "unknown";
    this.finalDir = outputDir;

    this.identifier = String(identifier);

    if (!fs.existsSync(this.finalDir)) {
       fs.mkdirSync(this.finalDir, { recursive: true });
    }
  }

  async createNewFile() {
    try {
      const fileName = `${this.identifier}_part${this.partCounter}.xlsx`;
      const sheetName = `${this.identifier}_part${this.partCounter}`; 

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
          logger.info(`${path.basename(this.tempPath)} created`);
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
        logger.info(`${path.basename(this.tempPath)} created`);
        this.workbook = null;
      }
    } catch (err) {
      throw err;
    }
  }
}

class ExcelGroupService {
  constructor(rootDir, exportDoc) {
    this.rootDir = rootDir;
    this.exportDoc = exportDoc; 
    this.services = new Map();                                          //map of identifier groups and  excel service instance
  }

  getService(collectionName, identifier) {
    const collectionKey = String(collectionName || "UNKNOWN_COLLECTION");
    const idKey = String(identifier || "UNKNOWN");
    const serviceKey = `${collectionKey}::${idKey}`;

    if (!this.services.has(serviceKey)) {                                //add new identifier group and excel service instance 
      const collectionFolder = path.join(this.rootDir, collectionKey);
      const identifierFolder = path.join(collectionFolder, idKey);
      fs.mkdirSync(identifierFolder, { recursive: true });
      this.services.set(serviceKey, new ExcelService(identifierFolder, this.exportDoc, idKey));
    }

    return this.services.get(serviceKey);
  }

  async writeGroupedBatch(collectionName, batch) {
    const groups = new Map();

    for (const doc of batch) {
      const idKey = String(doc.Identifier || "UNKNOWN");
      if (!groups.has(idKey)) groups.set(idKey, []);                                   
      groups.get(idKey).push(doc);                                     // group records by identifier
    }

    for (const [identifier, records] of groups) {                      // read and write each identifier group 
      const service = this.getService(collectionName, identifier);
      await service.writeBatch(records);
    }
  }

  async finalizeAll() {                                                // finalize all uncommited excel files
    for (const service of this.services.values()) {
      await service.finalize();
    }
  }
}

module.exports = {  ExcelGroupService };
