const { Queue } = require("bullmq");
jest.mock("bullmq");

const cleanupQueue = require("./../../jobs/cleanup.queue");
const connection = require("./../../config/redis");

jest.mock("./../../config/redis", () => {
  return {
    on: jest.fn(),
    quit: jest.fn(),
  };
});

test("should initialize BullMQ Queue with correct name and connection", () => {
  expect(Queue).toHaveBeenCalledWith("cleanupQueue", { connection });
});