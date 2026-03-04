const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const archiver = require("archiver");
const zipEncrypted = require("archiver-zip-encrypted");

const ExcelService = require("./excel");
const { sendDownloadLinkMail, sendPasswordMail } = require("./../utils/mailer");

const batteryData = mongoose.connection.collection("battery_data");

archiver.registerFormat("zip-encrypted", zipEncrypted);

async function runExport(exportDoc) {
  const ROOT_DIR = path.join(process.cwd(), "export.data");
  const userFolder = `${exportDoc.user_name}_${exportDoc._id.toString()}`;
  const USER_ROOT = path.join(ROOT_DIR, userFolder);

  fs.mkdirSync(USER_ROOT, { recursive: true });

  const batchSize = 5000;
  const identifierGroups = {};

  const cursor = batteryData.find({}).batchSize(batchSize);

  for await (const doc of cursor) {
    const idKey = doc.Identifier || "UNKNOWN";
    if (!identifierGroups[idKey]) identifierGroups[idKey] = [];
    identifierGroups[idKey].push(doc);
  }

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

  const downloadLink = `${process.env.BASE_DOWNLOAD_URL}/${exportDoc._id}`;
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