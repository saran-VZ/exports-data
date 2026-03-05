const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const archiver = require("archiver");
const zipEncrypted = require("archiver-zip-encrypted");

const ExcelService = require("./excel");
const { sendDownloadLinkMail, sendPasswordMail } = require("./../utils/mailer");

archiver.registerFormat("zip-encrypted", zipEncrypted);

function buildDownloadPageLink(exportId) {
  const pageBaseUrl = (process.env.BASE_DOWNLOAD_PAGE_URL || "");
  if (pageBaseUrl) {
    return `${pageBaseUrl.replace(/\/+$/, "")}/${exportId}`;
  }

  const downloadBaseUrl = (process.env.BASE_DOWNLOAD_URL || "");
  
  const normalized = downloadBaseUrl.replace(/\/+$/, "");
  const pageBase = normalized.endsWith("/download")
    ? normalized.replace(/\/download$/, "/download-page")
    : `${normalized}/download-page`;

  return `${pageBase}/${exportId}`;
}

async function runExport(exportDoc) {
  const ROOT_DIR = path.join(process.cwd(), "export.data");
  const userFolder = `${exportDoc.user_name}_${exportDoc._id.toString()}`;      // Unique folder per export
  const USER_ROOT = path.join(ROOT_DIR, userFolder);

  fs.mkdirSync(USER_ROOT, { recursive: true });

  const batchSize = 5000;
  const identifierGroups = {};
  let totalMatched = 0;

  const selectedCollections = Array.isArray(exportDoc.collections)
    ? exportDoc.collections
        .filter((name) => typeof name === "string" && name !== "")
        .map((name) => name.trim())
    : [];

  if (selectedCollections.length === 0) {
    throw new Error("No collections selected for export");
  }

  for (const collectionName of selectedCollections) {
    const collection = mongoose.connection.collection(collectionName);
    const cursor = collection.find(exportDoc.filters).batchSize(batchSize);
    let collectionMatched = 0;

    for await (const doc of cursor) {
      totalMatched += 1;
      const idKey = doc.Identifier || "UNKNOWN";
      if (!identifierGroups[idKey]) identifierGroups[idKey] = [];       // Grouping by Identifier
      identifierGroups[idKey].push(doc);
    }
  }

  if (totalMatched === 0) {
    throw new Error("No records found for the selected filters/collections");
  }

  console.log(`[EXPORT ${exportDoc._id}] Total matched docs: ${totalMatched}`);

  for (const [identifier, records] of Object.entries(identifierGroups)) {
    const identifierFolder = path.join(USER_ROOT, identifier);
    fs.mkdirSync(identifierFolder, { recursive: true });

    const excelService = new ExcelService(identifierFolder, exportDoc, identifier);

    let batch = [];

    for (const doc of records) {
      batch.push(doc);
      if (batch.length === batchSize) {
        await excelService.writeBatch(batch, `Identifier_${identifier}`);
        batch = [];
      }
    }

    if (batch.length > 0) {
      await excelService.writeBatch(batch, `Identifier_${identifier}`);
    }
    await excelService.finalize();
  }

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

function createPasswordProtectedZip(zipDir, userRoot) {
  return new Promise((resolve, reject) => {
    try {
      const password = crypto
        .randomBytes(12)
        .toString("base64")
        .slice(0, 12)
        .replace(/[+/=]/g, "A");

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
