const IORedis = require("ioredis");

const redis = new IORedis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  maxRetriesPerRequest: null, 
});

redis.on("ready", (err) => {
  console.error("Redis connected");
});

redis.on("error", (err) => {
  console.error(" Redis connection error:", err);
});


module.exports = redis;