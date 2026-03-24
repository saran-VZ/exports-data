const express = require("express");
const router = express.Router();

const {
  getExportStatus,
  downloadExport,
  downloadLandingPage,
  createExportV2,
} = require("./exports.controller");


router.post("/export/:id", createExportV2);
router.get("/exportRecord/:id", getExportStatus);
router.get("/download-page/:id", downloadLandingPage);
router.get("/download/:id", downloadExport);


module.exports = router;
