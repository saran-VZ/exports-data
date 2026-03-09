const fs = require("fs");
const path = require("path");

jest.mock("fs");

jest.mock("exceljs", () => {
  const worksheetMock = {
    addRow: jest.fn(() => ({
      commit: jest.fn()
    }))
  };

  const workbookMock = {
    addWorksheet: jest.fn(() => worksheetMock),
    commit: jest.fn()
  };

  return {
    stream: {
      xlsx: {
        WorkbookWriter: jest.fn(() => workbookMock)
      }
    }
  };
});

const ExcelJS = require("exceljs");
const { ExcelGroupService } = require("../../jobs/excel");

describe("ExcelGroupService", () => {

  beforeEach(() => {
    jest.clearAllMocks();

    fs.existsSync.mockReturnValue(true);
    fs.mkdirSync.mockReturnValue();

    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  test("should create service for identifier", () => {

    const groupService = new ExcelGroupService("./exports", { _id: "123" });

    const service = groupService.getService("A");

    expect(service).toBeDefined();
    expect(groupService.services.has("A")).toBe(true);
  });

  test("should group batch by identifier", async () => {

    const groupService = new ExcelGroupService("./exports", { _id: "123" });

    const batch = [
      { Identifier: "A", name: "user1" },
      { Identifier: "A", name: "user2" },
      { Identifier: "B", name: "user3" }
    ];

    await groupService.writeGroupedBatch(batch);

    expect(groupService.services.size).toBe(2);
  });

  test("should write rows to worksheet", async () => {

    const groupService = new ExcelGroupService("./exports", { _id: "123" });

    const batch = [
      { Identifier: "A", name: "user1" },
      { Identifier: "A", name: "user2" }
    ];

    await groupService.writeGroupedBatch(batch);

    const workbookInstance =
      ExcelJS.stream.xlsx.WorkbookWriter.mock.results[0].value;

    const worksheetInstance = workbookInstance.addWorksheet.mock.results[0].value;

    expect(worksheetInstance.addRow).toHaveBeenCalledTimes(2);
  });

  test("should finalize all services", async () => {

    const groupService = new ExcelGroupService("./exports", { _id: "123" });

    const batch = [
      { Identifier: "A", name: "user1" }
    ];

    await groupService.writeGroupedBatch(batch);

    await groupService.finalizeAll();

    const workbookInstance =
      ExcelJS.stream.xlsx.WorkbookWriter.mock.results[0].value;

    expect(workbookInstance.commit).toHaveBeenCalled();
  });

});