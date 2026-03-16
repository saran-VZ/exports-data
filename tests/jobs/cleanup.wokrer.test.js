const fs = require("fs");

jest.mock("fs");

jest.mock("../../utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const logger = require("./../../utils/logger");

const mockFindById = jest.fn();

jest.mock("./../../schemas/export-status", () => ({
  findById: mockFindById
}));

const mockProcessor = jest.fn();

jest.mock("bullmq", () => ({
  Worker: jest.fn().mockImplementation((queue, processor) => {
    mockProcessor.processor = processor;
    return {};
  })
}));

jest.mock("./../../config/redis", () => ({}));

const cleanupWorker = require("./../../jobs/cleanup.worker");
const exportStatus = require("./../../schemas/export-status");

describe("Cleanup Worker", () => {

  beforeEach(() => {
    jest.clearAllMocks();

  });

  test("should return if exportDoc not found", async () => {

    mockFindById.mockResolvedValue(null);

    const job = {
      data: {
        exportId: "123",
        userRoot: "/tmp/export"
      }
    };

    await mockProcessor.processor(job);

    expect(exportStatus.findById).toHaveBeenCalledWith("123");
    expect(fs.rmSync).not.toHaveBeenCalled();
  });

  test("should skip cleanup if not expired", async () => {

    const futureDate = new Date(Date.now() + 100000);

    mockFindById.mockResolvedValue({
      expires_at: futureDate
    });

    const job = {
      data: {
        exportId: "123",
        userRoot: "/tmp/export"
      }
    };

    await mockProcessor.processor(job);

    expect(logger.info).toHaveBeenCalledWith("Not expired yet");
    expect(fs.rmSync).not.toHaveBeenCalled();
  });

  test("should delete folder if expired", async () => {

    const pastDate = new Date(Date.now() - 100000);
    const mockSave = jest.fn();

    mockFindById.mockResolvedValue({
      expires_at: pastDate,
      status: "completed",
      save: mockSave
    });

    fs.existsSync.mockReturnValue(true);

    const job = {
      data: {
        exportId: "123",
        userRoot: "/tmp/export"
      }
    };

    await mockProcessor.processor(job);

    expect(fs.existsSync).toHaveBeenCalledWith("/tmp/export");
    expect(fs.rmSync).toHaveBeenCalledWith("/tmp/export", {
      recursive: true,
      force: true
    });
    
    expect(logger.info).toHaveBeenCalledWith("Deleted: %s", "/tmp/export");
    expect(mockSave).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith("Cleanup completed for: %s", "123");
  });

  test("should not delete if folder does not exist", async () => {

    const pastDate = new Date(Date.now() - 100000);
    const mockSave = jest.fn();

    mockFindById.mockResolvedValue({
      expires_at: pastDate,
      save: mockSave
    });

    fs.existsSync.mockReturnValue(false);

    const job = {
      data: {
        exportId: "123",
        userRoot: "/tmp/export"
      }
    };

    await mockProcessor.processor(job);

    expect(fs.rmSync).not.toHaveBeenCalled();
    expect(mockSave).toHaveBeenCalled();
  });

});
