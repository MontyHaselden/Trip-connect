"use client";

import { useMemo, useState } from "react";

import {
  convertCentsBetweenCurrencies,
  foreignToBaseRate,
} from "@/lib/trip-engine/cost-ledger/exchange-rates";
import {
  centsToInputValue,
  currencySymbol,
  formatMoneyAmount,
  parseMoneyInput,
} from "@/lib/trip-engine/cost-ledger/format-money";

export function CurrencyQuickConverter(props: {
  baseCurrency: string;
  displayCurrency: string;
  ratesFromBase: Record<string, number>;
  ratesDate?: string | null;
}) {
  const [amountInput, setAmountInput] = useState("");
  const [fromCurrency, setFromCurrency] = useState(props.displayCurrency);

  const fromCents = useMemo(() => {
    const trimmed = amountInput.trim();
    if (!trimmed) return null;
    const cents = parseMoneyInput(trimmed, fromCurrency);
    return cents >= 0 ? cents : null;
  }, [amountInput, fromCurrency]);

  const converted = useMemo(() => {
    if (fromCents == null) return null;
    const toCurrency =
      fromCurrency === props.baseCurrency ? props.displayCurrency : props.baseCurrency;
    if (fromCurrency === toCurrency) return { toCurrency, cents: fromCents };
    return {
      toCurrency,
      cents: convertCentsBetweenCurrencies(
        fromCents,
        fromCurrency,
        toCurrency,
        props.baseCurrency,
        props.ratesFromBase,
      ),
    };
  }, [fromCents, fromCurrency, props.baseCurrency, props.displayCurrency, props.ratesFromBase]);

  const rateLabel = useMemo(() => {
    if (props.displayCurrency === props.baseCurrency) return null;
    const rate = foreignToBaseRate(
      props.displayCurrency,
      props.baseCurrency,
      props.ratesFromBase,
    );
    if (!rate) return null;
    const perBase = props.ratesFromBase[props.displayCurrency];
    if (!perBase) return null;
    return `1 ${props.baseCurrency} ≈ ${perBase.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${props.displayCurrency}`;
  }, [props.baseCurrency, props.displayCurrency, props.ratesFromBase]);

  return (
    <div className="rounded-xl border border-zinc-200/90 bg-zinc-50/80 p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
        Quick convert
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="flex min-w-[8rem] flex-1 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2 py-1.5">
          <span className="text-xs text-zinc-400">{currencySymbol(fromCurrency)}</span>
          <input
            type="text"
            inputMode={fromCurrency === "JPY" ? "numeric" : "decimal"}
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            placeholder={fromCurrency === "JPY" ? "0" : "0.00"}
            className="min-w-0 flex-1 border-0 bg-transparent text-sm tabular-nums text-zinc-900 outline-none"
          />
        </div>
        <select
          value={fromCurrency}
          onChange={(e) => setFromCurrency(e.target.value)}
          className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs font-medium uppercase text-zinc-700"
        >
          <option value={props.baseCurrency}>{props.baseCurrency}</option>
          {props.displayCurrency !== props.baseCurrency ? (
            <option value={props.displayCurrency}>{props.displayCurrency}</option>
          ) : null}
        </select>
        {converted ? (
          <p className="w-full text-sm text-zinc-700">
            ≈{" "}
            <span className="font-semibold tabular-nums text-violet-800">
              {formatMoneyAmount(converted.cents, converted.toCurrency)}
            </span>
          </p>
        ) : (
          <p className="w-full text-xs text-zinc-400">Type an amount to convert</p>
        )}
      </div>
      {rateLabel ? (
        <p className="mt-2 text-[10px] text-zinc-400">
          {rateLabel}
          {props.ratesDate ? ` · ${props.ratesDate}` : ""}
        </p>
      ) : null}
    </div>
  );
}
