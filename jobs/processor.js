const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const archiver = require("archiver");
const zipEncrypted = require("archiver-zip-encrypted");

const { ExcelGroupService } = require("./excel");
const { sendDownloadLinkMail, sendPasswordMail } = require("./../utils/mailer");

archiver.registerFormat("zip-encrypted", zipEncrypted);


async function runExport(exportDoc) {
  const ROOT_DIR = path.join(process.cwd(), "export.data");
  const userFolder = `${exportDoc.user_name}_${exportDoc._id.toString()}`;      // Unique folder per export
  const USER_ROOT = path.join(ROOT_DIR, userFolder);

  fs.mkdirSync(USER_ROOT, { recursive: true });

  const batchSize = 5000;
  const excelGroupService = new ExcelGroupService(USER_ROOT, exportDoc);
  let totalMatched = 0;
  let docsBatch = [];

  const selectedCollections = Array.isArray(exportDoc.collections)
    ? exportDoc.collections
        .filter((name) => typeof name === "string" && name !== "")
    : [];

  if (selectedCollections.length === 0) {
    throw new Error("No collections selected for export");
  }

  for (const collectionName of selectedCollections) {
    
    const collection = mongoose.connection.collection(collectionName);
    const cursor = collection.find(exportDoc.filters).batchSize(batchSize);

    for await (const doc of cursor) {
      totalMatched += 1;
      docsBatch.push(doc);

      if (docsBatch.length === batchSize) {
        await excelGroupService.writeGroupedBatch(docsBatch);
        docsBatch = [];
      }
    }
  }

  if (docsBatch.length > 0) {
    await excelGroupService.writeGroupedBatch(docsBatch);
    docsBatch = [];
  }

  if (totalMatched === 0) {
    throw new Error("No records found for the selected filters/collections");
  }

  await excelGroupService.finalizeAll();
  
  console.log(`[EXPORT ${exportDoc._id}] Total matched docs: ${totalMatched}`);

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
  const downloadBaseUrl = (process.env.BASE_DOWNLOAD_URL || "");

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
      const password = crypto
        .randomBytes(6)
        .toString("hex");

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
          archive.directory(
            path.join(userRoot, item.name),
            item.name
          );
        }
      });

      archive.finalize();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { runExport };
