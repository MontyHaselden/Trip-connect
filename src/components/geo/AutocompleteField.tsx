"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type AutocompleteOption = {
  id: string;
  label: string;
  sublabel?: string;
  /** Committed value when different from display label (e.g. airport short name). */
  value?: string;
};

type MenuRect = { top: number; left: number; width: number };

export function AutocompleteField({
  value,
  onChange,
  placeholder,
  search,
  minChars = 1,
  debounceMs = 280,
  className,
  inputClassName,
  disabled,
  onSelectOption,
  onBlur,
  emptyMessage = "No matches found",
  emptyHint,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  search: (query: string) => Promise<AutocompleteOption[]> | AutocompleteOption[];
  minChars?: number;
  debounceMs?: number;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  onSelectOption?: (option: AutocompleteOption) => void;
  onBlur?: () => void;
  emptyMessage?: string;
  emptyHint?: string;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<AutocompleteOption[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [menuRect, setMenuRect] = useState<MenuRect | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateMenuPosition = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMenuRect({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  const runSearch = useCallback(
    async (query: string) => {
      if (query.trim().length < minChars) {
        setOptions([]);
        return;
      }
      setLoading(true);
      try {
        const results = await search(query);
        setOptions(results);
        setActiveIndex(results.length ? 0 : -1);
      } finally {
        setLoading(false);
      }
    },
    [minChars, search],
  );

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      if (value.trim().length < minChars) {
        setOptions([]);
        return;
      }
      void runSearch(value);
    }, debounceMs);
    return () => window.clearTimeout(timer);
  }, [value, open, debounceMs, runSearch, minChars]);

  useEffect(() => {
    if (!open) return;
    updateMenuPosition();
    window.addEventListener("scroll", updateMenuPosition, true);
    window.addEventListener("resize", updateMenuPosition);
    return () => {
      window.removeEventListener("scroll", updateMenuPosition, true);
      window.removeEventListener("resize", updateMenuPosition);
    };
  }, [open, updateMenuPosition, options.length, loading]);

  useEffect(() => {
    function onDocPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, []);

  function selectOption(option: AutocompleteOption) {
    const committed = option.value ?? option.label;
    if (onSelectOption) {
      onSelectOption(option);
    } else {
      onChange(committed);
    }
    setOpen(false);
    setOptions([]);
    inputRef.current?.focus();
  }

  const showEmpty = !loading && options.length === 0 && value.trim().length >= minChars;

  const menu =
    open && menuRect && (loading || options.length > 0 || showEmpty) ? (
      <ul
        ref={menuRef}
        id={listId}
        role="listbox"
        style={{
          position: "fixed",
          top: menuRect.top,
          left: menuRect.left,
          width: menuRect.width,
        }}
        className="z-[200] max-h-60 overflow-auto rounded-2xl border border-zinc-200/90 bg-white p-1.5 shadow-xl shadow-zinc-200/60"
      >
        {loading ? (
          <li className="px-3 py-2.5 text-xs text-zinc-500">Searching…</li>
        ) : showEmpty ? (
          <li className="px-3 py-2.5 text-xs text-zinc-500">
            <span className="block">{emptyMessage}</span>
            {emptyHint ? (
              <span className="mt-1 block text-zinc-400">{emptyHint}</span>
            ) : null}
          </li>
        ) : (
          options.map((opt, i) => (
            <li key={opt.id} role="option" aria-selected={i === activeIndex}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectOption(opt);
                }}
                className={[
                  "w-full rounded-xl px-3 py-2.5 text-left text-sm transition",
                  i === activeIndex ? "bg-zinc-100" : "hover:bg-zinc-50",
                ].join(" ")}
              >
                <span className="block font-medium text-zinc-900">{opt.label}</span>
                {opt.sublabel ? (
                  <span className="mt-0.5 block text-xs text-zinc-500">{opt.sublabel}</span>
                ) : null}
              </button>
            </li>
          ))
        )}
      </ul>
    ) : null;

  return (
    <div ref={rootRef} className={["relative", className].filter(Boolean).join(" ")}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        onFocus={() => {
          setOpen(true);
          updateMenuPosition();
        }}
        onBlur={() => {
          window.setTimeout(() => {
            if (menuRef.current?.contains(document.activeElement)) return;
            setOpen(false);
            onBlur?.();
          }, 0);
        }}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          updateMenuPosition();
        }}
        onKeyDown={(e) => {
          if (!open || !options.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, options.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && activeIndex >= 0) {
            e.preventDefault();
            const opt = options[activeIndex];
            if (opt) selectOption(opt);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className={
          inputClassName ??
          "h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm shadow-sm transition focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
        }
      />
      {mounted && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
