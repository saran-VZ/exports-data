const ExportService = require("./exports.class");
const fs = require("fs");

function renderDownloadPage({ title, message, buttonHref, buttonLabel = "Download File" }) {
  const buttonHtml = buttonHref
    ? `<a href="${buttonHref}" style="display:inline-block;padding:12px 24px;background:#00c3ff;color:#0b1f3a;text-decoration:none;font-weight:bold;border-radius:8px;font-size:15px;">${buttonLabel}</a>`
    : "";

  return `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${title}</title>
    </head>
    <body style="margin:0;padding:0;background:#0b1f3a;font-family:Arial,sans-serif;">
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;">
        <div style="max-width:620px;width:100%;background:#102b52;padding:28px;border-radius:12px;text-align:center;box-shadow:0 8px 20px rgba(0,0,0,0.28);">
          <h1 style="color:#FFD700;margin:0 0 12px;font-size:24px;">${title}</h1>
          <p style="color:#FFD700;margin:0 0 22px;font-size:15px;line-height:1.5;">${message}</p>
          ${buttonHtml}
        </div>
      </div>
    </body>
  </html>`;
}

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
      started_at: exportDoc.started_at,
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

exports.downloadLandingPage = async (req, res) => {
  try {
    const exportService = new ExportService();
    const exportDoc = await exportService.downloadExport(req.params.id);
    const filePath = exportDoc.file_path;

    if (!fs.existsSync(filePath)) {
      throw new Error("FILE_MISSING");
    }

    const directDownloadUrl = `/download/${exportDoc._id}`;
    return res
      .status(200)
      .type("html")
      .send(
        renderDownloadPage({
          title: "Your Export Is Ready",
          message:
            "Click the button below to start downloading your file... If your browser blocks the download, please press 'KEEP' or 'ALLOW' in the pop-up to proceed...",
          buttonHref: directDownloadUrl,
        })
      );
  } catch (err) {
    if (err.message === "NOT_FOUND") {
      return res.status(404).type("html").send(
        renderDownloadPage({
          title: "Export Not Found",
          message: "This export does not exist or the link is invalid.",
          buttonHref: null,
        })
      );
    }

    if (err.message === "NOT_READY") {
      return res.status(400).type("html").send(
        renderDownloadPage({
          title: "Export Still Processing",
          message: "The file is not ready yet. Please retry after a few minutes.",
          buttonHref: null,
        })
      );
    }

    if (err.message === "EXPIRED") {
      return res.status(410).type("html").send(
        renderDownloadPage({
          title: "Link Expired",
          message: "This download link has expired. Please create a new export request.",
          buttonHref: null,
        })
      );
    }

    if (err.message === "FILE_MISSING") {
      return res.status(404).type("html").send(
        renderDownloadPage({
          title: "File Not Found",
          message: "The export record exists, but the file is missing on the server.",
          buttonHref: null,
        })
      );
    }

    return res.status(500).type("html").send(
      renderDownloadPage({
        title: "Download Unavailable",
        message: "Something went wrong while loading this page. Please try again.",
        buttonHref: null,
      })
    );
  }
};

exports.downloadExport = async (req, res) => {
  try {
    const exportService = new ExportService();

    const exportDoc = await exportService.downloadExport(req.params.id);
    const filePath = exportDoc.file_path;
    const downloadName = `export-${exportDoc._id}.zip`;

    if (!fs.existsSync(filePath)) {
      throw new Error("FILE_MISSING");
    }

    // Help browsers/webviews handle the response as a real download.
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");

    res.download(
      filePath,
      downloadName,
      (err) => {
        if (err) {
          const isClientAbort =
            err.code === "ECONNABORTED" ||
            err.code === "ECONNRESET" ||
            err.message === "Request aborted";

          if (isClientAbort) {
            console.warn(
              `Download aborted by client for export ${exportDoc._id}: ${err.code || err.message}`
            );
            return;
          }

          console.error("Download error:", err);
          if (!res.headersSent) {
            res.status(500).send("Download failed");
          }
        }
      }
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
