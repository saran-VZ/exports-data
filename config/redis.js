const IORedis = require("ioredis");
const logger = require("../utils/logger");

const redis = new IORedis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  maxRetriesPerRequest: null, 
});

redis.on("ready", (err) => {
  logger.info("Redis connected");
});

redis.on("error", (err) => {
  logger.error(" Redis connection error: %s", err);
});


module.exports = redis;
