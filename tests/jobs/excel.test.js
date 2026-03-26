const fs = require("fs");

jest.mock("fs");

const mockCommit = jest.fn();
let addRowSnapshots = [];
const mockAddRow = jest.fn((row) => {
  const snapshot = Array.isArray(row) ? [...row] : row;
  addRowSnapshots.push(snapshot);
  return { commit: jest.fn() };
});
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
const { ExcelSimpleService } = require("./../../jobs/excel");

function makeFakeExportDoc(overrides = {}) {
  return { _id: "export123", ...overrides };
}

describe("ExcelSimpleService", () => {

  beforeEach(() => {
    jest.clearAllMocks();
    addRowSnapshots = [];
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

    expect(mockAddRow).toHaveBeenCalledTimes(3);              // header + 2 rows
  });

  test("should write header row and then values in header order", async () => {
    const service = new ExcelSimpleService("/out", makeFakeExportDoc(), "formdata_111");

    await service.writeBatch([{ field1: "val1", field2: "val2" }]);

    expect(addRowSnapshots[0]).toEqual(["field1", "field2"]);
    expect(addRowSnapshots[1]).toEqual(["val1", "val2"]);
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
    expect(calls[0][0].filename).toMatch(/formdata_111_part1\.xlsx$/);          //verifies excel file names
    expect(calls[1][0].filename).toMatch(/formdata_111_part2\.xlsx$/);
  });

  test("should start a new file when a new column appears later", async () => {
    const service = new ExcelSimpleService("/out", makeFakeExportDoc(), "formdata_111");

    await service.writeBatch([{ a: 1 }, { a: 2, b: 3 }]);

    expect(ExcelJS.stream.xlsx.WorkbookWriter).toHaveBeenCalledTimes(2);
    expect(addRowSnapshots[0]).toEqual(["a"]);
    expect(addRowSnapshots[1]).toEqual([1]);
    expect(addRowSnapshots[2]).toEqual(["a", "b"]);
    expect(addRowSnapshots[3]).toEqual([2, 3]);
  });

  test("should commit workbook on finalize", async () => {
    const service = new ExcelSimpleService("/out", makeFakeExportDoc(), "formdata_111");

    await service.writeBatch([{ a: 1 }]);
    await service.finalize();

    expect(mockCommit).toHaveBeenCalledTimes(1);           //to commit the excel workbook when finalize is called
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
