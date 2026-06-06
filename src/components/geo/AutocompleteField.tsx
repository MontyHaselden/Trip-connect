"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

export type AutocompleteOption = {
  id: string;
  label: string;
  sublabel?: string;
};

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
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<AutocompleteOption[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);

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
      void runSearch(value);
    }, debounceMs);
    return () => window.clearTimeout(timer);
  }, [value, open, debounceMs, runSearch]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function selectOption(option: AutocompleteOption) {
    if (onSelectOption) {
      onSelectOption(option);
    } else {
      onChange(option.label);
    }
    setOpen(false);
    setOptions([]);
  }

  return (
    <div ref={rootRef} className={["relative", className].filter(Boolean).join(" ")}>
      <input
        type="text"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
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
          "h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm focus:border-zinc-400 focus:outline-none"
        }
      />
      {open && (loading || options.length > 0) ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-lg"
        >
          {loading ? (
            <li className="px-3 py-2 text-xs text-zinc-500">Searching…</li>
          ) : (
            options.map((opt, i) => (
              <li key={opt.id} role="option" aria-selected={i === activeIndex}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectOption(opt)}
                  className={[
                    "w-full px-3 py-2 text-left text-sm",
                    i === activeIndex ? "bg-zinc-100" : "hover:bg-zinc-50",
                  ].join(" ")}
                >
                  <span className="block font-medium text-zinc-900">{opt.label}</span>
                  {opt.sublabel ? (
                    <span className="block text-xs text-zinc-500">{opt.sublabel}</span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
