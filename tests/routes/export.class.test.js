jest.mock("./../../config/redis", () => ({
  on: jest.fn(),
  quit: jest.fn(),
}));

jest.mock("./../../schemas/export-status", () => ({
  create: jest.fn(),
  findById: jest.fn(),
}));
jest.mock("./../../jobs/queue", () => ({
  add: jest.fn(),
  close: jest.fn(),
}));

jest.mock("./../../utils/sheduler");

const mockAppsFindOne = jest.fn();

jest.mock("mongoose", () => ({
  connection: {
    collection: jest.fn().mockImplementation((name) => {
      if (name === "apps") return { findOne: mockAppsFindOne };
      return {};
    }),
  },
  Types: { ObjectId: jest.fn().mockImplementation((id) => id) },
  Schema: class Schema {
    static Types = { Mixed: "Mixed" };
    constructor() {}
  },
  model: jest.fn(() => ({})),
}));

const ExportService = require("./../../routes/exports.class");
const exportStatus = require("./../../schemas/export-status");
const exportQueue = require("./../../jobs/queue");
const { calculateDelay } = require("./../../utils/sheduler");


describe("ExportService", () => {
  let service;

  beforeEach(() => {
    service = new ExportService();
    jest.clearAllMocks();
    mockAppsFindOne.mockResolvedValue({ _id: "aaaaaaaaaaaaaaaaaaaaaaaa" });
  });

  describe("createExport", () => {

    test("should throw 400 if app_id is missing", async () => {
      const err = await service.createExport({ user_name: "saran", email: "s@s.com" })
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

      await service.createExport({
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

      await service.createExport({
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

      const result = await service.createExport({
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

      const result = await service.createExport({
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

      await expect(service.createExport({
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

      await expect(service.createExport({
        app_id:    "aaaaaaaaaaaaaaaaaaaaaaaa",
        user_name: "saran",
        email:     "saran@viewzenlabs.com",
      })).rejects.toThrow("Queue error");
    });

    test("should throw 404 if app not found", async () => {
      mockAppsFindOne.mockResolvedValue(null);

      await expect(service.createExport({
        app_id:    "aaaaaaaaaaaaaaaaaaaaaaaa",
        user_name: "saran",
        email:     "saran@viewzenlabs.com",
      })).rejects.toThrow("App not found for app_id: aaaaaaaaaaaaaaaaaaaaaaaa");
    });

  });

  describe("getExportStatus", () => {

    test("should return export status", async () => {
      const mockDoc = { _id: "123", status: "completed" };

      exportStatus.findById.mockResolvedValue(mockDoc);

      const result = await service.getExportStatus("123");

      expect(exportStatus.findById).toHaveBeenCalledWith("123");
      expect(result).toEqual(mockDoc);
    });


    test("should throw error if find fails", async () => {
      exportStatus.findById.mockRejectedValue(new Error("DB error"));

      await expect(service.getExportStatus("123"))
        .rejects
        .toThrow("DB error");
    });

    test("should throw error if export job not found", async () => {
      exportStatus.findById.mockResolvedValue(null);

      await expect(service.getExportStatus("123"))
        .rejects
        .toThrow("Export job not found");
    });

  });


  describe("downloadExport", () => {

    test("should return export document if valid", async () => {
      const mockDoc = {
        _id: "123",
        expires_at: new Date(Date.now() + 100000),
      };

      exportStatus.findById.mockResolvedValue(mockDoc);

      const result = await service.downloadExport("123");

      expect(result).toEqual(mockDoc);
    });


    test("should throw NOT_FOUND if export does not exist", async () => {
      exportStatus.findById.mockResolvedValue(null);

      await expect(service.downloadExport("123"))
        .rejects
        .toThrow("NOT_FOUND");
    });


    test("should throw EXPIRED if file expired", async () => {
      const mockDoc = {
        _id: "123",
        expires_at: new Date(Date.now() - 1000),
      };

      exportStatus.findById.mockResolvedValue(mockDoc);

      await expect(service.downloadExport("123"))
        .rejects
        .toThrow("EXPIRED");
    });

  });

});
