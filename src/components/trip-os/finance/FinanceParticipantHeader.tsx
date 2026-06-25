"use client";

import { useEffect, useRef, useState } from "react";

export function FinanceParticipantHeader(props: {
  label: string;
  fullName: string;
  sectionLabel?: string;
  onRemoveFromSection?: () => void;
  onRemoveFromFinance?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const hasMenu = Boolean(props.onRemoveFromSection || props.onRemoveFromFinance);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const labelEl = (
    <span
      className="block w-full truncate text-center text-xs font-semibold leading-none text-zinc-700"
      title={props.fullName}
    >
      {props.label}
    </span>
  );

  if (!hasMenu) return labelEl;

  return (
    <div ref={rootRef} className="relative min-w-0 max-w-full">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="w-full min-w-0 max-w-full overflow-hidden rounded text-center hover:bg-zinc-50"
        title={`${props.fullName} — click for options`}
      >
        {labelEl}
      </button>
      {open ? (
        <div className="absolute left-1/2 top-full z-30 mt-1 min-w-[11rem] -translate-x-1/2 rounded-lg border border-zinc-200 bg-white py-1 text-left shadow-lg">
          {props.onRemoveFromSection && props.sectionLabel ? (
            <button
              type="button"
              className="block w-full px-3 py-1.5 text-left text-[10px] text-zinc-700 hover:bg-zinc-50"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                props.onRemoveFromSection?.();
              }}
            >
              Remove from {props.sectionLabel}
            </button>
          ) : null}
          {props.onRemoveFromFinance ? (
            <button
              type="button"
              className="block w-full px-3 py-1.5 text-left text-[10px] text-red-700 hover:bg-red-50"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                props.onRemoveFromFinance?.();
              }}
            >
              Remove from all finance
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
