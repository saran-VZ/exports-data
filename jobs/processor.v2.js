const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const archiver = require("archiver");

const logger = require("./../utils/logger");

const { ExcelSimpleService } = require("./excel.v2");
const { sendDownloadLinkMail, sendPasswordMail } = require("./../utils/mailer");



async function traverseAndResolve(appDoc, hierarchyPath, currentFolderPath, xFormsCollection, result, collections) {       //recursive function that extacts Categoryhirearchy and corresponding collection names
  const currentHierarchy = [...hierarchyPath, appDoc._id.toString()];


  const matchedForms = await xFormsCollection
    .find({ categoryHierarchy: currentHierarchy })
    .toArray();

  for (const form of matchedForms) {
    const collectionName = `formdata_${form._id.toString()}`;
    logger.info(` Resolved → ${collectionName} \n`);

    fs.mkdirSync(currentFolderPath, { recursive: true });

    collections.push(collectionName);         

    result.push({
      collectionName,
      folderPath: currentFolderPath,          
    });
  }

  if (appDoc.subCategories && appDoc.subCategories.length > 0) {
    for (const child of appDoc.subCategories) {
      const childFolderPath = path.join(currentFolderPath, child.name);
      await traverseAndResolve(child, currentHierarchy, childFolderPath, xFormsCollection, result, collections);        //recursive call is any subcategories available
    }
  }
}


async function runExportV2(exportDoc) {

  const ROOT_DIR = path.join(process.cwd(), "export.data");                               // main folder for exports
  const userFolder = `${exportDoc.user_name}_${exportDoc._id.toString()}`;
  const USER_ROOT = path.join(ROOT_DIR, userFolder);                                      // user specificfolder 

  fs.mkdirSync(USER_ROOT, { recursive: true });

  const db = mongoose.connection;

  const appsCollection = db.collection("apps");
  const appDoc = await appsCollection.findOne({
    _id: new mongoose.Types.ObjectId(exportDoc.app_id),
  });

  if (!appDoc) {
    throw new Error(`App not found for app_id: ${exportDoc.app_id}`);
  }


  const xFormsCollection = db.collection("x-forms");
  const resolvedItems = [];       
  const collections = [];         

  const appFolderPath = path.join(USER_ROOT, `app_${exportDoc.app_id}`);

  await traverseAndResolve(appDoc, [], appFolderPath, xFormsCollection, resolvedItems, collections);      //recursive function called to extract collection names

  if (resolvedItems.length === 0) {
    throw new Error("No collections resolved for the given app");
  }

  logger.info(` EXPORT ${exportDoc._id}] Total collections resolved: ${resolvedItems.length}`);

  const batchSize = parseInt(process.env.BATCH_SIZE);
  let totalMatched = 0;
  let docsBatch = [];

  for (const item of resolvedItems) {                                    //collection wise iteration
    docsBatch = [];

    const collection = db.collection(item.collectionName);                
    const cursor = collection.find({}).batchSize(batchSize);            // data fetched using cursor to avoid memory overload 

    const excelService = new ExcelSimpleService(item.folderPath, exportDoc, item.collectionName);       // seperate excel service instance for each collections

    for await (const doc of cursor) {
      totalMatched += 1;
      docsBatch.push(doc);

      if (docsBatch.length === batchSize) {
        await excelService.writeBatch(docsBatch);
        docsBatch = [];
      }
    }

    if (docsBatch.length > 0) {
      await excelService.writeBatch(docsBatch);                      //writes into excel whnever the batch size is reached
      docsBatch = [];
    }

    await excelService.finalize();
    logger.info(` EXPORT ${exportDoc._id}] Done -> ${item.collectionName}`);
  }

  if (totalMatched === 0) {
    throw new Error("No records found in the resolved collections");
  }

  logger.info(` EXPORT ${exportDoc._id}] Total docs exported: ${totalMatched}`);


  const zipDir = path.join(USER_ROOT, "zips");
  fs.mkdirSync(zipDir, { recursive: true });

  const zipResult = await createPasswordProtectedZip(zipDir, USER_ROOT);

  const downloadLink = buildDownloadPageLink(exportDoc._id);
  await sendDownloadLinkMail(exportDoc.email, downloadLink);
  await sendPasswordMail(exportDoc.email, zipResult.password);

  return {
    zipPath: zipResult.zipPath,
    password: zipResult.password,
    userRoot: USER_ROOT,
    collections,                  
  };
}


function buildDownloadPageLink(exportId) {                                     // landing page link builder function
  const downloadBaseUrl = process.env.BASE_DOWNLOAD_URL || "";

  const normalized = downloadBaseUrl.endsWith("/")
    ? downloadBaseUrl.slice(0, -1)
    : downloadBaseUrl;
  const pageBase = normalized.endsWith("/download")
    ? `${normalized.slice(0, -"/download".length)}/download-page`
    : `${normalized}/download-page`;

  return `${pageBase}/${exportId}`;
}


function createPasswordProtectedZip(zipDir, userRoot) {                  // zipper function 
  return new Promise((resolve, reject) => {
    try {
      const password = crypto.randomBytes(6).toString("hex");

      const zipFileName = `export-${Date.now()}.zip`;
      const zipPath = path.join(zipDir, zipFileName);

      const output = fs.createWriteStream(zipPath);

      const archive = archiver.create("zip-encrypted", {
        zlib: { level: 8 },
        encryptionMethod: "aes256",
        password: password,
      });

      output.on("close", () => {
        resolve({ zipPath, password });
      });

      archive.on("error", reject);
      archive.pipe(output);

      const items = fs.readdirSync(userRoot, { withFileTypes: true });

      items.forEach((item) => {
        if (item.isDirectory() && item.name !== "zips") {
          archive.directory(path.join(userRoot, item.name), item.name);
        }
      });

      archive.finalize();
    } catch (err) {
      reject(err);
    }
  });
}


module.exports = { runExportV2 };