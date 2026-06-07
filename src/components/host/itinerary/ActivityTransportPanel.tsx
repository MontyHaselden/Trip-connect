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

const inputClass =
  "h-8 w-full rounded-md border border-zinc-200 bg-white px-2 text-xs focus:border-zinc-400 focus:outline-none";

function defaultLeg(): ActivityTransportLeg {
  return {
    transportType: "train",
    leaveByTime: null,
    durationMinutes: 45,
    note: null,
  };
}

export function ActivityTransportPanel({
  value,
  onChange,
  timePickerOverlayRef,
}: {
  value: ActivityTransportDraft;
  onChange: (value: ActivityTransportDraft) => void;
  timePickerOverlayRef?: RefObject<HTMLElement | null>;
}) {
  const [direction, setDirection] = useState<"there" | "back">("there");

  const leg = direction === "there" ? value.there : value.back;

  function setLeg(next: ActivityTransportLeg | null) {
    if (direction === "there") onChange({ ...value, there: next });
    else onChange({ ...value, back: next });
  }

  function ensureLeg() {
    if (!leg) setLeg(defaultLeg());
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex rounded-lg bg-zinc-100 p-0.5">
        {(["there", "back"] as const).map((dir) => {
          const active = direction === dir;
          const filled = dir === "there" ? value.there : value.back;
          return (
            <button
              key={dir}
              type="button"
              onClick={() => {
                setDirection(dir);
                if (dir === "there" && !value.there) onChange({ ...value, there: defaultLeg() });
                if (dir === "back" && !value.back) onChange({ ...value, back: defaultLeg() });
              }}
              className={[
                "relative flex-1 rounded-md py-1 text-[11px] font-medium capitalize transition",
                active ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500",
              ].join(" ")}
            >
              {dir === "there" ? "Getting there" : "Getting back"}
              {filled ? (
                <span className="absolute top-1 right-1.5 h-1.5 w-1.5 rounded-full bg-sky-500" />
              ) : null}
            </button>
          );
        })}
      </div>

      {leg ? (
        <div className="mt-2 flex flex-1 flex-col justify-center gap-2">
          <select
            value={leg.transportType}
            onChange={(e) =>
              setLeg({ ...leg, transportType: e.target.value as TransportType })
            }
            className={inputClass}
          >
            {LOCAL_TRANSPORT_TYPES.map((type) => (
              <option key={type} value={type}>
                {transportLabel(type)}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <TimeInput
              value={leg.leaveByTime}
              onChange={(leaveByTime) => setLeg({ ...leg, leaveByTime })}
              overlayAnchorRef={timePickerOverlayRef}
              placeholder="Leave by"
              inputClassName={`${inputClass} shadow-none focus:ring-0`}
            />
            <input
              type="number"
              min={0}
              max={600}
              placeholder="Minutes"
              value={leg.durationMinutes ?? ""}
              onChange={(e) => {
                const raw = e.target.value.trim();
                setLeg({
                  ...leg,
                  durationMinutes: raw ? Math.max(0, Number(raw)) : null,
                });
              }}
              className={inputClass}
            />
          </div>
          <button
            type="button"
            onClick={() => setLeg(null)}
            className="self-start text-[10px] font-medium text-zinc-400 hover:text-zinc-600"
          >
            Clear {direction === "there" ? "there" : "back"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={ensureLeg}
          className="mt-3 flex flex-1 items-center justify-center rounded-lg border border-dashed border-zinc-200 text-[11px] text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
        >
          Add {direction === "there" ? "getting there" : "getting back"}
        </button>
      )}
    </div>
  );
}
