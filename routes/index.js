const express = require("express");
const router = express.Router();

const {
  getExportStatus,
  downloadExport,
  downloadLandingPage,
  createExport,
} = require("./exports.controller");


router.post("/export/:id", createExport);
router.get("/exportRecord/:id", getExportStatus);
router.get("/download-page/:id", downloadLandingPage);
router.get("/download/:id", downloadExport);


module.exports = router;
