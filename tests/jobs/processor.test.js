const fs = require("fs");

jest.mock("fs");
jest.mock("archiver");
jest.mock("archiver-zip-encrypted");

const mockWriteGroupedBatch = jest.fn();
const mockFinalizeAll = jest.fn();

jest.mock("./../../jobs/excel", () => ({
  ExcelGroupService: jest.fn().mockImplementation(() => ({
    writeGroupedBatch: mockWriteGroupedBatch,
    finalizeAll: mockFinalizeAll,
  })),
}));

const mockSendDownloadLinkMail = jest.fn();
const mockSendPasswordMail = jest.fn();

jest.mock("./../../utils/mailer", () => ({
  sendDownloadLinkMail: mockSendDownloadLinkMail,
  sendPasswordMail: mockSendPasswordMail,
}));

jest.mock("./../../utils/logger", () => ({ info: jest.fn(), error: jest.fn() }));

const mockFind = jest.fn();

jest.mock("mongoose", () => ({
  connection: {
    collection: jest.fn().mockReturnValue({ find: mockFind }),
  },
}));

const archiver = require("archiver");
archiver.registerFormat = jest.fn();

const { runExport } = require("./../../jobs/processor");

function makeFakeExportDoc(overrides = {}) {
  return {
    _id: "export123",
    user_name: "saran",
    email: "saran.st@viewzenlabs.com",
    collections: ["battery_data"],
    filters: {},
    attempts: 1,
    ...overrides,
  };
}

function makeFakeCursor(docs = []) {
  return {
    batchSize: jest.fn().mockReturnThis(),
    [Symbol.asyncIterator]() {
      let i = 0;
      return {
        next: async () =>
          i < docs.length
            ? { value: docs[i++], done: false }
            : { value: undefined, done: true },
      };
    },
  };
}

function setupArchiver() {
  const handlers = {};

  const fakeStream = {
    on: jest.fn((event, cb) => { handlers[event] = cb; }),
  };

  fs.createWriteStream = jest.fn().mockReturnValue(fakeStream);

  archiver.create = jest.fn().mockReturnValue({
    directory: jest.fn(),
    pipe:      jest.fn(),
    on:        jest.fn(),
    finalize:  jest.fn().mockImplementation(() => {
      handlers["close"] && handlers["close"]();     
    }),
  });
}


describe("processor - runExport", () => {

  beforeEach(() => {
    jest.clearAllMocks();

    fs.mkdirSync.mockReturnValue(undefined);
    fs.readdirSync.mockReturnValue([
      { name: "battery_data", isDirectory: () => true },
      { name: "zips",         isDirectory: () => true },
    ]);

    mockWriteGroupedBatch.mockResolvedValue(undefined);
    mockFinalizeAll.mockResolvedValue(undefined);
    mockSendDownloadLinkMail.mockResolvedValue(undefined);
    mockSendPasswordMail.mockResolvedValue(undefined);

    mockFind.mockReturnValue(
      makeFakeCursor([{ Identifier: "INV-001", value: 1 }])
    );

    setupArchiver();
  });

  test("should throw if no valid collections provided", async () => {
    await expect(runExport(makeFakeExportDoc({ collections: [] })))
      .rejects.toThrow("No collections selected for export");
  });

  test("should throw if no records found across all collections", async () => {
    mockFind.mockReturnValue(makeFakeCursor([]));

    await expect(runExport(makeFakeExportDoc()))
      .rejects.toThrow("No records found for the selected filters/collections");
  });

  test("should write batch and finalize for each collection", async () => {
    mockFind
      .mockReturnValueOnce(makeFakeCursor([{ Identifier: "A" }]))
      .mockReturnValueOnce(makeFakeCursor([{ Identifier: "B" }]));

    await runExport(makeFakeExportDoc({ collections: ["col1", "col2"] }));

    expect(mockWriteGroupedBatch).toHaveBeenCalledTimes(2);
    expect(mockFinalizeAll).toHaveBeenCalledTimes(1);
  });

  test("should not call finalizeAll if no records found", async () => {
    mockFind.mockReturnValue(makeFakeCursor([]));

    await expect(runExport(makeFakeExportDoc())).rejects.toThrow();
    expect(mockFinalizeAll).not.toHaveBeenCalled();
  });

  test("should send download link and password emails on success", async () => {
    await runExport(makeFakeExportDoc());

    expect(mockSendDownloadLinkMail).toHaveBeenCalledWith(
      "saran.st@viewzenlabs.com",
      expect.stringContaining("export123")
    );
    expect(mockSendPasswordMail).toHaveBeenCalledWith(
      "saran.st@viewzenlabs.com",
      expect.any(String)
    );
  });

  test("should return zipPath, password and userRoot", async () => {
    const result = await runExport(makeFakeExportDoc());

    expect(result).toMatchObject({
      zipPath:  expect.stringMatching(/export-\d+\.zip$/),
      password: expect.any(String),
      userRoot: expect.stringContaining("saran_export123"),
    });
  });

  test("should exclude zips folder from archive", async () => {
    await runExport(makeFakeExportDoc());

    const archive = archiver.create.mock.results[0].value;
    const dirCalls = archive.directory.mock.calls.map(([, name]) => name);
    expect(dirCalls).not.toContain("zips");
  });

  test("should throw if writeGroupedBatch fails", async () => {
    mockWriteGroupedBatch.mockRejectedValue(new Error("Disk write failed"));

    await expect(runExport(makeFakeExportDoc()))
      .rejects.toThrow("Disk write failed");
  });

  test("should throw if email sending fails", async () => {
    mockSendDownloadLinkMail.mockRejectedValue(new Error("SMTP error"));

    await expect(runExport(makeFakeExportDoc()))
      .rejects.toThrow("SMTP error");
  });

});