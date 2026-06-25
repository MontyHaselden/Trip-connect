export const FINANCE_DISPLAY_CURRENCIES = [
  "NZD",
  "JPY",
  "USD",
  "AUD",
  "EUR",
  "GBP",
] as const;

export type FinanceDisplayCurrency = (typeof FINANCE_DISPLAY_CURRENCIES)[number];

export type ExchangeRatesSnapshot = {
  base: string;
  date: string;
  /** 1 base currency unit = rates[code] units of `code`. */
  rates: Record<string, number>;
};

/** Convert stored cents from one currency to another via rates quoted from base. */
export function convertCentsBetweenCurrencies(
  cents: number,
  fromCurrency: string,
  toCurrency: string,
  baseCurrency: string,
  ratesFromBase: Record<string, number>,
): number {
  if (fromCurrency === toCurrency) return cents;
  const fromMajor = cents / 100;
  const baseMajor =
    fromCurrency === baseCurrency
      ? fromMajor
      : fromMajor / (ratesFromBase[fromCurrency] ?? 1);
  const toMajor =
    toCurrency === baseCurrency
      ? baseMajor
      : baseMajor * (ratesFromBase[toCurrency] ?? 1);
  return Math.round(toMajor * 100);
}

/** Foreign → base multiplier for trip cost settings (1 foreign major = rate base major). */
export function foreignToBaseRate(
  foreignCurrency: string,
  baseCurrency: string,
  ratesFromBase: Record<string, number>,
): number | null {
  const perBase = ratesFromBase[foreignCurrency];
  if (!perBase || perBase <= 0) return null;
  return 1 / perBase;
}

export async function fetchExchangeRates(baseCurrency: string): Promise<ExchangeRatesSnapshot> {
  const targets = FINANCE_DISPLAY_CURRENCIES.filter((c) => c !== baseCurrency).join(",");
  const url = `https://api.frankfurter.app/latest?from=${encodeURIComponent(baseCurrency)}&to=${targets}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not load exchange rates.");
  const body = (await res.json()) as {
    base: string;
    date: string;
    rates: Record<string, number>;
  };
  return {
    base: body.base,
    date: body.date,
    rates: { [baseCurrency]: 1, ...body.rates },
  };
}
