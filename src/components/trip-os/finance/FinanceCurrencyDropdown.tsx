"use client";

import { useEffect, useState } from "react";

import {
  FINANCE_DISPLAY_CURRENCIES,
  foreignToBaseRate,
  type ExchangeRatesSnapshot,
} from "@/lib/trip-engine/cost-ledger/exchange-rates";

export function FinanceCurrencyDropdown(props: {
  baseCurrency: string;
  value: string;
  onRatesLoaded: (rates: ExchangeRatesSnapshot) => void;
  onChange: (currency: string) => void;
  onPersistRate?: (patch: {
    foreignCurrency: string | null;
    exchangeRate: number | null;
    exchangeRateDate: string | null;
    exchangeRateManual: boolean;
  }) => void;
}) {
  const [rates, setRates] = useState<ExchangeRatesSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetch(`/api/geo/exchange-rates?base=${encodeURIComponent(props.baseCurrency)}`)
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as ExchangeRatesSnapshot & {
          error?: string;
        };
        if (!res.ok) throw new Error(body.error || "Could not load rates");
        if (!cancelled) {
          setRates(body);
          props.onRatesLoaded(body);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load rates");
          setRates({ base: props.baseCurrency, date: "", rates: { [props.baseCurrency]: 1 } });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when base changes only
  }, [props.baseCurrency]);

  function handleSelect(currency: string) {
    props.onChange(currency);
    if (!rates) return;
    if (currency === props.baseCurrency) {
      props.onPersistRate?.({
        foreignCurrency: null,
        exchangeRate: null,
        exchangeRateDate: rates.date || null,
        exchangeRateManual: false,
      });
      return;
    }
    const exchangeRate = foreignToBaseRate(currency, props.baseCurrency, rates.rates);
    props.onPersistRate?.({
      foreignCurrency: currency,
      exchangeRate,
      exchangeRateDate: rates.date || null,
      exchangeRateManual: false,
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <label className="sr-only" htmlFor="finance-display-currency">
        Display currency
      </label>
      <select
        id="finance-display-currency"
        value={props.value}
        disabled={loading}
        onChange={(e) => handleSelect(e.target.value)}
        className="rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] font-medium uppercase text-zinc-800 shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 disabled:opacity-60"
        title={
          rates?.date
            ? `Rough conversion using rates from ${rates.date}`
            : "Display currency"
        }
      >
        {FINANCE_DISPLAY_CURRENCIES.map((code) => (
          <option key={code} value={code}>
            {code}
          </option>
        ))}
      </select>
      {loading ? (
        <span className="text-[10px] text-zinc-400">rates…</span>
      ) : rates?.date ? (
        <span className="hidden text-[10px] text-zinc-400 sm:inline">{rates.date}</span>
      ) : error ? (
        <span className="text-[10px] text-amber-700" title={error}>
          offline
        </span>
      ) : null}
    </div>
  );
}
