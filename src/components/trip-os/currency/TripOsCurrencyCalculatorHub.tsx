"use client";

import { FinanceCalculatorPanel } from "../finance/FinanceCalculatorPanel";
import { FinanceCurrencyDropdown } from "../finance/FinanceCurrencyDropdown";
import { CurrencyQuickConverter } from "./CurrencyQuickConverter";
import { useTripOsCurrencyHub } from "./TripOsCurrencyHubContext";

export function TripOsCurrencyCalculatorHub(props: {
  tripId: string;
  layout?: "dropdown" | "spreadsheet";
}) {
  const hub = useTripOsCurrencyHub();
  const inline = props.layout === "spreadsheet";

  return (
    <div
      className={[
        "flex flex-col items-center",
        inline ? "w-full" : "relative z-30",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={() => hub.setOpen(!hub.open)}
        className={[
          "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold shadow-sm transition",
          hub.open
            ? "border-violet-400 bg-violet-50 text-violet-900"
            : "border-zinc-200 bg-white text-zinc-700 hover:border-violet-200 hover:bg-violet-50/50",
        ].join(" ")}
        aria-expanded={hub.open}
      >
        <span>Currency / calculator</span>
        <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-600">
          {hub.displayCurrency}
        </span>
      </button>

      {hub.open ? (
        <div
          className={[
            "rounded-2xl border border-zinc-200 bg-white p-3 shadow-xl",
            inline
              ? "mt-2 w-full max-h-[min(70vh,32rem)] overflow-y-auto"
              : "absolute top-full z-40 mt-2 w-[min(380px,calc(100vw-2rem))]",
          ].join(" ")}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Display currency
            </p>
            <FinanceCurrencyDropdown
              baseCurrency={hub.baseCurrency}
              value={hub.displayCurrency}
              onRatesLoaded={(snapshot) => {
                hub.setExchangeRates(snapshot.rates);
              }}
              onChange={hub.setDisplayCurrency}
              onPersistRate={hub.onPersistRate}
            />
          </div>

          <div className="mt-3">
            <CurrencyQuickConverter
              baseCurrency={hub.baseCurrency}
              displayCurrency={hub.displayCurrency}
              ratesFromBase={hub.exchangeRates}
            />
          </div>

          {inline ? (
            <div className="mt-3 overflow-hidden rounded-xl border border-violet-100">
              <FinanceCalculatorPanel
                tripId={props.tripId}
                open
                embedded
                onClose={() => hub.setOpen(false)}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {hub.open && !inline ? (
        <FinanceCalculatorPanel
          tripId={props.tripId}
          open
          onClose={() => hub.setOpen(false)}
        />
      ) : null}
    </div>
  );
}
