function calculateDelay() {
  const mode = process.env.EXPORT_SCHEDULING_MODE;

  if (mode === "immediate") {
    return 0;
  }

  if (mode === "night") {
    const now = new Date();
    const scheduled = new Date();

    scheduled.setHours(
      Number(process.env.EXPORT_SCHEDULE_HOUR),
      Number(process.env.EXPORT_SCHEDULE_MINUTE),
      0,
      0
    );

    if (scheduled < now) {
      scheduled.setDate(scheduled.getDate() + 1);
    }

    return scheduled.getTime() - now.getTime();
  }

  return 0;
}

module.exports = { calculateDelay };