"use client";

import { useId, useRef } from "react";

import { ItemForm } from "@/components/host/itinerary/ItemForm";
import type { ItineraryItem, RosterSummary } from "@/components/host/itinerary/types";

export function ActivityItemPanel(props: {
  open: boolean;
  mode: "add" | "edit";
  item: ItineraryItem | null;
  inviteCode: string;
  dayId: string;
  roster: RosterSummary;
  countryNames?: string[];
  cityHint?: string;
  onClose: () => void;
  onSaved: (item?: ItineraryItem) => void;
  onDelete?: (id: string) => void;
  onError: (msg: string) => void;
}) {
  const {
    open,
    mode,
    item,
    inviteCode,
    dayId,
    roster,
    countryNames,
    cityHint,
    onClose,
    onSaved,
    onDelete,
    onError,
  } = props;

  const panelRef = useRef<HTMLDivElement>(null);
  const formId = useId();

  if (!open) return null;

  const btnClass =
    "inline-flex h-8 flex-1 items-center justify-center rounded-lg px-3 text-xs font-medium";

  return (
    <div
      ref={panelRef}
      className="relative flex h-[min(26rem,calc(100dvh-6rem))] w-[17rem] shrink-0 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-md"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-3 py-2">
        <h2 className="text-xs font-semibold text-zinc-900">
          {mode === "add" ? "Add activity" : "Edit"}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-medium text-zinc-500 hover:text-zinc-800"
        >
          ✕
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pt-2">
        <ItemForm
          compact
          formId={formId}
          hideFooter
          inviteCode={inviteCode}
          dayId={dayId}
          roster={roster}
          item={mode === "edit" ? item ?? undefined : undefined}
          countryNames={countryNames}
          cityHint={cityHint}
          timePickerOverlayRef={panelRef}
          onSaved={(saved) => {
            onSaved(saved);
            onClose();
          }}
          onCancel={onClose}
          onError={onError}
        />
      </div>

      <div className="shrink-0 space-y-2 border-t border-zinc-100 bg-white px-3 py-2">
        <div className="flex gap-2">
          <button
            type="submit"
            form={formId}
            className={`${btnClass} bg-zinc-900 text-white disabled:opacity-50`}
          >
            {mode === "edit" ? "Save" : "Add"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className={`${btnClass} border border-zinc-200 text-zinc-700`}
          >
            Cancel
          </button>
        </div>
        {mode === "edit" && item && onDelete ? (
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            className="text-[11px] font-medium text-red-600 hover:text-red-700"
          >
            Delete activity
          </button>
        ) : null}
      </div>
    </div>
  );
}
