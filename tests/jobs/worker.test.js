const mockFindById  = jest.fn();
const mockRunExport   = jest.fn();
const mockRunExportV2 = jest.fn();
const mockCleanupAdd  = jest.fn();
const mockProcessor   = {};

jest.mock("bullmq", () => ({
  Worker: jest.fn().mockImplementation((queue, processor, options) => {
    mockProcessor.processor = processor;
    return { on: jest.fn() };
  }),
}));

jest.mock("./../../config/redis", () => ({}));

jest.mock("./../../schemas/export-status", () => ({
  findById: mockFindById,
}));

jest.mock("./../../jobs/cleanup.queue", () => ({
  add: mockCleanupAdd,
}));

jest.mock("./../../jobs/processor", () => ({
  runExport: mockRunExport,
}));

jest.mock("./../../jobs/processor.v2", () => ({
  runExportV2: mockRunExportV2,
}));

jest.mock("./../../utils/logger", () => ({
  info:  jest.fn(),
  error: jest.fn(),
}));

require("./../../jobs/worker");

const exportStatus = require("./../../schemas/export-status");



function makeFakeDoc(overrides = {}) {
  return {
    _id:           "export123",
    email:         "saran.st@viewzenlabs.com",
    status:        "pending",
    attempts:      0,
    progress:      0,
    error_logs:   [],
    version:       "1.0",
    error_message: null,
    save:          jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function makeFakeJob(exportId = "export123") {
  return { id: "job-001", data: { exportId } };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Export Worker", () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should return early if exportDoc not found", async () => {
    mockFindById.mockResolvedValue(null);

    await mockProcessor.processor(makeFakeJob());

    expect(exportStatus.findById).toHaveBeenCalledWith("export123");
    expect(mockRunExport).not.toHaveBeenCalled();
  });

  test("should set status to processing and increment attempts before export", async () => {
    const doc = makeFakeDoc();
    mockFindById.mockResolvedValue(doc);
    mockRunExport.mockResolvedValue({ zipPath: "/out.zip", password: "pass", userRoot: "/root" });

    await mockProcessor.processor(makeFakeJob());

    expect(doc.attempts).toBe(1);
    expect(doc.status).toBe("completed");
    expect(doc.save).toHaveBeenCalled();
  });

  test("should route to V1 processor when version is 1.0", async () => {
    const doc = makeFakeDoc({ version: "1.0" });
    mockFindById.mockResolvedValue(doc);
    mockRunExport.mockResolvedValue({ zipPath: "/out.zip", password: "pass", userRoot: "/root" });

    await mockProcessor.processor(makeFakeJob());

    expect(mockRunExport).toHaveBeenCalledWith(doc);
    expect(mockRunExportV2).not.toHaveBeenCalled();
  });

  test("should route to V2 processor when version is 2.0", async () => {
    const doc = makeFakeDoc({ version: "2.0" });
    mockFindById.mockResolvedValue(doc);
    mockRunExportV2.mockResolvedValue({ zipPath: "/out.zip", password: "pass", userRoot: "/root", collections: [] });

    await mockProcessor.processor(makeFakeJob());

    expect(mockRunExportV2).toHaveBeenCalledWith(doc);
    expect(mockRunExport).not.toHaveBeenCalled();
  });

  test("should set status completed and update all fields after success", async () => {
    const doc = makeFakeDoc();
    mockFindById.mockResolvedValue(doc);
    mockRunExport.mockResolvedValue({ zipPath: "/out.zip", password: "secret", userRoot: "/root" });

    await mockProcessor.processor(makeFakeJob());

    expect(doc.status).toBe("completed");
    expect(doc.progress).toBe(100);
    expect(doc.file_path).toBe("/out.zip");
    expect(doc.password).toBe("secret");
    expect(doc.completed_at).toBeInstanceOf(Date);
    expect(doc.expires_at).toBeInstanceOf(Date);
  });

  test("should queue cleanup job after success", async () => {
    const doc = makeFakeDoc();
    mockFindById.mockResolvedValue(doc);
    mockRunExport.mockResolvedValue({ zipPath: "/out.zip", password: "pass", userRoot: "/root" });

    await mockProcessor.processor(makeFakeJob());

    expect(mockCleanupAdd).toHaveBeenCalledWith(
      "deleteExportFiles",
      { userRoot: "/root", exportId: "export123" },
      { delay: 5 * 60 * 1000, removeOnComplete: true }
    );
  });

 test("should set status failed and save error if export throws", async () => {
  const doc = makeFakeDoc();
  mockFindById.mockResolvedValue(doc);
  mockRunExport.mockRejectedValue(new Error("MongoDB cursor timeout"));

  await expect(mockProcessor.processor(makeFakeJob()))
    .rejects.toThrow("MongoDB cursor timeout");

  expect(doc.status).toBe("failed");
  expect(doc.error_logs[0].message).toBe("MongoDB cursor timeout");
  expect(doc.error_logs[0].attempt).toBe(1);
  expect(doc.save).toHaveBeenCalled();
});

  test("should not queue cleanup job if export fails", async () => {
    const doc = makeFakeDoc();
    mockFindById.mockResolvedValue(doc);
    mockRunExport.mockRejectedValue(new Error("Crash"));

    await expect(mockProcessor.processor(makeFakeJob())).rejects.toThrow();

    expect(mockCleanupAdd).not.toHaveBeenCalled();
  });

  test("should rethrow error so BullMQ can handle retries", async () => {
    const doc = makeFakeDoc();
    mockFindById.mockResolvedValue(doc);
    mockRunExport.mockRejectedValue(new Error("Unexpected crash"));

    await expect(mockProcessor.processor(makeFakeJob()))
      .rejects.toThrow("Unexpected crash");
  });

});