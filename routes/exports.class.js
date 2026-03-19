const exportStatus = require("./../schemas/export-status");
const exportQueue = require("./../jobs/queue");
const { calculateDelay } = require("./../utils/sheduler");
const { validateFilters } = require("./../utils/filter.validator");

class ExportService {
  async createExport(data) {
    try{
    const safeFilters = validateFilters(data.filters);

    const exportDoc = await exportStatus.create({
      user_name: data.user_name,
      email: data.email,
      collections: data.collections,
      filters: safeFilters,
      file_format:  "xlsx",
      status: "queued",
      progress: 0,
    });

    const delay = calculateDelay();     

    const job = await exportQueue.add(                  //job pushed into exportQueue with delay
      "exportJob",
      { exportId: exportDoc._id },
      {
        delay,
        attempts: 3,
        backoff: {                     
          type: "exponential",                         //exponential time delay for retries of unsuccessful jobs [max retry = 3]
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: false,
        stalledInterval: 30000, 
      }
    );
    
    if (delay > 0) {
      exportDoc.scheduled_for = new Date(Date.now() + delay);
    }
    exportDoc.bull_job_id = job.id;
    await exportDoc.save();

    return { exportDoc, job, delay };
  }catch(err){
    throw err;
  }
  } 

  async getExportStatus(id) {                           
    try{
      const exportDoc = await exportStatus.findById(id);
      if (!exportDoc) {
         throw new Error("Export job not found");
      }
      return exportDoc;
      
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

    return exportDoc;
  }
  catch(err){
    throw err;
  }
}}


module.exports = ExportService;