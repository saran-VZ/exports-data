const fs = require("fs");

jest.mock("fs");

const mockCommit      = jest.fn();
const mockAddRow      = jest.fn(() => ({ commit: jest.fn() }));
const mockAddWorksheet = jest.fn(() => ({ addRow: mockAddRow }));

jest.mock("exceljs", () => ({
  stream: {
    xlsx: {
      WorkbookWriter: jest.fn(() => ({
        addWorksheet: mockAddWorksheet,
        commit:       mockCommit,
      })),
    },
  },
}));

jest.mock("./../../utils/logger", () => ({ info: jest.fn(), error: jest.fn() }));

const ExcelJS = require("exceljs");
const { ExcelSimpleService } = require("./../../jobs/excel.v2");

function makeFakeExportDoc(overrides = {}) {
  return { _id: "export123", ...overrides };
}

describe("ExcelSimpleService", () => {

  beforeEach(() => {
    jest.clearAllMocks();
    fs.existsSync.mockReturnValue(true);
    fs.mkdirSync.mockReturnValue(undefined);
  });


  test("should create output dir if it does not exist", () => {
    fs.existsSync.mockReturnValue(false);

    new ExcelSimpleService("/some/dir", makeFakeExportDoc(), "formdata_111");

    expect(fs.mkdirSync).toHaveBeenCalledWith("/some/dir", { recursive: true });
  });

  test("should not create dir if it already exists", () => {
    fs.existsSync.mockReturnValue(true);

    new ExcelSimpleService("/some/dir", makeFakeExportDoc(), "formdata_111");

    expect(fs.mkdirSync).not.toHaveBeenCalled();
  });


  test("should create new file on first writeBatch call", async () => {
    const service = new ExcelSimpleService("/out", makeFakeExportDoc(), "formdata_111");

    await service.writeBatch([{ a: 1, b: 2 }]);

    expect(ExcelJS.stream.xlsx.WorkbookWriter).toHaveBeenCalledTimes(1);
    expect(mockAddWorksheet).toHaveBeenCalledWith("part1");
  });

  test("should write each doc as a row", async () => {
    const service = new ExcelSimpleService("/out", makeFakeExportDoc(), "formdata_111");

    await service.writeBatch([
      { a: 1, b: 2 },
      { a: 3, b: 4 },
    ]);

    expect(mockAddRow).toHaveBeenCalledTimes(2);
  });

  test("should use Object.values to write row — no keys", async () => {
    const service = new ExcelSimpleService("/out", makeFakeExportDoc(), "formdata_111");

    await service.writeBatch([{ field1: "val1", field2: "val2" }]);

    expect(mockAddRow).toHaveBeenCalledWith(["val1", "val2"]);
  });

  test("should split into new part file when rowLimit is reached", async () => {
    const service = new ExcelSimpleService("/out", makeFakeExportDoc(), "formdata_111");
    service.rowLimit = 2;  

    await service.writeBatch([{ a: 1 }, { a: 2 }, { a: 3 }]);

    expect(mockCommit).toHaveBeenCalledTimes(1);
    expect(ExcelJS.stream.xlsx.WorkbookWriter).toHaveBeenCalledTimes(2);
    expect(service.partCounter).toBe(3);
  });

  test("should increment part file name correctly", async () => {
    const service = new ExcelSimpleService("/out", makeFakeExportDoc(), "formdata_111");
    service.rowLimit = 1;

    await service.writeBatch([{ a: 1 }, { a: 2 }]);

    const calls = ExcelJS.stream.xlsx.WorkbookWriter.mock.calls;
    expect(calls[0][0].filename).toMatch(/formdata_111_part1\.xlsx$/);
    expect(calls[1][0].filename).toMatch(/formdata_111_part2\.xlsx$/);
  });


  test("should commit workbook on finalize", async () => {
    const service = new ExcelSimpleService("/out", makeFakeExportDoc(), "formdata_111");

    await service.writeBatch([{ a: 1 }]);
    await service.finalize();

    expect(mockCommit).toHaveBeenCalledTimes(1);
  });

  test("should set workbook to null after finalize", async () => {
    const service = new ExcelSimpleService("/out", makeFakeExportDoc(), "formdata_111");

    await service.writeBatch([{ a: 1 }]);
    await service.finalize();

    expect(service.workbook).toBeNull();
  });

  test("should not commit if finalize called without any writes", async () => {
    const service = new ExcelSimpleService("/out", makeFakeExportDoc(), "formdata_111");

    await service.finalize();

    expect(mockCommit).not.toHaveBeenCalled();
  });

});