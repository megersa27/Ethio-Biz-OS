const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function ethiopiaDateKey(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Addis_Ababa',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function toUtcDayNumber(dateValue) {
  const dateKey = ethiopiaDateKey(dateValue);
  const [year, month, day] = dateKey.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function getDayBucket(dateValue, referenceDate = new Date()) {
  const refDay = toUtcDayNumber(referenceDate);
  const saleDay = toUtcDayNumber(dateValue);
  const dayDifference = Math.round((refDay - saleDay) / DAY_IN_MS);

  if (dayDifference === 0) return 'today';
  if (dayDifference === 1) return 'yesterday';
  if (dayDifference <= 7) return 'thisWeek';
  return 'older';
}

export function groupSalesByDay(sales = [], referenceDate = new Date()) {
  const grouped = {
    today: [],
    yesterday: [],
    thisWeek: [],
    older: [],
  };

  for (const sale of sales) {
    if (!sale?.createdAt) continue;
    grouped[getDayBucket(sale.createdAt, referenceDate)]?.push(sale);
  }

  return [
    { key: 'today', label: 'sales.dayToday', sales: grouped.today },
    { key: 'yesterday', label: 'sales.dayYesterday', sales: grouped.yesterday },
    { key: 'thisWeek', label: 'sales.dayThisWeek', sales: grouped.thisWeek },
    { key: 'older', label: 'sales.dayOlder', sales: grouped.older },
  ].filter((group) => group.sales.length > 0);
}
