
const TIME_ZONE = "Africa/Addis_Ababa";
const UTC_OFFSET_HOURS = 3;

function getEthiopianToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getWeekday(dateString) {
  return new Date(`${dateString}T00:00:00.000Z`).getUTCDay();
}

/**
 * Convert an Ethiopian calendar date into the corresponding
 * UTC date used by the existing report service.
 *
 * Ethiopia uses UTC+3, so midnight in Ethiopia is 21:00 UTC
 * on the previous calendar day.
 *
 * NOTE: This returns a date-only value. The report service
 * must subsequently be updated to use UTC+3 boundaries.
 */
function toUtcDateString(ethiopianDate) {
  return addDays(ethiopianDate, -1);
}

/**
 * Detect common reporting periods.
 *
 * Returns:
 * {
 *   startDate: "YYYY-MM-DD",
 *   endDate: "YYYY-MM-DD",
 *   label: "Today"
 * }
 *
 * Returns null when no period is detected.
 */
function detectPeriod(message, now = new Date()) {
  const text = message.toLowerCase().trim();

  const today = getEthiopianToday(now);

  // Today
  if (/\btoday\b/.test(text)) {
    return {
      startDate: today,
      endDate: today,
      label: "Today",
    };
  }

  // Yesterday
  if (/\byesterday\b/.test(text)) {
    const yesterday = addDays(today, -1);

    return {
      startDate: yesterday,
      endDate: yesterday,
      label: "Yesterday",
    };
  }

  // Last 7 days
  if (/\blast\s+7\s+days\b/.test(text)) {
    return {
      startDate: addDays(today, -6),
      endDate: today,
      label: "Last 7 days",
    };
  }

  // Last 30 days
  if (/\blast\s+30\s+days\b/.test(text)) {
    return {
      startDate: addDays(today, -29),
      endDate: today,
      label: "Last 30 days",
    };
  }

  // This week: Monday through today
  if (/\bthis\s+week\b/.test(text)) {
    const weekday = getWeekday(today);
    const daysSinceMonday = (weekday + 6) % 7;
    const start = addDays(today, -daysSinceMonday);

    return {
      startDate: start,
      endDate: today,
      label: "This week",
    };
  }

  // Last week: previous Monday through Sunday
  if (/\blast\s+week\b/.test(text)) {
    const weekday = getWeekday(today);
    const daysSinceMonday = (weekday + 6) % 7;

    const end = addDays(today, -daysSinceMonday - 1);
    const start = addDays(end, -6);

    return {
      startDate: start,
      endDate: end,
      label: "Last week",
    };
  }

  // This month: first day through today
  if (/\bthis\s+month\b/.test(text)) {
    const start = `${today.slice(0, 7)}-01`;

    return {
      startDate: start,
      endDate: today,
      label: "This month",
    };
  }

  // Last month
  if (/\blast\s+month\b/.test(text)) {
    const firstOfThisMonth = `${today.slice(0, 7)}-01`;
    const lastOfPreviousMonth = addDays(firstOfThisMonth, -1);
    const firstOfPreviousMonth =
      `${lastOfPreviousMonth.slice(0, 7)}-01`;

    return {
      startDate: firstOfPreviousMonth,
      endDate: lastOfPreviousMonth,
      label: "Last month",
    };
  }

  return null;
}

module.exports = {
  TIME_ZONE,
  getEthiopianToday,
  detectPeriod,
};
