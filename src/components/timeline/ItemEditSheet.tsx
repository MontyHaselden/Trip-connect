"use client";

import { ItemForm } from "@/components/host/itinerary/ItemForm";
import type { ItineraryItem, RosterSummary } from "@/components/host/itinerary/types";

export function ItemEditSheet(props: {
  open: boolean;
  item: ItineraryItem | null;
  inviteCode: string;
  dayId: string;
  roster: RosterSummary;
  onClose: () => void;
  onSaved: () => void;
  onDelete?: (id: string) => void;
  onError: (msg: string) => void;
}) {
  const { open, item, inviteCode, dayId, roster, onClose, onSaved, onDelete, onError } =
    props;

  if (!open || !item) return null;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col justify-end">
      <div role="presentation" onClick={onClose} className="absolute inset-0 bg-black/30" />
      <div className="relative max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-white px-4 pb-6 pt-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Edit item</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium text-zinc-600"
          >
            Close
          </button>
        </div>
        <ItemForm
          inviteCode={inviteCode}
          dayId={dayId}
          roster={roster}
          item={item}
          hideTimeFields
          onSaved={() => {
            onSaved();
            onClose();
          }}
          onCancel={onClose}
          onError={onError}
        />
        {onDelete ? (
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            className="mt-4 text-sm font-medium text-red-700"
          >
            Delete item
          </button>
        ) : null}
      </div>
    </div>
  );
}
