export function formatMoney(cents: number, currency = "NZD"): string {
  const amount = cents / 100;
  const symbol = currency === "NZD" ? "$" : currency === "JPY" ? "¥" : "";
  if (currency === "JPY") {
    return `${symbol}${Math.round(amount).toLocaleString()}`;
  }
  return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function parseMoneyInput(value: string): number {
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const parsed = Number.parseFloat(cleaned);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100);
}

export function convertToBaseCents(
  amountCents: number,
  currency: string,
  settings: {
    baseCurrency: string;
    foreignCurrency: string | null;
    exchangeRate: number | null;
  },
): number {
  if (currency === settings.baseCurrency) return amountCents;
  if (
    settings.foreignCurrency &&
    currency === settings.foreignCurrency &&
    settings.exchangeRate &&
    settings.exchangeRate > 0
  ) {
    return Math.round(amountCents * settings.exchangeRate);
  }
  return amountCents;
}
