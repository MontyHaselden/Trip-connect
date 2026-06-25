"use client";

import { useEffect, useRef, useState } from "react";

import {
  centsToInputValue,
  currencySymbol,
  formatMoneyAmount,
  parseMoneyInput,
} from "@/lib/trip-engine/cost-ledger/format-money";
import { convertCentsBetweenCurrencies } from "@/lib/trip-engine/cost-ledger/exchange-rates";

export function FinanceInlineMoneyCell(props: {
  valueCents: number | null;
  currency: string;
  isPinned?: boolean;
  disabled?: boolean;
  allowClear?: boolean;
  compact?: boolean;
  align?: "start" | "center" | "end";
  displayCurrency?: string;
  baseCurrency?: string;
  ratesFromBase?: Record<string, number>;
  onCommit: (cents: number | null) => void;
  /** Live preview while typing — parent uses this for column totals. */
  onDraftChange?: (cents: number | null) => void;
  onDraftEnd?: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState("");
  const [pendingCents, setPendingCents] = useState<number | null | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  const focusSessionRef = useRef(false);
  const storageCurrency = props.currency;
  const viewCurrency = props.displayCurrency ?? storageCurrency;
  const baseCurrency = props.baseCurrency ?? storageCurrency;
  const rates = props.ratesFromBase ?? { [baseCurrency]: 1 };
  const usesDisplayConversion =
    viewCurrency !== storageCurrency && Object.keys(rates).length > 0;

  function toDisplayCents(cents: number | null): number | null {
    if (cents == null) return null;
    if (!usesDisplayConversion) return cents;
    return convertCentsBetweenCurrencies(
      cents,
      storageCurrency,
      viewCurrency,
      baseCurrency,
      rates,
    );
  }

  function toStorageCents(cents: number | null): number | null {
    if (cents == null) return null;
    if (!usesDisplayConversion) return cents;
    return convertCentsBetweenCurrencies(
      cents,
      viewCurrency,
      storageCurrency,
      baseCurrency,
      rates,
    );
  }

  const symbol = currencySymbol(viewCurrency);
  const alignClass =
    props.align === "center"
      ? "items-center"
      : props.align === "start"
        ? "items-start"
        : "items-end";

  const effectiveStorageCents =
    pendingCents !== undefined ? pendingCents : props.valueCents;
  const effectiveCents = toDisplayCents(effectiveStorageCents);
  const hasValue = effectiveCents != null && effectiveCents > 0;
  const displayText = hasValue
    ? formatMoneyAmount(effectiveCents!, viewCurrency)
    : "";
  const widthText = focused ? draft || displayText || "0.00" : displayText || "0.00";
  const inputWidthCh = Math.max(
    widthText.length,
    viewCurrency === "JPY" ? 6 : viewCurrency === "EUR" || viewCurrency === "GBP" ? 5 : 4,
  );

  useEffect(() => {
    if (!focused) {
      focusSessionRef.current = false;
      return;
    }
    if (focusSessionRef.current) return;
    focusSessionRef.current = true;

    const displayCents = toDisplayCents(props.valueCents);
    const startHasValue = displayCents != null && displayCents > 0;
    setDraft(startHasValue ? centsToInputValue(displayCents, viewCurrency) : "");

    const id = requestAnimationFrame(() => inputRef.current?.select());
    return () => cancelAnimationFrame(id);
  }, [focused, props.valueCents, viewCurrency]);

  useEffect(() => {
    if (
      pendingCents !== undefined &&
      props.valueCents === pendingCents
    ) {
      setPendingCents(undefined);
    }
  }, [props.valueCents, pendingCents]);

  function commit() {
    if (!focused) return;
    const trimmed = draft.trim();
    let nextCents: number | null = null;
    if (!trimmed) {
      if (props.allowClear) nextCents = null;
    } else {
      const cents = parseMoneyInput(trimmed, viewCurrency);
      if (cents >= 0) nextCents = toStorageCents(cents);
      else if (props.allowClear) nextCents = null;
    }
    if (nextCents !== null || props.allowClear) {
      setPendingCents(nextCents);
      props.onCommit(nextCents);
    }
    props.onDraftEnd?.();
    setFocused(false);
  }

  function cancel() {
    props.onDraftEnd?.();
    setFocused(false);
    setDraft("");
  }

  function handleCellMouseDown(e: React.MouseEvent) {
    if (!focused) return;
    e.preventDefault();
    inputRef.current?.blur();
  }

  if (props.disabled) {
    return <span className="block min-h-[1.5rem]" aria-hidden />;
  }

  return (
    <div
      className={[
        props.compact ? "inline-flex" : "inline-flex w-max min-w-full flex-col",
        alignClass,
      ].join(" ")}
    >
      <div
        onMouseDown={handleCellMouseDown}
        className={[
          "inline-flex min-h-[1.5rem] w-max max-w-none items-center gap-0.5 rounded px-1",
          props.align === "center" ? "justify-center" : "justify-end",
          focused ? "bg-sky-50 ring-1 ring-sky-300" : "hover:bg-sky-50/60",
        ].join(" ")}
      >
        {symbol ? (
          <span
            className={[
              "shrink-0 text-xs leading-none tabular-nums",
              focused || hasValue ? "text-zinc-500" : "text-zinc-300",
            ].join(" ")}
          >
            {symbol}
          </span>
        ) : null}
        <input
          ref={inputRef}
          type="text"
          inputMode={viewCurrency === "JPY" ? "numeric" : "decimal"}
          readOnly={!focused}
          value={focused ? draft : displayText}
          placeholder={viewCurrency === "JPY" ? "0" : "0.00"}
          onFocus={() => setFocused(true)}
          onChange={(e) => {
            const next = e.target.value;
            setDraft(next);
            if (!props.onDraftChange) return;
            const trimmed = next.trim();
            if (!trimmed) {
              props.onDraftChange(null);
              return;
            }
            const cents = parseMoneyInput(trimmed, viewCurrency);
            if (cents >= 0) props.onDraftChange(toStorageCents(cents));
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              cancel();
              inputRef.current?.blur();
            }
          }}
          title={
            props.isPinned
              ? "You set this amount — others auto-adjust"
              : hasValue
                ? "Auto-calculated — edit to pin"
                : "Type an amount"
          }
          style={{ width: `${inputWidthCh}ch` }}
          className={[
            "shrink-0 border-0 bg-transparent py-0 text-right text-xs leading-normal tabular-nums outline-none whitespace-nowrap",
            props.isPinned ? "font-medium text-zinc-900" : "font-normal text-zinc-700",
            !focused && !hasValue ? "text-zinc-300 placeholder:text-zinc-300" : "",
            !focused && hasValue ? "cursor-text" : "",
          ].join(" ")}
        />
      </div>
    </div>
  );
}
