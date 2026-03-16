const fs = require("fs");

jest.mock("fs");

jest.mock("exceljs", () => {
  const worksheetMock = {
    addRow: jest.fn(() => ({ commit: jest.fn() })),
  };

  const workbookMock = {
    addWorksheet: jest.fn(() => worksheetMock),
    commit: jest.fn(),
  };

  return {
    stream: {
      xlsx: {
        WorkbookWriter: jest.fn(() => workbookMock),
      },
    },
  };
});

jest.mock("./../../utils/logger", () => ({ info: jest.fn(), error: jest.fn() }));

const ExcelJS = require("exceljs");
const { ExcelGroupService } = require("./../../jobs/excel");

describe("ExcelGroupService", () => {

  beforeEach(() => {
    jest.clearAllMocks();
    fs.existsSync.mockReturnValue(true);
    fs.mkdirSync.mockReturnValue(undefined);
  });

  test("should create service for new collectionName + identifier", () => {
    const groupService = new ExcelGroupService("./exports", { _id: "123" });

    const service = groupService.getService("battery_data", "INV-001");

    expect(service).toBeDefined();
    expect(groupService.services.has("battery_data::INV-001")).toBe(true);
  });

  test("should reuse existing service for same collectionName + identifier", () => {
    const groupService = new ExcelGroupService("./exports", { _id: "123" });

    const service1 = groupService.getService("battery_data", "INV-001");
    const service2 = groupService.getService("battery_data", "INV-001");

    expect(service1).toBe(service2);             
    expect(groupService.services.size).toBe(1);  
  });

  test("should group batch by identifier and create separate services", async () => {
    const groupService = new ExcelGroupService("./exports", { _id: "123" });

    const batch = [
      { Identifier: "A", name: "user1" },
      { Identifier: "A", name: "user2" },
      { Identifier: "B", name: "user3" },
    ];

    await groupService.writeGroupedBatch("battery_data", batch);

    expect(groupService.services.size).toBe(2);
    expect(groupService.services.has("battery_data::A")).toBe(true);
    expect(groupService.services.has("battery_data::B")).toBe(true);
  });

  test("should write rows to worksheet", async () => {
    const groupService = new ExcelGroupService("./exports", { _id: "123" });

    const batch = [
      { Identifier: "A", name: "user1" },
      { Identifier: "A", name: "user2" },
    ];

    await groupService.writeGroupedBatch("battery_data", batch);

    const workbookInstance = ExcelJS.stream.xlsx.WorkbookWriter.mock.results[0].value;
    const worksheetInstance = workbookInstance.addWorksheet.mock.results[0].value;

    expect(worksheetInstance.addRow).toHaveBeenCalledTimes(2);
  });

  test("should fallback to UNKNOWN if identifier is missing", async () => {
    const groupService = new ExcelGroupService("./exports", { _id: "123" });

    const batch = [{ name: "user1" }];   

    await groupService.writeGroupedBatch("battery_data", batch);

    expect(groupService.services.has("battery_data::UNKNOWN")).toBe(true);
  });

  test("should finalize all services", async () => {
    const groupService = new ExcelGroupService("./exports", { _id: "123" });

    await groupService.writeGroupedBatch("battery_data", [
      { Identifier: "A", name: "user1" },
    ]);

    await groupService.finalizeAll();

    const workbookInstance = ExcelJS.stream.xlsx.WorkbookWriter.mock.results[0].value;
    expect(workbookInstance.commit).toHaveBeenCalled();
  });

});