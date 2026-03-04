const { Worker } = require("bullmq");
const path = require("path");
const connection = require("./../config/redis");
const exportStatus = require("./../schemas/export-status");
const cleanupQueue = require("./cleanup.queue");
const { runExport } = require("./processor");

const EXPIRY_TIME = 5 * 60 * 1000; // 5 minutes

const worker = new Worker(
  "exportQueue",
  async (job) => {
    const { exportId } = job.data;

    const exportDoc = await exportStatus.findById(exportId);
    if (!exportDoc) return;

    try {
      // 🔵 Mark processing
      exportDoc.status = "processing";
      exportDoc.started_at = new Date();
      exportDoc.attempts += 1;
      exportDoc.progress = 0;
      await exportDoc.save();

      // 🚀 Run export
      const result = await runExport(exportDoc);

      // 🟢 Mark completed
      exportDoc.status = "completed";
      exportDoc.completed_at = new Date();
      exportDoc.progress = 100;
      exportDoc.file_path = result.zipPath;
      exportDoc.password = result.password;
      exportDoc.expires_at = new Date(Date.now() + EXPIRY_TIME);
      await exportDoc.save();

      // 🧹 Schedule cleanup
      await cleanupQueue.add(
        "deleteExportFiles",
        {
          userRoot: result.userRoot,
          exportId: exportDoc._id,
        },
        {
          delay: EXPIRY_TIME,
          removeOnComplete: true,
        }
      );

    } catch (err) {
      exportDoc.status = "failed";
      exportDoc.error_message = err.message;
      await exportDoc.save();
      throw err;
    }
  },
  {
    connection,
    concurrency: 1,
  }
);

console.log("Export Worker Started...!!");