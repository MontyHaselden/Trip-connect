"use client";

import { useCallback, useEffect, useId, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";

import {
  formatTimeDisplay,
  from12HourParts,
  HOUR12_OPTIONS,
  MINUTE_OPTIONS,
  parseTimeValue,
  to12HourParts,
} from "@/lib/utils/time-input";

type Period = "AM" | "PM";

type MenuRect = { top: number; left: number; width: number; height?: number };

const PANEL_W = 272;
const PANEL_EST_HEIGHT = 340;
const WHEEL_ITEM_H = 36;
const WHEEL_VISIBLE = 5;
const WHEEL_H = WHEEL_ITEM_H * WHEEL_VISIBLE;
const WHEEL_PAD = ((WHEEL_H - WHEEL_ITEM_H) / 2);

const QUICK_TIMES: Array<{ label: string; hour12: number; minute: number; period: Period }> = [
  { label: "6 AM", hour12: 6, minute: 0, period: "AM" },
  { label: "9 AM", hour12: 9, minute: 0, period: "AM" },
  { label: "12 PM", hour12: 12, minute: 0, period: "PM" },
  { label: "3 PM", hour12: 3, minute: 0, period: "PM" },
  { label: "6 PM", hour12: 6, minute: 0, period: "PM" },
  { label: "9 PM", hour12: 9, minute: 0, period: "PM" },
];

const defaultTriggerClass =
  "group flex h-10 w-full items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-sm shadow-sm transition hover:border-zinc-300 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-100 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400";

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden className={className}>
      <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10 6v4.25l2.75 1.75"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden className={className}>
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TimeScrollWheel<T extends string | number>({
  options,
  value,
  onChange,
  format,
  ariaLabel,
}: {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  format: (value: T) => string;
  ariaLabel: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const scrollEndTimer = useRef<number | null>(null);
  const userScrolling = useRef(false);

  const index = Math.max(0, options.indexOf(value));

  const scrollToIndex = useCallback((idx: number, smooth = false) => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: idx * WHEEL_ITEM_H, behavior: smooth ? "smooth" : "auto" });
  }, []);

  useEffect(() => {
    if (userScrolling.current) return;
    scrollToIndex(index);
  }, [index, scrollToIndex]);

  function snapToNearest() {
    const el = listRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollTop / WHEEL_ITEM_H);
    const clamped = Math.max(0, Math.min(options.length - 1, idx));
    scrollToIndex(clamped, false);
    userScrolling.current = false;
  }

  function handleScroll() {
    const el = listRef.current;
    if (!el) return;
    userScrolling.current = true;
    const idx = Math.round(el.scrollTop / WHEEL_ITEM_H);
    const clamped = Math.max(0, Math.min(options.length - 1, idx));
    if (options[clamped] !== value) {
      onChange(options[clamped]);
    }
    if (scrollEndTimer.current) window.clearTimeout(scrollEndTimer.current);
    scrollEndTimer.current = window.setTimeout(snapToNearest, 32);
  }

  useEffect(
    () => () => {
      if (scrollEndTimer.current) window.clearTimeout(scrollEndTimer.current);
    },
    [],
  );

  return (
    <div className="relative flex-1" style={{ height: WHEEL_H }}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 border-y border-zinc-200/90 bg-zinc-100/40"
        style={{ height: WHEEL_ITEM_H }}
      />
      <div
        ref={listRef}
        role="listbox"
        aria-label={ariaLabel}
        className="no-scrollbar h-full overflow-y-auto"
        style={{
          scrollSnapType: "y mandatory",
          paddingTop: WHEEL_PAD,
          paddingBottom: WHEEL_PAD,
        }}
        onScroll={handleScroll}
      >
        {options.map((opt) => {
          const selected = opt === value;
          return (
            <button
              key={String(opt)}
              type="button"
              role="option"
              aria-selected={selected}
              style={{ height: WHEEL_ITEM_H, scrollSnapAlign: "center" }}
              className={[
                "flex w-full items-center justify-center text-sm tabular-nums transition",
                selected ? "font-semibold text-zinc-900" : "font-normal text-zinc-400",
              ].join(" ")}
              onClick={() => {
                onChange(opt);
                scrollToIndex(options.indexOf(opt), false);
              }}
            >
              {format(opt)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TimeInput({
  value,
  onChange,
  disabled,
  required,
  placeholder = "Time",
  className,
  inputClassName,
  overlayAnchorRef,
}: {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  /** When set, the picker covers this element (e.g. the add-activity panel). */
  overlayAnchorRef?: RefObject<HTMLElement | null>;
}) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuRect, setMenuRect] = useState<MenuRect | null>(null);

  const parsed = parseTimeValue(value);
  const initial = parsed ?? { hour24: 9, minute: 0 };
  const initial12 = to12HourParts(initial.hour24);

  const [draftHour, setDraftHour] = useState(initial12.hour12);
  const [draftMinute, setDraftMinute] = useState(initial.minute);
  const [draftPeriod, setDraftPeriod] = useState<Period>(initial12.period);

  const draftDisplay = formatTimeDisplay(from12HourParts(draftHour, draftMinute, draftPeriod));

  useEffect(() => {
    setMounted(true);
  }, []);

  const syncDraftFromValue = useCallback(() => {
    const next = parseTimeValue(value);
    if (!next) {
      setDraftHour(9);
      setDraftMinute(0);
      setDraftPeriod("AM");
      return;
    }
    const parts = to12HourParts(next.hour24);
    setDraftHour(parts.hour12);
    setDraftMinute(next.minute);
    setDraftPeriod(parts.period);
  }, [value]);

  const updateMenuPosition = useCallback(() => {
    const anchor = overlayAnchorRef?.current;
    const el = triggerRef.current;
    if (anchor) {
      const rect = anchor.getBoundingClientRect();
      setMenuRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
      return;
    }
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const left = Math.min(rect.left, window.innerWidth - PANEL_W - 16);
    const spaceBelow = window.innerHeight - rect.bottom - 16;
    const openAbove = spaceBelow < PANEL_EST_HEIGHT;
    setMenuRect({
      top: openAbove ? Math.max(16, rect.top - PANEL_EST_HEIGHT - 8) : rect.bottom + 8,
      left: Math.max(16, left),
      width: PANEL_W,
    });
  }, [overlayAnchorRef]);

  useEffect(() => {
    if (!open) return;
    syncDraftFromValue();
    updateMenuPosition();
    window.addEventListener("scroll", updateMenuPosition, true);
    window.addEventListener("resize", updateMenuPosition);
    return () => {
      window.removeEventListener("scroll", updateMenuPosition, true);
      window.removeEventListener("resize", updateMenuPosition);
    };
  }, [open, syncDraftFromValue, updateMenuPosition]);

  useEffect(() => {
    function onDocPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("pointerdown", onDocPointerDown);
      document.addEventListener("keydown", onKeyDown);
    }
    return () => {
      document.removeEventListener("pointerdown", onDocPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function setDraft(hour12: number, minute: number, period: Period) {
    setDraftHour(hour12);
    setDraftMinute(minute);
    setDraftPeriod(period);
  }

  function commitDraft(hour12: number, minute: number, period: Period) {
    setDraft(hour12, minute, period);
    onChange(from12HourParts(hour12, minute, period));
  }

  function applyDraft() {
    commitDraft(draftHour, draftMinute, draftPeriod);
    setOpen(false);
  }

  function updateFromWheel(hour12: number, minute: number, period: Period) {
    commitDraft(hour12, minute, period);
  }

  function clearTime() {
    onChange(null);
    setOpen(false);
  }

  const display = formatTimeDisplay(value);
  const overlayMode = Boolean(overlayAnchorRef);

  const panel =
    open && menuRect && mounted ? (
      <>
        {overlayMode ? null : (
          <div
            className="time-picker-backdrop fixed inset-0 z-[199] bg-zinc-900/10 backdrop-blur-[1px]"
            aria-hidden
          />
        )}
        <div
          ref={panelRef}
          id={listboxId}
          role="dialog"
          aria-label="Pick a time"
          className={[
            "time-picker-panel fixed z-[250] flex flex-col overflow-hidden border border-zinc-200/70 bg-white shadow-2xl shadow-zinc-900/[0.12]",
            overlayMode ? "rounded-xl" : "rounded-2xl bg-white/95 backdrop-blur-xl",
          ].join(" ")}
          style={{
            top: menuRect.top,
            left: menuRect.left,
            width: menuRect.width,
            ...(menuRect.height
              ? { height: menuRect.height, minHeight: menuRect.height, maxHeight: menuRect.height }
              : {}),
          }}
        >
          <div
            className={[
              "shrink-0 border-b border-zinc-100 text-center",
              overlayMode ? "px-3 py-2" : "px-4 py-3",
            ].join(" ")}
          >
            <p
              className={[
                "font-semibold tracking-tight text-zinc-900 tabular-nums",
                overlayMode ? "text-lg" : "text-xl",
              ].join(" ")}
            >
              {draftDisplay || "—"}
            </p>
          </div>

          <div
            className={[
              "flex min-h-0 flex-1 flex-col justify-center space-y-3 overflow-hidden",
              overlayMode ? "px-2 py-2" : "px-3 py-3",
            ].join(" ")}
          >
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
                Quick pick
              </p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_TIMES.map((preset) => {
                  const active =
                    draftHour === preset.hour12 &&
                    draftMinute === preset.minute &&
                    draftPeriod === preset.period;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        commitDraft(preset.hour12, preset.minute, preset.period);
                        setOpen(false);
                      }}
                      className={[
                        "rounded-full px-2.5 py-1 text-[11px] font-medium transition",
                        active
                          ? "bg-zinc-900 text-white"
                          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200/80",
                      ].join(" ")}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-stretch gap-0.5">
              <TimeScrollWheel
                ariaLabel="Hour"
                options={HOUR12_OPTIONS}
                value={draftHour}
                onChange={(hour12) => updateFromWheel(hour12, draftMinute, draftPeriod)}
                format={(h) => String(h)}
              />
              <span
                aria-hidden
                className="flex items-center justify-center pb-1 text-lg font-semibold text-zinc-300"
                style={{ width: 12, height: WHEEL_H }}
              >
                :
              </span>
              <TimeScrollWheel
                ariaLabel="Minute"
                options={MINUTE_OPTIONS}
                value={draftMinute}
                onChange={(minute) => updateFromWheel(draftHour, minute, draftPeriod)}
                format={(m) => String(m).padStart(2, "0")}
              />
              <TimeScrollWheel
                ariaLabel="AM or PM"
                options={["AM", "PM"] as const}
                value={draftPeriod}
                onChange={(period) => updateFromWheel(draftHour, draftMinute, period)}
                format={(p) => p}
              />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 border-t border-zinc-100/90 bg-zinc-50/50 px-3 py-2">
            {!required ? (
              <button
                type="button"
                onClick={clearTime}
                className="h-9 rounded-lg px-3 text-sm font-medium text-zinc-500 transition hover:bg-white hover:text-zinc-800"
              >
                Clear
              </button>
            ) : null}
            <button
              type="button"
              onClick={applyDraft}
              className="h-9 flex-1 rounded-lg bg-zinc-900 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800"
            >
              Done
            </button>
          </div>
        </div>
      </>
    ) : null;

  return (
    <div ref={rootRef} className={className}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={() => {
          if (disabled) return;
          setOpen((o) => !o);
        }}
        className={[
          inputClassName ?? defaultTriggerClass,
          open ? "border-zinc-400 ring-2 ring-zinc-100" : "",
          !display ? "text-zinc-400" : "text-zinc-900",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <ClockIcon className="h-4 w-4 shrink-0 text-zinc-400 transition group-hover:text-zinc-500" />
        <span className="min-w-0 flex-1 truncate text-left tabular-nums">
          {(open ? draftDisplay : display) || placeholder}
        </span>
        <ChevronIcon
          className={["h-4 w-4 shrink-0 text-zinc-400 transition", open ? "rotate-180" : ""].join(
            " ",
          )}
        />
      </button>
      {mounted && panel ? createPortal(panel, document.body) : null}
    </div>
  );
}
