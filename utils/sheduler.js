function calculateDelay() {
  const mode = process.env.EXPORT_SCHEDULING_MODE;

  if (mode === "immediate") {
    return 0;
  }

  if (mode === "sampleWait"){
    const sampleTime = 60*1000*1;
    return sampleTime;
  }

  return 0;
}

module.exports = { calculateDelay };