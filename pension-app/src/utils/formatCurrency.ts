/**
 * formatCurrency — number formatting helpers
 */

/** Format a monetary value with the currency code, no decimals */
export function formatMoney(amount: number, currency: string): string {
  const rounded = Math.round(amount);
  return `${rounded.toLocaleString('de-CH')} ${currency}`;
}

/** Format in EUR */
export function formatEUR(amount: number): string {
  return `€${Math.round(amount).toLocaleString('de-CH')}`;
}

/** Format as percentage with given decimal places */
export function formatPct(rate: number, decimals = 1): string {
  return `${(rate * 100).toFixed(decimals)}%`;
}

/** Format large amounts in millions with 1dp */
export function formatMillions(amount: number, currency: string): string {
  return `${(amount / 1_000_000).toFixed(1)}m ${currency}`;
}

/** Short label for amounts (e.g. 73,451 CZK/mo) */
export function formatMonthly(amount: number, currency: string): string {
  return `${formatMoney(amount, currency)}/mo`;
}

/**
 * Display amount in either local currency or EUR based on the `currency` toggle.
 * When converting to EUR: divides by the exchange rate.
 */
export function displayAmount(
  localAmount: number,
  localCurrency: string,
  displayCurrency: 'EUR' | 'local',
  eurExchangeRate: number
): string {
  if (displayCurrency === 'local' || localCurrency === 'EUR') {
    return formatMoney(localAmount, localCurrency);
  }
  return formatEUR(localAmount / eurExchangeRate);
}

/** Format overhead percentage: how much MORE than gross the employer pays */
export function formatOverhead(totalEmployerCost: number, grossMonthly: number): string {
  if (grossMonthly === 0) return '—';
  const overhead = (totalEmployerCost - grossMonthly) / grossMonthly;
  return `+${(overhead * 100).toFixed(1)}%`;
}
