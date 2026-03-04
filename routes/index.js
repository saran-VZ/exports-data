const express = require("express");
const router = express.Router();

const { createExport, getExportStatus, downloadExport } = require("./exports.controller");

router.post("/export", createExport);
router.get("/export/:id", getExportStatus);
router.get("/download/:id", downloadExport);


module.exports = router;