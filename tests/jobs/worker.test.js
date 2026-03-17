const mockFindById = jest.fn();
const mockRunExport = jest.fn();
const mockCleanupAdd = jest.fn();
const mockProcessor = {};

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

jest.mock("./../../utils/logger", () => ({
  info:  jest.fn(),
  error: jest.fn(),
}));

require("./../../jobs/worker");

const exportStatus = require("./../../schemas/export-status");

function makeFakeDoc(overrides = {}) {
  return {
    _id:       "export123",
    email:     "saran.st@viewzenlabs.com",
    status:    "pending",
    attempts:  0,
    progress:  0,
    save:      jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function makeFakeJob(exportId = "export123") {
  return { id: "job-001", data: { exportId } };
}

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

  test("should call runExport with the exportDoc", async () => {
    const doc = makeFakeDoc();
    mockFindById.mockResolvedValue(doc);
    mockRunExport.mockResolvedValue({ zipPath: "/out.zip", password: "pass", userRoot: "/root" });

    await mockProcessor.processor(makeFakeJob());

    expect(mockRunExport).toHaveBeenCalledWith(doc);
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

  test("should queue cleanup job with correct payload and delay", async () => {
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

  test("should set status to failed and save error if runExport throws", async () => {
    const doc = makeFakeDoc();
    mockFindById.mockResolvedValue(doc);
    mockRunExport.mockRejectedValue(new Error("MongoDB cursor timeout"));

    await expect(mockProcessor.processor(makeFakeJob()))
      .rejects.toThrow("MongoDB cursor timeout");

    expect(doc.status).toBe("failed");
    expect(doc.error_message).toBe("MongoDB cursor timeout");
    expect(doc.save).toHaveBeenCalled();
  });

  test("should not queue cleanup job if runExport fails", async () => {
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