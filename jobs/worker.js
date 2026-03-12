const { Worker } = require("bullmq");
const connection = require("./../config/redis");
const exportStatus = require("./../schemas/export-status");
const cleanupQueue = require("./cleanup.queue");
const { runExport } = require("./processor");

const EXPIRY_TIME = 5 * 60 * 1000;                     // 5 minutes

const worker = new Worker(
  "exportQueue",
  async (job) => {
    const { exportId } = job.data;
    console.log(`[JOB ${job.id}] Started export job for exportId=${exportId}`);

    const exportDoc = await exportStatus.findById(exportId);
    if (!exportDoc) return;

    try {
      exportDoc.status = "processing";
      exportDoc.started_at = new Date();
      exportDoc.attempts += 1;
      exportDoc.progress = 0;
      await exportDoc.save();

      const result = await runExport(exportDoc);

      exportDoc.status = "completed";
      exportDoc.completed_at = new Date();
      exportDoc.progress = 100;
      exportDoc.file_path = result.zipPath;
      exportDoc.password = result.password;
      exportDoc.expires_at = new Date(Date.now() + EXPIRY_TIME);
      await exportDoc.save();

      console.log("Export and zip completed for:", exportDoc._id);
      console.log("Notification emails sent to:", exportDoc.email);

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
      console.error(`[JOB ${job.id}] Export failed for exportId=${exportId}:`, err);
      throw err;
    }
  },
  {
    connection,
    concurrency: 2,
  }
);

worker.on("failed", (job, err) => {
  console.error(
    `[JOB ${job?.id ?? "unknown"}] Worker failed event:`,
    err?.message || err
  );
});

worker.on("completed", (job) => {
  console.log(`[JOB ${job.id}] Worker completed event`);
});

console.log("Export Worker Started...!!");
