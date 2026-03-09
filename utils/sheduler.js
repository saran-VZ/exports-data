function calculateDelay() {
  const mode = process.env.EXPORT_SCHEDULING_MODE;

  if (mode === "immediate") {
    return 0;
  }

  if (mode === "sampleWait"){
    const sampleTime = 60*1000*1;
    return sampleTime;
  }

  if (mode === "night") {
  const now = new Date();

  const start = new Date();
  start.setHours(22, 0, 0, 0);

  const end = new Date();
  end.setHours(24, 0, 0, 0);

  if (now >= start && now < end) {
    return 0;
  }

  if (now < start) {
    return start - now;
  }
}

  return 0;
}

module.exports = { calculateDelay };