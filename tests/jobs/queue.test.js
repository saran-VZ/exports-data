const { Queue } = require("bullmq");
jest.mock("bullmq");

const exportQueue = require("./../../jobs/queue");
const connection = require("./../../config/redis");

jest.mock("./../../config/redis", () => {
  return {
    on: jest.fn(),
    quit: jest.fn(),
  };
});

test("should initialize a BullMQ queue with correct name and redis connection string",() => {
  expect(Queue).toHaveBeenCalledWith("exportQueue", { connection });
});