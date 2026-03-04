const { Queue } = require("bullmq");
const connection = require("./../config/redis");

const cleanupQueue = new Queue("cleanupQueue", { connection });

module.exports = cleanupQueue;