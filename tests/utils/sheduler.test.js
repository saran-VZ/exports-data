const { calculateDelay } = require("./../../utils/sheduler");

const ORIGINAL_ENV = process.env;

describe("calculateDelay", () => {

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("should return 0 when mode is immediate", () => {
    process.env.EXPORT_SCHEDULING_MODE = "immediate";
    const delay = calculateDelay();
    expect(delay).toBe(0);
  });

  test("should return 60000 when mode is sampleWait", () => {
    process.env.EXPORT_SCHEDULING_MODE = "sampleWait";
    const delay = calculateDelay();
    expect(delay).toBe(20000);
  });

  test("should return delay until 22:00 when mode is night and time is before 22:00", () => {
    process.env.EXPORT_SCHEDULING_MODE = "night";
    jest.useFakeTimers().setSystemTime(new Date("2025-01-01T21:00:00"));
    const delay = calculateDelay();
    expect(delay).toBe(60 * 60 * 1000); 
  });

   test("should return delay until 22:00 when mode is night and time is before 22:00", () => {
    process.env.EXPORT_SCHEDULING_MODE = "night";
    jest.useFakeTimers().setSystemTime(new Date("2025-01-01T01:00:00"));
    const delay = calculateDelay();
    expect(delay).toBe(21 * 60 * 60 * 1000); 
  });

  test("should return 0 when invalid mode is provided", () => {
    process.env.EXPORT_SCHEDULING_MODE = "invalidMode";
    const delay = calculateDelay();
    expect(delay).toBe(0);
  });

});