/**
 * Shared formatting utilities.
 * Import from here instead of defining local `fmt` / `pct` in each component.
 */

/** Format a dollar amount compactly: $1.2M, $340k, $850 */
export const fmtMoney = (n: number): string =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` :
  n >= 1_000     ? `$${(n / 1_000).toFixed(0)}k` :
  `$${n.toFixed(0)}`;

/** Format a dollar amount with 2 decimal places for millions: $1.23M, $340k, $850 */
export const fmtMoneyPrecise = (n: number): string =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` :
  n >= 1_000     ? `$${(n / 1_000).toFixed(0)}k` :
  `$${n.toFixed(0)}`;

/** Format a percentage with one decimal place */
export const fmtPct = (n: number): string => `${n.toFixed(1)}%`;

/** Format a percentage with sign: +12.3% or -4.1% */
export const fmtPctSigned = (n: number): string =>
  `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;

/** Format a dollar delta with sign: +$120k or -$45k */
export const fmtMoneySigned = (n: number): string =>
  `${n >= 0 ? '+' : ''}${fmtMoney(Math.abs(n))}`;

/** Format a valuation multiple: 6.5x */
export const fmtMultiple = (n: number): string => `${n.toFixed(1)}x`;

/** Format a day count: 45 days */
export const fmtDays = (n: number): string => `${Math.round(n)} day${Math.round(n) !== 1 ? 's' : ''}`;

/** Format an integer with commas: 1,234 */
export const fmtCount = (n: number): string =>
  Math.round(n).toLocaleString('en-US');

/** Format a ratio (e.g. revenue per employee) compactly */
export const fmtRatio = (n: number): string => fmtMoney(n);

/**
 * Annualize a period total given the number of periods in the dataset.
 * e.g. 6 monthly periods → multiply by 2 to get annual run rate.
 */
export const annualize = (total: number, periodCount: number): number =>
  Math.round((total / Math.max(periodCount, 1)) * 12);

/** Clamp a value between min and max */
export const clamp = (n: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, n));
