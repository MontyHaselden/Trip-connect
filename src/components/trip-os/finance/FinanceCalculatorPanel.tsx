"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  appendCalculatorToken,
  evaluateCalculatorExpression,
  formatCalculatorResult,
} from "./calculator/finance-calculator-engine";
import {
  defaultCalculatorPosition,
  loadCalculatorState,
  saveCalculatorState,
  type FinanceCalculatorHistoryEntry,
} from "./calculator/finance-calculator-storage";

const KEYPAD: { label: string; token: string; className?: string }[][] = [
  [
    { label: "C", token: "C", className: "text-zinc-500" },
    { label: "(", token: "(" },
    { label: ")", token: ")" },
    { label: "⌫", token: "⌫", className: "text-zinc-500" },
  ],
  [
    { label: "7", token: "7" },
    { label: "8", token: "8" },
    { label: "9", token: "9" },
    { label: "÷", token: "/" },
  ],
  [
    { label: "4", token: "4" },
    { label: "5", token: "5" },
    { label: "6", token: "6" },
    { label: "×", token: "*" },
  ],
  [
    { label: "1", token: "1" },
    { label: "2", token: "2" },
    { label: "3", token: "3" },
    { label: "−", token: "-" },
  ],
  [
    { label: "0", token: "0", className: "col-span-2" },
    { label: ".", token: "." },
    { label: "+", token: "+" },
  ],
];

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function FinanceCalculatorPanel(props: {
  tripId: string;
  open: boolean;
  embedded?: boolean;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [expression, setExpression] = useState("");
  const [history, setHistory] = useState<FinanceCalculatorHistoryEntry[]>([]);
  const [position, setPosition] = useState(defaultCalculatorPosition);
  const [copyFlash, setCopyFlash] = useState<"result" | string | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const preview = evaluateCalculatorExpression(expression);
  const previewLabel =
    preview != null ? formatCalculatorResult(preview) : expression.trim() ? "…" : "0";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!props.open) return;
    const saved = loadCalculatorState(props.tripId);
    if (saved) {
      setHistory(saved.history);
      setPosition(saved.position);
    } else {
      setPosition(defaultCalculatorPosition());
    }
  }, [props.open, props.tripId]);

  const persist = useCallback(
    (nextHistory: FinanceCalculatorHistoryEntry[], nextPosition = position) => {
      saveCalculatorState(props.tripId, { history: nextHistory, position: nextPosition });
    },
    [props.tripId, position],
  );

  function commitCalculation() {
    const trimmed = expression.trim();
    if (!trimmed) return;
    const result = evaluateCalculatorExpression(trimmed);
    if (result == null) return;
    const entry: FinanceCalculatorHistoryEntry = {
      id: crypto.randomUUID(),
      expression: trimmed,
      result,
      at: new Date().toISOString(),
    };
    const next = [entry, ...history].slice(0, 80);
    setHistory(next);
    persist(next);
    setExpression(formatCalculatorResult(result).replace(/,/g, ""));
  }

  function flashCopy(key: "result" | string, text: string) {
    void copyText(text).then((ok) => {
      if (!ok) return;
      setCopyFlash(key);
      window.setTimeout(() => setCopyFlash(null), 1600);
    });
  }

  function handleKey(token: string) {
    if (token === "=") {
      commitCalculation();
      return;
    }
    setExpression((prev) => appendCalculatorToken(prev, token));
  }

  function onExpressionKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitCalculation();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      props.onClose();
    }
  }

  function onDragPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    e.preventDefault();
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: position.x,
      originY: position.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onDragPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const next = {
      x: Math.max(8, drag.originX + (e.clientX - drag.startX)),
      y: Math.max(8, drag.originY + (e.clientY - drag.startY)),
    };
    setPosition(next);
  }

  function onDragPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    const next = {
      x: Math.max(8, drag.originX + (e.clientX - drag.startX)),
      y: Math.max(8, drag.originY + (e.clientY - drag.startY)),
    };
    setPosition(next);
    persist(history, next);
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  if (!mounted || !props.open) return null;

  const panelBody = (
    <div
      ref={panelRef}
      className={
        props.embedded
          ? "finance-calculator-panel w-full select-none"
          : "finance-calculator-panel fixed z-[200] w-[min(340px,calc(100vw-2rem))] select-none"
      }
      style={props.embedded ? undefined : { left: position.x, top: position.y }}
      role="dialog"
      aria-label="Finance calculator"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className={[
          "overflow-hidden bg-white",
          props.embedded
            ? ""
            : "rounded-2xl border border-violet-200/80 bg-white/95 shadow-[0_24px_80px_-12px_rgba(76,29,149,0.35),0_8px_24px_-8px_rgba(15,23,42,0.2)] ring-1 ring-violet-100/80 backdrop-blur-xl",
        ].join(" ")}
      >
        {!props.embedded ? (
        <div
          className="flex cursor-grab items-center gap-2 border-b border-violet-500/20 bg-gradient-to-r from-[#1e1b4b] via-[#312e81] to-[#4c1d95] px-3 py-2.5 active:cursor-grabbing"
          onPointerDown={onDragPointerDown}
          onPointerMove={onDragPointerMove}
          onPointerUp={onDragPointerUp}
          onPointerCancel={onDragPointerUp}
        >
          <span className="flex gap-0.5 text-violet-300/70" aria-hidden>
            <span className="h-1 w-1 rounded-full bg-current" />
            <span className="h-1 w-1 rounded-full bg-current" />
            <span className="h-1 w-1 rounded-full bg-current" />
          </span>
          <p className="min-w-0 flex-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-100">
            Calculator
          </p>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => props.onClose()}
            className="rounded-lg px-2 py-1 text-[10px] font-medium text-violet-200/90 transition hover:bg-white/10 hover:text-white"
          >
            Hide
          </button>
        </div>
        ) : (
          <div className="border-b border-violet-100 bg-violet-50/60 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-violet-700">
              Calculator
            </p>
          </div>
        )}

        <div className="space-y-3 p-3.5">
          <div className="rounded-xl border border-zinc-200/90 bg-gradient-to-b from-zinc-50 to-white p-3 shadow-inner">
            <input
              type="text"
              inputMode="decimal"
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              onKeyDown={onExpressionKeyDown}
              placeholder="Type or tap — e.g. 1047.5 × 19"
              className="w-full border-0 bg-transparent text-right font-mono text-lg font-medium tracking-tight text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
              spellCheck={false}
              autoComplete="off"
            />
            <div className="mt-1 flex items-end justify-between gap-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                Live
              </p>
              <p className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-violet-700">
                {previewLabel}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => flashCopy("result", formatCalculatorResult(preview ?? 0))}
              disabled={preview == null}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50/80 px-3 py-2 text-[11px] font-semibold text-violet-800 transition hover:border-violet-300 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {copyFlash === "result" ? (
                <>
                  <CheckIcon className="text-emerald-600" />
                  Copied
                </>
              ) : (
                <>
                  <CopyIcon />
                  Copy result
                </>
              )}
            </button>
            <button
              type="button"
              onClick={commitCalculation}
              className="rounded-xl bg-gradient-to-b from-violet-600 to-violet-700 px-4 py-2 text-[11px] font-bold text-white shadow-md shadow-violet-300/40 transition hover:from-violet-500 hover:to-violet-600"
            >
              =
            </button>
          </div>

          <div className="space-y-1.5">
            {KEYPAD.map((row, rowIndex) => (
              <div key={rowIndex} className="grid grid-cols-4 gap-1.5">
                {row.map((key) => (
                  <button
                    key={`${key.label}-${key.token}`}
                    type="button"
                    onClick={() => handleKey(key.token)}
                    className={[
                      "rounded-xl border border-zinc-200/90 bg-white py-2.5 text-sm font-semibold text-zinc-800 shadow-sm transition hover:border-violet-200 hover:bg-violet-50/50 active:scale-[0.97] active:shadow-none",
                      key.className ?? "",
                    ].join(" ")}
                  >
                    {key.label}
                  </button>
                ))}
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/80">
            <div className="flex items-center justify-between border-b border-zinc-200/80 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                Tape
              </p>
              <p className="text-[10px] text-zinc-400">{history.length} saved</p>
            </div>
            <ul className="max-h-36 space-y-0.5 overflow-y-auto p-2">
              {history.length === 0 ? (
                <li className="px-2 py-6 text-center text-[11px] text-zinc-400">
                  Calculations stay here while you work in the sheet.
                </li>
              ) : (
                history.map((entry) => (
                  <li
                    key={entry.id}
                    className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-[11px] text-zinc-600">
                        {entry.expression}
                      </p>
                      <p className="font-mono text-sm font-semibold tabular-nums text-zinc-900">
                        = {formatCalculatorResult(entry.result)}
                      </p>
                    </div>
                    <button
                      type="button"
                      title="Copy result"
                      onClick={() =>
                        flashCopy(entry.id, formatCalculatorResult(entry.result))
                      }
                      className="shrink-0 rounded-lg border border-transparent p-1.5 text-zinc-400 opacity-70 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      {copyFlash === entry.id ? (
                        <CheckIcon className="text-emerald-600" />
                      ) : (
                        <CopyIcon />
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  if (props.embedded) return panelBody;
  return createPortal(panelBody, document.body);
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="9"
        y="9"
        width="11"
        height="11"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M5 15V5a2 2 0 0 1 2-2h10"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon(props: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      className={props.className}
      aria-hidden
    >
      <path
        d="M5 13l4 4L19 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
