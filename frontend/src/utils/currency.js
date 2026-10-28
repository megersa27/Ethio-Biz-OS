export const formatETB = (amount) =>
  new Intl.NumberFormat('en-ET', {
    style: 'currency',
    currency: 'ETB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);

export const formatMinor = (amountMinor) =>
  formatETB((Number(amountMinor) || 0) / 100);
