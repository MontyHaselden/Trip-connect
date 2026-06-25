"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { ExchangeRatesSnapshot } from "@/lib/trip-engine/cost-ledger/exchange-rates";

type TripOsCurrencyHubContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  openHub: () => void;
  displayCurrency: string;
  setDisplayCurrency: (currency: string) => void;
  exchangeRates: Record<string, number>;
  setExchangeRates: (rates: Record<string, number>) => void;
  baseCurrency: string;
  onPersistRate: (patch: {
    foreignCurrency: string | null;
    exchangeRate: number | null;
    exchangeRateDate: string | null;
    exchangeRateManual: boolean;
  }) => void;
};

const TripOsCurrencyHubContext = createContext<TripOsCurrencyHubContextValue | null>(null);

export function TripOsCurrencyHubProvider(props: {
  children: ReactNode;
  tripId: string;
  baseCurrency: string;
  initialDisplayCurrency?: string;
  onPersistRate: TripOsCurrencyHubContextValue["onPersistRate"];
}) {
  const [open, setOpen] = useState(false);
  const [displayCurrency, setDisplayCurrency] = useState(
    props.initialDisplayCurrency ?? props.baseCurrency,
  );
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({
    [props.baseCurrency]: 1,
  });

  useEffect(() => {
    if (props.initialDisplayCurrency) {
      setDisplayCurrency(props.initialDisplayCurrency);
    }
  }, [props.initialDisplayCurrency]);

  const value = useMemo(
    () => ({
      open,
      setOpen,
      openHub: () => setOpen(true),
      displayCurrency,
      setDisplayCurrency,
      exchangeRates,
      setExchangeRates,
      baseCurrency: props.baseCurrency,
      onPersistRate: props.onPersistRate,
    }),
    [
      open,
      displayCurrency,
      exchangeRates,
      props.baseCurrency,
      props.onPersistRate,
    ],
  );

  return (
    <TripOsCurrencyHubContext.Provider value={value}>
      {props.children}
    </TripOsCurrencyHubContext.Provider>
  );
}

export function useTripOsCurrencyHub(): TripOsCurrencyHubContextValue {
  const ctx = useContext(TripOsCurrencyHubContext);
  if (!ctx) {
    throw new Error("useTripOsCurrencyHub must be used within TripOsCurrencyHubProvider");
  }
  return ctx;
}

export function useTripOsCurrencyHubOptional(): TripOsCurrencyHubContextValue | null {
  return useContext(TripOsCurrencyHubContext);
}

export type { ExchangeRatesSnapshot };
