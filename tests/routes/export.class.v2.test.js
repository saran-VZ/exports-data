jest.mock("../../config/redis", () => ({
  on:   jest.fn(),
  quit: jest.fn(),
}));

jest.mock("./../../schemas/export-status");
jest.mock("./../../jobs/queue", () => ({
  add:   jest.fn(),
  close: jest.fn(),
}));
jest.mock("./../../utils/sheduler");

const ExportServiceV2  = require("./../../routes/exports.class.v2");
const exportStatus     = require("./../../schemas/export-status");
const exportQueue      = require("./../../jobs/queue");
const { calculateDelay } = require("./../../utils/sheduler");

describe("ExportServiceV2", () => {

  let service;

  beforeEach(() => {
    service = new ExportServiceV2();
    jest.clearAllMocks();
  });

  // ── createExportV2 ──────────────────────────────────────────────────────────

  test("should throw 400 if app_id is missing", async () => {
    const err = await service.createExportV2({ user_name: "saran", email: "s@s.com" })
      .catch(e => e);

    expect(err.message).toBe("app_id is required");
    expect(err.status).toBe(400);
  });

  test("should create export doc with correct fields", async () => {
    const mockDoc = { _id: "export123", save: jest.fn() };
    const mockJob = { id: "job001" };

    exportStatus.create.mockResolvedValue(mockDoc);
    calculateDelay.mockReturnValue(0);
    exportQueue.add.mockResolvedValue(mockJob);

    await service.createExportV2({
      app_id:    "aaaaaaaaaaaaaaaaaaaaaaaa",
      user_name: "saran",
      email:     "saran@viewzenlabs.com",
    });

    expect(exportStatus.create).toHaveBeenCalledWith({
      user_name:   "saran",
      email:       "saran@viewzenlabs.com",
      app_id:      "aaaaaaaaaaaaaaaaaaaaaaaa",
      collections: [],
      filters:     {},
      file_format: "xlsx",
      status:      "queued",
      progress:    0,
      version:     "2.0",
    });
  });

  test("should push job to exportQueue with correct payload", async () => {
    const mockDoc = { _id: "export123", save: jest.fn() };
    const mockJob = { id: "job001" };

    exportStatus.create.mockResolvedValue(mockDoc);
    calculateDelay.mockReturnValue(0);
    exportQueue.add.mockResolvedValue(mockJob);

    await service.createExportV2({
      app_id:    "aaaaaaaaaaaaaaaaaaaaaaaa",
      user_name: "saran",
      email:     "saran@viewzenlabs.com",
    });

    expect(exportQueue.add).toHaveBeenCalledWith(
      "exportJob",
      { exportId: "export123" },
      expect.objectContaining({ attempts: 3 })
    );
  });

  test("should return exportDoc, job and delay", async () => {
    const mockDoc = { _id: "export123", save: jest.fn() };
    const mockJob = { id: "job001" };

    exportStatus.create.mockResolvedValue(mockDoc);
    calculateDelay.mockReturnValue(0);
    exportQueue.add.mockResolvedValue(mockJob);

    const result = await service.createExportV2({
      app_id:    "aaaaaaaaaaaaaaaaaaaaaaaa",
      user_name: "saran",
      email:     "saran@viewzenlabs.com",
    });

    expect(result).toEqual({
      exportDoc: mockDoc,
      job:       mockJob,
      delay:     0,
    });
  });

  test("should set scheduled_for and save if delay > 0", async () => {
    const mockDoc = { _id: "export123", save: jest.fn() };

    exportStatus.create.mockResolvedValue(mockDoc);
    calculateDelay.mockReturnValue(5000);
    exportQueue.add.mockResolvedValue({ id: "job001" });

    const result = await service.createExportV2({
      app_id:    "aaaaaaaaaaaaaaaaaaaaaaaa",
      user_name: "saran",
      email:     "saran@viewzenlabs.com",
    });

    expect(mockDoc.scheduled_for).toBeDefined();
    expect(mockDoc.save).toHaveBeenCalled();
    expect(result.delay).toBe(5000);
  });

  test("should throw if exportStatus.create fails", async () => {
    exportStatus.create.mockRejectedValue(new Error("DB error"));
    calculateDelay.mockReturnValue(0);

    await expect(service.createExportV2({
      app_id:    "aaaaaaaaaaaaaaaaaaaaaaaa",
      user_name: "saran",
      email:     "saran@viewzenlabs.com",
    })).rejects.toThrow("DB error");
  });

  test("should throw if exportQueue.add fails", async () => {
    const mockDoc = { _id: "export123", save: jest.fn() };

    exportStatus.create.mockResolvedValue(mockDoc);
    calculateDelay.mockReturnValue(0);
    exportQueue.add.mockRejectedValue(new Error("Queue error"));

    await expect(service.createExportV2({
      app_id:    "aaaaaaaaaaaaaaaaaaaaaaaa",
      user_name: "saran",
      email:     "saran@viewzenlabs.com",
    })).rejects.toThrow("Queue error");
  });

});