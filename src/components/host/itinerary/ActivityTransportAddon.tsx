"use client";

import { useState, type RefObject } from "react";

import { TimeInput } from "@/components/ui/TimeInput";
import {
  LOCAL_TRANSPORT_TYPES,
  transportLabel,
  type ActivityTransportDraft,
  type ActivityTransportLeg,
} from "@/lib/host/activity-transport";
import type { TransportType } from "@/lib/host/wizard/types";

function TransportLegFields({
  leg,
  onChange,
  compact,
  timePickerOverlayRef,
}: {
  leg: ActivityTransportLeg;
  onChange: (leg: ActivityTransportLeg) => void;
  compact?: boolean;
  timePickerOverlayRef?: RefObject<HTMLElement | null>;
}) {
  const inputClass = compact
    ? "mt-0.5 h-8 w-full rounded-md border border-zinc-200 bg-white px-2 text-xs focus:border-zinc-400 focus:outline-none"
    : "mt-1 h-9 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-sm focus:border-zinc-400 focus:outline-none";

  return (
    <div className={compact ? "space-y-2 rounded-md border border-zinc-100 bg-zinc-50/80 p-2" : "rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 space-y-3"}>
      <label className="block">
        <span className="text-[11px] font-medium text-zinc-600">How</span>
        <select
          value={leg.transportType}
          onChange={(e) =>
            onChange({ ...leg, transportType: e.target.value as TransportType })
          }
          className={inputClass}
        >
          {LOCAL_TRANSPORT_TYPES.map((type) => (
            <option key={type} value={type}>
              {transportLabel(type)}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[11px] font-medium text-zinc-600">Leave by</span>
          <TimeInput
            value={leg.leaveByTime}
            onChange={(leaveByTime) => onChange({ ...leg, leaveByTime })}
            overlayAnchorRef={timePickerOverlayRef}
            inputClassName={`${inputClass} shadow-none focus:ring-0`}
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-medium text-zinc-600">Mins</span>
          <input
            type="number"
            min={0}
            max={600}
            placeholder="45"
            value={leg.durationMinutes ?? ""}
            onChange={(e) => {
              const raw = e.target.value.trim();
              onChange({
                ...leg,
                durationMinutes: raw ? Math.max(0, Number(raw)) : null,
              });
            }}
            className={inputClass}
          />
        </label>
      </div>
    </div>
  );
}

export function ActivityTransportAddon({
  value,
  onChange,
  compact,
  timePickerOverlayRef,
}: {
  value: ActivityTransportDraft;
  onChange: (value: ActivityTransportDraft) => void;
  compact?: boolean;
  timePickerOverlayRef?: RefObject<HTMLElement | null>;
}) {
  const hasStructured =
    (value.there &&
      (value.there.transportType !== "unsure" ||
        value.there.leaveByTime ||
        value.there.durationMinutes)) ||
    value.back;
  const [open, setOpen] = useState(Boolean(hasStructured));

  const thereEnabled = Boolean(value.there);
  const backEnabled = Boolean(value.back);

  function defaultLeg(): ActivityTransportLeg {
    return {
      transportType: "train",
      leaveByTime: null,
      durationMinutes: null,
      note: null,
    };
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[11px] font-medium text-zinc-600 underline"
      >
        {open ? "Hide transport" : "+ Transport"}
      </button>
      {open ? (
        <div className="mt-2 space-y-2">
          <label className="flex items-center gap-1.5 text-[11px] text-zinc-700">
            <input
              type="checkbox"
              checked={thereEnabled}
              onChange={(e) =>
                onChange({
                  ...value,
                  there: e.target.checked ? value.there ?? defaultLeg() : null,
                })
              }
            />
            Getting there
          </label>
          {thereEnabled && value.there ? (
            <TransportLegFields
              leg={value.there}
              onChange={(there) => onChange({ ...value, there })}
              compact={compact}
              timePickerOverlayRef={timePickerOverlayRef}
            />
          ) : null}

          <label className="flex items-center gap-1.5 text-[11px] text-zinc-700">
            <input
              type="checkbox"
              checked={backEnabled}
              onChange={(e) =>
                onChange({
                  ...value,
                  back: e.target.checked ? value.back ?? defaultLeg() : null,
                })
              }
            />
            Getting back
          </label>
          {backEnabled && value.back ? (
            <TransportLegFields
              leg={value.back}
              onChange={(back) => onChange({ ...value, back })}
              compact={compact}
              timePickerOverlayRef={timePickerOverlayRef}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
