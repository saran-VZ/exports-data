const exportStatus = require("./../schemas/export-status");
const exportQueue = require("./../jobs/queue");
const { calculateDelay } = require("./../utils/sheduler");

class ExportService {

  async getExportStatus(id) {                                     // to view DB record of export job with id                       
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

  async downloadExport(id) {                                     // to download the exported file using donwload link
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