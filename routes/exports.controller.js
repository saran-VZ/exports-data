const express = require("express");
const router = express.Router();
const exportStatus = require('./../schemas/export-status')

const { runExport } = require("./../jobs/worker");

router.post("/export", async (req, res) => {
  try {
  
    const result = await runExport();
    
    const exportData = new exportStatus({...req.body,password:result.password,status:"completed",filePath:result.zipPath})
    await exportData.save();

    res.json({
      message: "Export completed",
      ...result,
      exportData
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Export failed" });
  }
});

module.exports = router;