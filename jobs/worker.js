const { Worker } = require("bullmq");
const connection = require("./../config/redis");
const exportStatus = require("./../schemas/export-status");
const cleanupQueue = require("./cleanup.queue");
const { runExport } = require("./processor");
const { runExportV2 } = require("./processor.v2");
const logger = require("./../utils/logger");

const EXPIRY_TIME = 5 * 60 * 1000;                      // 5 minutes

const worker = new Worker(
  "exportQueue",
  async (job) => {
    const { exportId } = job.data;
    logger.info(`[JOB ${job.id}] Started export job for exportId=${exportId}`);

    const exportDoc = await exportStatus.findById(exportId);
    if (!exportDoc) return;

    try {
      exportDoc.status = "processing";
      exportDoc.started_at = new Date();
      exportDoc.attempts += 1;
      exportDoc.progress = 0;
      await exportDoc.save();

      // ── route to correct processor based on version ──────────────────────
      let result;
      if (exportDoc.version === "2.0") {
        logger.info(`[JOB ${job.id}] Routing to V2 processor`);
        result = await runExportV2(exportDoc);
      } else {
        logger.info(`[JOB ${job.id}] Routing to V1 processor`);
        result = await runExport(exportDoc);
      }

      exportDoc.status = "completed";
      exportDoc.completed_at = new Date();
      exportDoc.progress = 100;
      exportDoc.file_path = result.zipPath;
      exportDoc.password = result.password;
      exportDoc.expires_at = new Date(Date.now() + EXPIRY_TIME);
      await exportDoc.save();

      logger.info("Export and zip completed for: %s", exportDoc._id);
      logger.info("Notification emails sent to: %s", exportDoc.email);

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
      logger.error(`[JOB ${job.id}] Export failed for exportId=${exportId}: %s`, err);
      throw err;
    }
  },
  {
    connection,
    concurrency: 2,
  }
);

worker.on("failed", (job, err) => {
  logger.error(
    `[JOB ${job?.id ?? "unknown"}] Worker failed event: %s`,
    err?.message || err
  );
});

worker.on("completed", (job) => {
  logger.info(`[JOB ${job.id}] Worker completed event`);
});

logger.info("Export Worker Started...!!");