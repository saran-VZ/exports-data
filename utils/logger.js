const { createLogger, format, transports } = require("winston");
const fs = require("fs");
const path = require("path");

const logsDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

function formatKolkataTimestamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  return parts
    .replace(/\//g, "-")
    .replace(",", "")
    .replace(":", "-")
    .trim();
}

function formatMeta(meta) {
  const keys = Object.keys(meta || {});
  if (keys.length === 0) return "";

  const allNumeric = keys.every((key) => /^\d+$/.test(key));
  if (allNumeric) {
    return keys
      .sort((a, b) => Number(a) - Number(b))
      .map((key) => meta[key])
      .join("");
  }

  if (
    keys.length === 1 &&
    meta.buffer &&
    meta.buffer.type === "Buffer" &&
    Array.isArray(meta.buffer.data)
  ) {
    try {
      return Buffer.from(meta.buffer.data).toString("hex");
    } catch (err) {
      return JSON.stringify(meta);
    }
  }

  return JSON.stringify(meta);
}

const logger = createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: format.combine(
    format((info) => {
      info.timestamp = formatKolkataTimestamp();
      return info;
    })(),
    format.errors({ stack: true }),
    format.splat(),
    format.printf(({ timestamp, level, message, stack, ...meta }) => {
      const base = `${timestamp} ${level}: ${message}`;
      const stackText = stack ? ` ${stack}` : "";
      const metaText = formatMeta(meta);
      const metaSuffix = metaText ? ` ${metaText}` : "";
      return `${base}${stackText}${metaSuffix}`;
    })
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: path.join(logsDir, "app.log") }),
  ],
});

module.exports = logger;
