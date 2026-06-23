"use client";

import { useEffect, useRef, useState } from "react";

import {
  centsToInputValue,
  currencySymbol,
  formatMoneyAmount,
  parseMoneyInput,
} from "@/lib/trip-engine/cost-ledger/format-money";

const COMMON_CURRENCIES = ["NZD", "JPY", "USD", "AUD", "EUR", "GBP"] as const;

export function FinanceInlineMoneyCell(props: {
  valueCents: number | null;
  currency: string;
  isPinned?: boolean;
  disabled?: boolean;
  allowClear?: boolean;
  showCurrencyCode?: boolean;
  onCommit: (cents: number | null) => void;
  onCurrencyChange?: (currency: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState("");
  const [pendingCents, setPendingCents] = useState<number | null | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  const symbol = currencySymbol(props.currency);

  const effectiveCents =
    pendingCents !== undefined ? pendingCents : props.valueCents;
  const hasValue = effectiveCents != null && effectiveCents > 0;
  const displayText = hasValue
    ? formatMoneyAmount(effectiveCents!, props.currency)
    : "";
  const widthText = focused ? draft || displayText || "0.00" : displayText || "0.00";
  const inputWidthCh = Math.max(widthText.length, props.currency === "JPY" ? 3 : 4);

  useEffect(() => {
    if (!focused) return;
    setDraft(
      hasValue ? centsToInputValue(effectiveCents!, props.currency) : "",
    );
    const id = requestAnimationFrame(() => inputRef.current?.select());
    return () => cancelAnimationFrame(id);
  }, [focused, hasValue, effectiveCents, props.currency]);

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
      const cents = parseMoneyInput(trimmed, props.currency);
      if (cents > 0) nextCents = cents;
      else if (props.allowClear) nextCents = null;
    }
    if (nextCents !== null || props.allowClear) {
      setPendingCents(nextCents);
      props.onCommit(nextCents);
    }
    setFocused(false);
  }

  function cancel() {
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
    <div className="inline-flex w-max min-w-full flex-col items-end">
      <div
        onMouseDown={handleCellMouseDown}
        className={[
          "inline-flex min-h-[1.5rem] w-max max-w-none items-center justify-end gap-0.5 rounded px-1",
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
          inputMode={props.currency === "JPY" ? "numeric" : "decimal"}
          readOnly={!focused}
          value={focused ? draft : displayText}
          placeholder={props.currency === "JPY" ? "0" : "0.00"}
          onFocus={() => setFocused(true)}
          onChange={(e) => setDraft(e.target.value)}
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
      {focused && props.onCurrencyChange ? (
        <select
          value={props.currency}
          onChange={(e) => props.onCurrencyChange?.(e.target.value)}
          onMouseDown={(e) => e.stopPropagation()}
          className="mt-1 w-full rounded border border-zinc-200 bg-white px-1 py-0.5 text-[10px] uppercase text-zinc-600"
        >
          {COMMON_CURRENCIES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      ) : props.showCurrencyCode && hasValue ? (
        <span className="mt-0.5 block text-right text-[10px] uppercase text-zinc-400">
          {props.currency}
        </span>
      ) : null}
    </div>
  );
}
