jest.mock("../../config/redis", () => ({
  on: jest.fn(),
  quit: jest.fn(),
}));

jest.mock("./../../schemas/export-status");
jest.mock("./../../jobs/queue", () => ({
  add: jest.fn(),
  close: jest.fn(),
}));

jest.mock("./../../utils/sheduler");
jest.mock("./../../utils/filter.validator");

const ExportService = require("./../../routes/exports.class");
const exportStatus = require("./../../schemas/export-status");
const exportQueue = require("./../../jobs/queue");
const { calculateDelay } = require("./../../utils/sheduler");
const { validateFilters } = require("./../../utils/filter.validator");


describe("ExportService", () => {
  let service;

  beforeEach(() => {
    service = new ExportService();
    jest.clearAllMocks();
  });

  describe("createExport", () => {

    test("should create export job successfully", async () => {
      const mockData = {
        user_name: "saran",
        email: "test@test.com",
        collections: ["data"],
        filters: { Model_Name: "ABC" },
        fileFormat: "xlsx"
      };

      const safeFilters = { Model_Name: "ABC" };

      const mockExportDoc = {
        _id: "123",
        save: jest.fn(),
      };

      const mockJob = { id: "job123" };

      validateFilters.mockReturnValue(safeFilters);
      exportStatus.create.mockResolvedValue(mockExportDoc);
      calculateDelay.mockReturnValue(0);
      exportQueue.add.mockResolvedValue(mockJob);

      const result = await service.createExport(mockData);

      expect(validateFilters).toHaveBeenCalledWith(mockData.filters);

      expect(exportStatus.create).toHaveBeenCalledWith({
        user_name: mockData.user_name,
        email: mockData.email,
        collections: mockData.collections,
        filters: safeFilters,
        file_format: "xlsx",
        status: "queued",
        progress: 0,
      });

      expect(exportQueue.add).toHaveBeenCalledWith(
        "exportJob",
        { exportId: mockExportDoc._id },
        expect.objectContaining({
          attempts: 3,
        })
      );

      expect(result).toEqual({
        exportDoc: mockExportDoc,
        job: mockJob,
        delay: 0,
      });
    });


    test("should schedule export if delay > 0", async () => {
      const mockData = {
        user_name: "saran",
        email: "test@test.com",
        collections: ["data"],
        filters: {},
      };

      const mockExportDoc = {
        _id: "123",
        save: jest.fn(),
      };

      validateFilters.mockReturnValue({});
      exportStatus.create.mockResolvedValue(mockExportDoc);
      calculateDelay.mockReturnValue(5000);
      exportQueue.add.mockResolvedValue({ id: "job123" });

      const result = await service.createExport(mockData);

      expect(mockExportDoc.save).toHaveBeenCalled();
      expect(result.delay).toBe(5000);
      expect(mockExportDoc.scheduled_for).toBeDefined();
    });


    test("should throw error if export creation fails", async () => {
      validateFilters.mockReturnValue({});
      exportStatus.create.mockRejectedValue(new Error("DB error"));

      await expect(service.createExport({ filters: {} }))
        .rejects
        .toThrow("DB error");
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