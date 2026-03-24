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