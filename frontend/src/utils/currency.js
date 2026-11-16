export const formatETB = (amount) =>
  new Intl.NumberFormat('en-ET', {
    style: 'currency',
    currency: 'ETB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);

export const formatMinor = (amountMinor) =>
  formatETB((Number(amountMinor) || 0) / 100);

export const parseMoneyToMinor = (value) => {
  const raw = typeof value === 'string'
    ? value.replace(/,/g, '').trim()
    : String(value ?? '').trim();

  if (!raw) {
    return NaN;
  }

  const numeric = Number(raw);

  if (!Number.isFinite(numeric)) {
    return NaN;
  }

  return Math.round((numeric + Number.EPSILON) * 100);
};
