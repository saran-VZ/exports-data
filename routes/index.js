const express = require("express");
const router = express.Router();

const {
  createExport,
  getExportStatus,
  downloadExport,
  downloadLandingPage,
  createExportV2,
} = require("./exports.controller");


router.post("/exportV1", createExport);
router.post("/export/:id", createExportV2);
router.get("/exportRecord/:id", getExportStatus);
router.get("/download-page/:id", downloadLandingPage);
router.get("/download/:id", downloadExport);


module.exports = router;
