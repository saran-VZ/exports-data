const exportStatus = require("../schemas/export-status");
const exportQueue = require("../jobs/queue");
const { calculateDelay } = require("../utils/sheduler");

class ExportServiceV2 {

  async createExportV2(data) {
    try {
      const { app_id, user_name,email } = data;

      if (!app_id) {
        const err = new Error("app_id is required");
        err.status = 400;
        throw err;
      }

      // export doc created with app_id stored
      // processor.v2.js will use this app_id to resolve actual collections
      const exportDoc = await exportStatus.create({
        user_name,
        email,
        app_id,                  // stored so processor can use it
        collections: [],         // will be resolved in processor
        filters: {},
        file_format: "xlsx",
        status: "queued",
        progress: 0,
        version: "2.0",
      });

      const delay = calculateDelay();

      const job = await exportQueue.add(
        "exportJob",
        { exportId: exportDoc._id },
        {
          delay,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
          removeOnComplete: true,
          removeOnFail: false,
          stalledInterval: 30000,
        }
      );

      if (delay > 0) {
        exportDoc.scheduled_for = new Date(Date.now() + delay);
        await exportDoc.save();
      }

      return { exportDoc, job, delay };

    } catch (err) {
      throw err;
    }
  }
}

module.exports = ExportServiceV2;