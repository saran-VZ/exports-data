const exportStatus = require("./../schemas/export-status");
const exportQueue = require("./../jobs/queue");
const { calculateDelay } = require("./../utils/sheduler");
const fs = require("fs");

class ExportService {
  async createExport(data) {
    try{
    const exportDoc = await exportStatus.create({
      user_name: data.user_name,
      email: data.email,
      collections: data.collections,
      filters: data.filters || {},
      file_format: data.fileFormat || "xlsx",
      status: "queued",
      progress: 0,
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
      }
    );

    if (delay > 0) {
      exportDoc.scheduled_for = new Date(Date.now() + delay);
      await exportDoc.save();
    }

    return { exportDoc, job, delay };
  }catch(err){
    throw err;
  }
  } 

  async getExportStatus(id) {                           
    try{
      return await exportStatus.findById(id);
    }catch(err){
      throw err;
    }  
  }

  async downloadExport(id) {
    try{
    const exportDoc = await exportStatus.findById(id);

    if (!exportDoc) 
      throw new Error("NOT_FOUND");
    if (!exportDoc.expires_at || new Date() > exportDoc.expires_at)
      throw new Error("EXPIRED");
    if (exportDoc.status !== "completed") 
      throw new Error("NOT_READY");
    if (!fs.existsSync(exportDoc.file_path))
      throw new Error("FILE_MISSING");

    return exportDoc;
  }
  catch(err){
    throw err;
  }
}}

module.exports = ExportService;