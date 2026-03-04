const { Worker } = require("bullmq");
const fs = require("fs");
const connection = require("./../config/redis");
const exportStatus = require("./../schemas/export-status");

const cleanupWorker = new Worker(
  "cleanupQueue",
  async (job) => {
    try {
      const { exportId, userRoot } = job.data;

      const exportDoc = await exportStatus.findById(exportId);
      if (!exportDoc) return;

      const now = new Date();
      if (!exportDoc.expires_at || now < exportDoc.expires_at) {
        console.log("Not expired yet.");
        return;
      }

      if (userRoot && fs.existsSync(userRoot)) {
        fs.rmSync(userRoot, { recursive: true, force: true });
        console.log("Deleted:", userRoot);
      }

      exportDoc.status = "expired";
      await exportDoc.save();

      console.log("Cleanup completed for:", exportId);

    } catch (err) {
      console.error("Cleanup failed:", err);
    }
  },
  { connection }
);

console.log("Cleanup Worker Running...");
module.exports = cleanupWorker;