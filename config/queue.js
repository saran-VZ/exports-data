const { Queue } = require("bullmq");
const connection = require("./redis");

const exportQueue = new Queue("exportQueue", {
  connection,
});

module.exports = exportQueue;