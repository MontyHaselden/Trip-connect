export function currencySymbol(currency: string): string {
  switch (currency.toUpperCase()) {
    case "NZD":
    case "USD":
    case "AUD":
    case "CAD":
      return "$";
    case "JPY":
      return "¥";
    case "EUR":
      return "€";
    case "GBP":
      return "£";
    default:
      return "";
  }
}

export function formatMoneyAmount(cents: number, currency = "NZD"): string {
  const amount = cents / 100;
  if (currency === "JPY") {
    return Math.round(amount).toLocaleString();
  }
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatMoney(cents: number, currency = "NZD"): string {
  const symbol = currencySymbol(currency);
  return `${symbol}${formatMoneyAmount(cents, currency)}`;
}

/** Raw number string for inline cell editing (no symbol). */
export function centsToInputValue(cents: number, currency = "NZD"): string {
  const amount = cents / 100;
  if (currency === "JPY") return String(Math.round(amount));
  if (Number.isInteger(amount)) return String(amount);
  return amount.toFixed(2);
}

export function parseMoneyInput(value: string, currency = "NZD"): number {
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const parsed = Number.parseFloat(cleaned);
  if (!Number.isFinite(parsed)) return 0;
  if (currency === "JPY") return Math.round(parsed) * 100;
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
