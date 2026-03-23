const fs = require("fs");

jest.mock("fs");
jest.mock("archiver");

const mockWriteBatch = jest.fn();
const mockFinalize   = jest.fn();

jest.mock("./../../jobs/excel.v2", () => ({
  ExcelSimpleService: jest.fn().mockImplementation(() => ({
    writeBatch: mockWriteBatch,
    finalize:   mockFinalize,
  })),
}));

jest.mock("./../../utils/mailer", () => ({
  sendDownloadLinkMail: jest.fn().mockResolvedValue(undefined),
  sendPasswordMail:     jest.fn().mockResolvedValue(undefined),
}));

jest.mock("./../../utils/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

const mockAppsFindOne = jest.fn();
const mockXFormsFind  = jest.fn();
const mockFormdataFind = jest.fn();

jest.mock("mongoose", () => ({
  connection: {
    collection: jest.fn().mockImplementation((name) => {
      if (name === "apps")    return { findOne: mockAppsFindOne };
      if (name === "x-forms") return { find: mockXFormsFind };
      return { find: mockFormdataFind };
    }),
  },
  Types: { ObjectId: jest.fn().mockImplementation((id) => id) },
}));

const archiver = require("archiver");
archiver.registerFormat = jest.fn();

const { runExportV2 } = require("./../../jobs/processor.v2");

function makeFakeExportDoc(overrides = {}) {
  return {
    _id:       "export123",
    user_name: "saran",
    email:     "saran@viewzenlabs.com",
    app_id:    "aaaaaaaaaaaaaaaaaaaaaaaa",
    ...overrides,
  };
}

function makeAppDoc() {
  return {
    _id: "aaaaaaaaaaaaaaaaaaaaaaaa",
    name: "app_1",
    subCategories: [
      {
        _id: "bbbbbbbbbbbbbbbbbbbbbbbb",
        name: "subFolder_A",
        subCategories: [],
      },
    ],
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
  fs.createWriteStream = jest.fn().mockReturnValue({
    on: jest.fn((event, cb) => { handlers[event] = cb; }),
  });
  archiver.create = jest.fn().mockReturnValue({
    directory: jest.fn(),
    pipe:      jest.fn(),
    on:        jest.fn(),
    finalize:  jest.fn().mockImplementation(() => {
      handlers["close"] && handlers["close"]();
    }),
  });
}


describe("processor.v2 - runExportV2", () => {

  beforeEach(() => {
    jest.clearAllMocks();

    fs.mkdirSync.mockReturnValue(undefined);
    fs.readdirSync.mockReturnValue([
      { name: "app_aaa", isDirectory: () => true },
      { name: "zips",    isDirectory: () => true },
    ]);

    mockAppsFindOne.mockResolvedValue(makeAppDoc());

    mockXFormsFind.mockReturnValue({
      toArray: jest.fn().mockResolvedValue([{ _id: "111111111111111111111111" }]),
    });

    mockFormdataFind.mockReturnValue(
      makeFakeCursor([{ field: "value" }])
    );

    mockWriteBatch.mockResolvedValue(undefined);
    mockFinalize.mockResolvedValue(undefined);

    setupArchiver();
  });

  test("should throw if app not found", async () => {
    mockAppsFindOne.mockResolvedValue(null);

    await expect(runExportV2(makeFakeExportDoc()))
      .rejects.toThrow("App not found for app_id: aaaaaaaaaaaaaaaaaaaaaaaa");
  });

  test("should throw if no collections resolved", async () => {
    mockXFormsFind.mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) });

    await expect(runExportV2(makeFakeExportDoc()))
      .rejects.toThrow("No collections resolved for the given app");
  });

  test("should throw if no records found in collections", async () => {
    mockFormdataFind.mockReturnValue(makeFakeCursor([]));

    await expect(runExportV2(makeFakeExportDoc()))
      .rejects.toThrow("No records found in the resolved collections");
  });

  test("should call writeBatch and finalize for each resolved collection", async () => {
    await runExportV2(makeFakeExportDoc());

    expect(mockWriteBatch).toHaveBeenCalled();
    expect(mockFinalize).toHaveBeenCalled();
  });

  test("should return zipPath, password, userRoot and collections", async () => {
    const result = await runExportV2(makeFakeExportDoc());

    expect(result).toMatchObject({
      zipPath:     expect.stringMatching(/export-\d+\.zip$/),
      password:    expect.any(String),
      userRoot:    expect.stringContaining("saran_export123"),
      collections: expect.arrayContaining(["formdata_111111111111111111111111"]),
    });
  });

  test("should throw if writeBatch fails", async () => {
    mockWriteBatch.mockRejectedValue(new Error("Disk write failed"));

    await expect(runExportV2(makeFakeExportDoc()))
      .rejects.toThrow("Disk write failed");
  });

});