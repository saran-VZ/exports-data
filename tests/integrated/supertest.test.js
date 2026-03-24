require("dotenv").config();

const request  = require("supertest");
const mongoose = require("mongoose");
const path     = require("path");
const fs       = require("fs");

// ── Register archiver format once ─────────────────────────────────────────────
const archiver     = require("archiver");
const zipEncrypted = require("archiver-zip-encrypted");
if (!archiver.isRegisteredFormat("zip-encrypted")) {
  archiver.registerFormat("zip-encrypted", zipEncrypted);
}

// ── Build express app without calling app.listen ──────────────────────────────
const express       = require("express");
const exportsRouter = require("../../routes/index");

const app = express();
app.use(express.json());
app.use("/", exportsRouter);

// ── Config ────────────────────────────────────────────────────────────────────

const APP_ID        = process.env.SUPERTEST_APP_ID;
const TEST_EMAIL    = process.env.SUPERTEST_EMAIL;
const USERNAME      = process.env.SUPERTEST_USERNAME;
const POLL_INTERVAL = 3000;
const POLL_TIMEOUT  = 5 * 60 * 1000;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function pollUntilCompleted(exportId) {
  const deadline = Date.now() + POLL_TIMEOUT;

  while (Date.now() < deadline) {
    const res = await request(app).get(`/exportRecord/${exportId}`);
    const { status } = res.body;

    console.log(`  [poll] exportId=${exportId} status=${status}`);

    if (status === "completed") return res.body;
    if (status === "failed")    throw new Error(`Export job failed. exportId=${exportId}`);

    await new Promise(r => setTimeout(r, POLL_INTERVAL));
  }

  throw new Error(`Export timed out after ${POLL_TIMEOUT / 1000}s`);
}

function findExcelFiles(dir) {
  let found = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      found = [...found, ...findExcelFiles(fullPath)];
    } else if (item.name.endsWith(".xlsx")) {
      found.push(fullPath);
    }
  }
  return found;
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("E2E — V2 export full flow", () => {

  let exportId;

  beforeAll(async () => {
    if (!APP_ID)     throw new Error("SUPERTEST_APP_ID is required in .env");
    if (!TEST_EMAIL) throw new Error("SUPERTEST_EMAIL is required in .env");
    if (!USERNAME)   throw new Error("SUPERTEST_USERNAME is required in .env");

    // connect mongoose before starting worker so worker has db connection
    await mongoose.connect(process.env.mongodb_url);

    // start worker AFTER mongoose is connected
    require("../../jobs/worker");
    require("../../jobs/cleanup.worker");
  }, 30000);

  afterAll(async () => {
    await mongoose.disconnect();
  });

  // ── 1. API call ────────────────────────────────────────────────────────────

  test("POST /export/:id returns 200 with exportId and jobId", async () => {
    const res = await request(app)
      .post(`/export/${APP_ID}`)
      .send({ user_name: USERNAME, email: TEST_EMAIL });

    console.log("  [api] response:", res.body);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.exportId).toBeDefined();
    expect(res.body.jobId).toBeDefined();
    expect(["Export queued successfully", "Export scheduled successfully"])
      .toContain(res.body.message);

    exportId = res.body.exportId;
  }, 15000);

  // ── 2. MongoDB doc created ─────────────────────────────────────────────────

  test("export document created in MongoDB with correct initial state", async () => {
    const doc = await mongoose.connection
      .collection("exportstatuses")
      .findOne({ _id: new mongoose.Types.ObjectId(exportId) });

    expect(doc).not.toBeNull();
    expect(["queued", "processing"]).toContain(doc.status);
    expect(doc.version).toBe("2.0");
    expect(doc.app_id).toBe(APP_ID);
    expect(doc.user_name).toBe(USERNAME);
    expect(doc.email).toBe(TEST_EMAIL);
    expect(doc.collections).toEqual([]);
    expect(doc.file_path).toBeNull();
    expect(doc.password).toBeNull();
    expect(doc.error_logs).toEqual([]);
  }, 15000);

  // ── 3. Job completes ───────────────────────────────────────────────────────

  test("export job completes successfully within 5 minutes", async () => {
    const result = await pollUntilCompleted(exportId);

    expect(result.status).toBe("completed");
    expect(result.progress).toBe(100);
  }, POLL_TIMEOUT + 30000);

  // ── 4. MongoDB doc fully updated ───────────────────────────────────────────

  test("export document fully updated in MongoDB after completion", async () => {
    const doc = await mongoose.connection
      .collection("exportstatuses")
      .findOne({ _id: new mongoose.Types.ObjectId(exportId) });

    expect(doc.status).toBe("completed");
    expect(doc.progress).toBe(100);
    expect(doc.file_path).not.toBeNull();
    expect(doc.password).not.toBeNull();
    expect(doc.started_at).not.toBeNull();
    expect(doc.completed_at).not.toBeNull();
    expect(doc.expires_at).not.toBeNull();
    expect(doc.version).toBe("2.0");
    expect(Array.isArray(doc.collections)).toBe(true);
    expect(doc.collections.length).toBeGreaterThan(0);
    expect(doc.collections.every(c => c.startsWith("formdata_"))).toBe(true);
    expect(doc.error_logs).toEqual([]);
  }, 15000);

  // ── 5. Zip file exists on disk ─────────────────────────────────────────────

  test("password-protected zip file exists on disk", async () => {
    const doc = await mongoose.connection
      .collection("exportstatuses")
      .findOne({ _id: new mongoose.Types.ObjectId(exportId) });

    expect(doc.file_path).not.toBeNull();
    expect(fs.existsSync(doc.file_path)).toBe(true);
    expect(doc.file_path).toMatch(/\.zip$/);
  }, 15000);

  // ── 6. Folder structure mirrors app hierarchy ──────────────────────────────

  test("export folder structure mirrors app hierarchy on disk", async () => {
    const doc = await mongoose.connection
      .collection("exportstatuses")
      .findOne({ _id: new mongoose.Types.ObjectId(exportId) });

    expect(doc.file_path).not.toBeNull();

    const userRoot  = path.dirname(path.dirname(doc.file_path));
    expect(fs.existsSync(userRoot)).toBe(true);

    // Find the app folder (it contains the exported data, not the zips folder)
    const items = fs.readdirSync(userRoot, { withFileTypes: true });
    const appFolders = items.filter(item => item.isDirectory() && item.name !== "zips");
    
    expect(appFolders.length).toBeGreaterThan(0);
    
    const appFolder = path.join(userRoot, appFolders[0].name);
    const contents = fs.readdirSync(appFolder);
    console.log("  [disk] app folder contents:", contents);
    expect(contents.length).toBeGreaterThan(0);
  }, 15000);

  // ── 7. Excel files exist ───────────────────────────────────────────────────

  test("excel files exist inside the correct hierarchy folders", async () => {
    const doc = await mongoose.connection
      .collection("exportstatuses")
      .findOne({ _id: new mongoose.Types.ObjectId(exportId) });

    const userRoot  = path.dirname(path.dirname(doc.file_path));
    
    // Find the app folder (it contains the exported data, not the zips folder)
    const items = fs.readdirSync(userRoot, { withFileTypes: true });
    const appFolders = items.filter(item => item.isDirectory() && item.name !== "zips");
    
    expect(appFolders.length).toBeGreaterThan(0);
    
    const appFolder = path.join(userRoot, appFolders[0].name);
    const excelFiles = findExcelFiles(appFolder);

    console.log(`  [disk] ${excelFiles.length} excel files found`);
    excelFiles.forEach(f => console.log("    →", path.relative(userRoot, f)));

    expect(excelFiles.length).toBeGreaterThan(0);
  }, 15000);

  // ── 8. Status endpoint ─────────────────────────────────────────────────────

  test("GET /exportRecord/:id returns completed status with all fields", async () => {
    const res = await request(app).get(`/exportRecord/${exportId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe("completed");
    expect(res.body.progress).toBe(100);
    expect(res.body.exportId).toBeDefined();
    expect(res.body.started_at).toBeDefined();
  }, 15000);

  // ── 9. Download landing page ───────────────────────────────────────────────

  test("GET /download-page/:id returns HTML with download button", async () => {
    const res = await request(app).get(`/download-page/${exportId}`);

    expect(res.status).toBe(200);
    expect(res.type).toMatch(/html/);
    expect(res.text).toContain("Your Export Is Ready");
    expect(res.text).toContain(`/download/${exportId}`);
  }, 15000);

  // ── 10. Direct file download ───────────────────────────────────────────────

  test("GET /download/:id streams zip file as binary", async () => {
    const res = await request(app)
      .get(`/download/${exportId}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks = [];
        res.on("data", chunk => chunks.push(chunk));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"])
      .toContain(`export-${exportId}.zip`);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toBe(0x50); // P
    expect(res.body[1]).toBe(0x4B); // K
  }, 30000);

  // ── 11. Invalid app id ─────────────────────────────────────────────────────

  test("POST /export/:id with non-existent app id returns error", async () => {
    const res = await request(app)
      .post(`/export/000000000000000000000000`)
      .send({ user_name: USERNAME, email: TEST_EMAIL });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  }, 15000);

  // ── 12. Missing email ──────────────────────────────────────────────────────

  test("POST /export/:id with missing email returns error", async () => {
    const res = await request(app)
      .post(`/export/${APP_ID}`)
      .send({ user_name: USERNAME });

    expect(res.status).not.toBe(200);
    expect(res.body.success).toBe(false);
  }, 15000);

  // ── 13. Invalid export id ──────────────────────────────────────────────────

  test("POST /export/:id with non-existent app id returns 404", async () => {
    const res = await request(app)
      .post(`/export/000000000000000000000000`)
      .send({ user_name: USERNAME, email: TEST_EMAIL });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  }, 15000);

});