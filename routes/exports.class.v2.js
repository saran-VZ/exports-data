const mongoose = require("mongoose");
const exportStatus = require("./../schemas/export-status");
const exportQueue = require("./../jobs/queue");
const { calculateDelay } = require("./../utils/sheduler");

class ExportServiceV2 {

  async createExportV2(data) {
    try {
      const { app_id, user_name,email } = data;

      if (!app_id) {
        const err = new Error("app_id is required");
        err.status = 400;
        throw err;
      }

      // Validate that the app exists
      const appsCollection = mongoose.connection.collection("apps");
      const appDoc = await appsCollection.findOne({
        _id: new mongoose.Types.ObjectId(app_id),
      });

      if (!appDoc) {
        const err = new Error(`App not found for app_id: ${app_id}`);
        err.status = 404;
        throw err;
      }

      const exportDoc = await exportStatus.create({                  //creates the export job record in the DB when the API is hit
        user_name,
        email,
        app_id,                  
        collections: [],         
        filters: {},
        file_format: "xlsx",
        status: "queued",
        progress: 0,
        version: "2.0",
      });

      const delay = calculateDelay();                            // delay calculated for sheduling the incomming export job

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

      if (delay > 0) {                                            // if not immediate mode then the sheduled time is added to the DB record
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