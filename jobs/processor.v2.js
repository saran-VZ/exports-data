const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const archiver = require("archiver");

const logger = require("./../utils/logger");


const { ExcelSimpleService } = require("./excel.v2");
const { sendDownloadLinkMail, sendPasswordMail } = require("./../utils/mailer");


// ─── Phase 1 : Recursive traversal ──────────────────────────────────────────
// Walks subCategories tree
// At each node → builds hierarchy path + folder path
// Queries x-forms for exact categoryHierarchy match
// Pushes { collectionName, folderPath } into result array

async function traverseAndResolve(node, hierarchyPath, currentFolderPath, xFormsCollection, result) {
  const currentHierarchy = [...hierarchyPath, node._id.toString()];

  // create the folder for this node
  fs.mkdirSync(currentFolderPath, { recursive: true });

  // find x-forms whose categoryHierarchy exactly matches current hierarchy
  const matchedForms = await xFormsCollection
    .find({ categoryHierarchy: currentHierarchy })
    .toArray();

  for (const form of matchedForms) {
    const collectionName = `formdata_${form._id.toString()}`;
    logger.info(`[V2] Resolved → ${collectionName} at ${currentFolderPath}`);
    result.push({
      collectionName,
      folderPath: currentFolderPath,     // exact folder to write excel into
    });
  }

  // go deeper if nested subCategories exist
  if (node.subCategories && node.subCategories.length > 0) {
    for (const child of node.subCategories) {
      const childFolderPath = path.join(currentFolderPath, child.name);
      await traverseAndResolve(child, currentHierarchy, childFolderPath, xFormsCollection, result);
    }
  }
}


// ─── Phase 2 : Export ────────────────────────────────────────────────────────

async function runExportV2(exportDoc) {

  const ROOT_DIR = path.join(process.cwd(), "export.data");
  const userFolder = `${exportDoc.user_name}_${exportDoc._id.toString()}`;
  const USER_ROOT = path.join(ROOT_DIR, userFolder);

  fs.mkdirSync(USER_ROOT, { recursive: true });

  const db = mongoose.connection;

  // ── Phase 1 : traverse apps collection and resolve collections ─────────────

  const appsCollection = db.collection("apps");
  const appDoc = await appsCollection.findOne({
    _id: new mongoose.Types.ObjectId(exportDoc.app_id),
  });

  if (!appDoc) {
    throw new Error(`App not found for app_id: ${exportDoc.app_id}`);
  }

  const xFormsCollection = db.collection("x-forms");
  const resolvedItems = [];     // array of { collectionName, folderPath }

  // app level folder → export.data/username_exportId/app_appId/
  const appFolderPath = path.join(USER_ROOT, `app_${exportDoc.app_id}`);

  await traverseAndResolve(appDoc, [], appFolderPath, xFormsCollection, resolvedItems);

  if (resolvedItems.length === 0) {
    throw new Error("No collections resolved for the given app");
  }

  logger.info(`[V2 EXPORT ${exportDoc._id}] Total collections resolved: ${resolvedItems.length}`);

  // ── Phase 2 : cursor fetch and write excel into respective folders ──────────

  const batchSize = 5000;
  let totalMatched = 0;
  let docsBatch = [];

  for (const item of resolvedItems) {
    docsBatch = [];

    const collection = db.collection(item.collectionName);
    const cursor = collection.find({}).batchSize(batchSize);    
    // each collection gets its own ExcelSimpleService instance
    // pointed at the correct folder in the hierarchy
    const excelService = new ExcelSimpleService(item.folderPath, exportDoc, item.collectionName);

    for await (const doc of cursor) {
      totalMatched += 1;
      docsBatch.push(doc);

      if (docsBatch.length === batchSize) {
        await excelService.writeBatch(docsBatch);
        docsBatch = [];
      }
    }

    if (docsBatch.length > 0) {
      await excelService.writeBatch(docsBatch);
      docsBatch = [];
    }

    await excelService.finalize();
    logger.info(`[V2 EXPORT ${exportDoc._id}] Done → ${item.collectionName}`);
  }

  if (totalMatched === 0) {
    throw new Error("No records found in the resolved collections");
  }

  logger.info(`[V2 EXPORT ${exportDoc._id}] Total docs exported: ${totalMatched}`);

  // ── Zip and mail ───────────────────────────────────────────────────────────

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
  };
}


function buildDownloadPageLink(exportId) {
  const downloadBaseUrl = process.env.BASE_DOWNLOAD_URL || "";

  const normalized = downloadBaseUrl.endsWith("/")
    ? downloadBaseUrl.slice(0, -1)
    : downloadBaseUrl;
  const pageBase = normalized.endsWith("/download")
    ? `${normalized.slice(0, -"/download".length)}/download-page`
    : `${normalized}/download-page`;

  return `${pageBase}/${exportId}`;
}


function createPasswordProtectedZip(zipDir, userRoot) {
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