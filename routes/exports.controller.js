const ExportService = require("./exports.class");

exports.createExport = async (req, res) => {
  try {
    const exportService = new ExportService();

    const { exportDoc, job, delay } = await exportService.createExport(req.body);

    return res.status(200).json({
      success: true,
      message:
        delay > 0
          ? "Export scheduled successfully"
          : "Export queued successfully",
      exportId: exportDoc._id,
      jobId: job.id,
      scheduledFor: exportDoc.scheduled_for
        ? exportDoc.scheduled_for.toLocaleString("en-IN", {
            hour12: false,
          })
        : null,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create export job",
      error: error.message,
    });
  }
};

exports.getExportStatus = async (req, res) => {
  try {
    const exportService = new ExportService();

    const exportDoc = await exportService.getExportStatus(req.params.id);

    if (!exportDoc) {
      return res.status(404).json({
        success: false,
        message: "Export job not found",
      });
    }

    return res.status(200).json({
      success: true,
      exportId: exportDoc._id,
      status: exportDoc.status,
      progress: exportDoc.progress,
      scheduled_for: exportDoc.scheduled_for
        ? exportDoc.scheduled_for.toLocaleString("en-IN", {
            hour12: false,
          })
        : null,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch export status",
      error: error.message,
    });
  }
};

exports.downloadExport = async (req, res) => {
  try {
    const exportService = new ExportService();

    const exportDoc = await exportService.downloadExport( req.params.id);

    return res.download(
      exportDoc.file_path,
      `export-${exportDoc._id}.zip`
    );
  } catch (err) {
    if (err.message === "NOT_FOUND")
      return res.status(404).send("Export not found");

    if (err.message === "NOT_READY")
      return res.status(400).send("File not ready");

    if (err.message === "EXPIRED")
      return res.status(410).send("File expired");

    if (err.message === "FILE_MISSING")
      return res.status(404).send("File not found on server");

    return res.status(500).send("Download failed");
  }
};