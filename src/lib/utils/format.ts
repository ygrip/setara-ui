export function formatNumber(n: number | null | undefined): string {
  if (n == null) return '-';
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toString();
}

export function formatPercent(n: number | null | undefined, digits = 1): string {
  if (n == null) return '-';
  return (+n).toFixed(digits) + '%';
}
