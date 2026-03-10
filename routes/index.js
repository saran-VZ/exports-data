const express = require("express");
const router = express.Router();

const {
  createExport,
  getExportStatus,
  downloadExport,
  downloadLandingPage,
} = require("./exports.controller");

/**
 * @swagger
 * /export:
 *   post:
 *     summary: Create a new export job
 *     description: |
 *       Creates a new export job and creates a export record in the DB corresponding to the request.
 *       The export can be scheduled for a later time by providing the shedule mode in the env file.
 *       The export will be processed by the worker and the generated file can later be downloaded through the download endpoints.
 *     tags: [Exports]
 *     requestBody:
 *       required: true
 *       description: Export job creation payload
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateExportRequest'
 *     responses:
 *       200:
 *         description: Export job created successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Export queued successfully
 *               exportId: "687891234"
 *               jobId: "12345"
 *               scheduledFor: null
 *       400:
 *         description: Invalid request payload
 *       500:
 *         description: Failed to create export job
 */

router.post("/export", createExport);

/**
 * @swagger
 * /export/{id}:
 *   get:
 *     summary: Get export job status
 *     description: |
 *       Retrieves the  processing status and progress of the export job.
 *
 *       Status values:
 *       - queued: Job is waiting in the queue
 *       - processing: Worker is currently generating the export
 *       - completed: Export finished successfully
 *       - failed: Export process failed
 *       - expired: Download link has expired
 *     tags: [Exports]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Unique export job ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Export job status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ViewExportResponse'
 *       404:
 *         description: Export job not found
 *       500:
 *         description: Failed to fetch export status
 */

router.get("/export/:id", getExportStatus);

/**
 * @swagger
 * /download-page/{id}:
 *   get:
 *     summary: Get export download landing page
 *     description: |
 *       Returns a landing page containing the download link for the generated export zip file.
 *     tags: [Exports]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Export job identifier
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Download landing page returned successfully
 *         content:
 *           text/html:
 *             schema:
 *               format: html
 *               example: "<html><body><h1>Your export is ready!</h1><a href='/download/687891234'>Download here</a></body></html>"
 *       404:
 *         description: Export job not found
 *       410:
 *         description: Download link has expired
 */

router.get("/download-page/:id", downloadLandingPage);

/**
 * @swagger
 * /download/{id}:
 *   get:
 *     summary: Download exported file
 *     description: |
 *       Downloads the generated export file for the given export job.
 *       The download link remains valid only for a limited time [ ex: 1 hr] after the export job is completed.
 *     tags: [Exports]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Export job identifier
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Export file downloaded successfully
 *         content:
 *           application/zip:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Export job not found
 *       410:
 *         description: Download link has expired
 */

router.get("/download/:id", downloadExport);


module.exports = router;
