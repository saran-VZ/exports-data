const { Worker } = require("bullmq");
const fs = require("fs");
const connection = require("./../config/redis");
const exportStatus = require("./../schemas/export-status");
const logger = require("./../utils/logger");

const cleanupWorker = new Worker(
  "cleanupQueue",
  async (job) => {
    try {
      const { exportId, userRoot } = job.data;

      const exportDoc = await exportStatus.findById(exportId);
      if (!exportDoc) return;

      const now = new Date();
      if (!exportDoc.expires_at || now < exportDoc.expires_at) {
        logger.info("Not expired yet");
        return;
      }

      if (userRoot && fs.existsSync(userRoot)) {
        fs.rmSync(userRoot, { recursive: true, force: true });
        logger.info("Deleted: %s", userRoot);
      }

      exportDoc.status = "expired";
      await exportDoc.save();

      logger.info("Cleanup completed for: %s", exportId);

    } catch (err) {
      logger.error("Cleanup failed: %s", err);
    }
  },
  { connection }
);

logger.info("Cleanup Worker Running...");
