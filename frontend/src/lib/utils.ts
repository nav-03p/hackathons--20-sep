export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function fmt(n: number, decimals = 0): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

export function fmtCurrency(n: number): string {
  return '$' + fmt(n);
}

export function fmtPct(n: number): string {
  return (n * 100).toFixed(1) + '%';
}
