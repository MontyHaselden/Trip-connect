"use client";

import type { CostLineItemDraft } from "@/lib/trip-engine/cost-ledger/types";

function lineIsLinked(line: CostLineItemDraft): boolean {
  return Boolean(line.linkedStayId || line.linkedTransportLegId || line.linkedActivityId);
}

export function FinanceDeleteModal(props: {
  lines: CostLineItemDraft[];
  onFinanceOnly: () => void;
  onRemoveFromTrip: () => void;
  onCancel: () => void;
}) {
  const { lines } = props;
  const count = lines.length;
  const anyLinked = lines.some(lineIsLinked);
  const allLinked = count > 0 && lines.every(lineIsLinked);
  const preview = lines.slice(0, 5);
  const more = count - preview.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-semibold text-zinc-900">
          Delete {count === 1 ? "row" : `${count} rows`}?
        </h3>
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          This cannot be undone. Check the rows below before continuing.
        </p>

        <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-sm text-zinc-700">
          {preview.map((line) => (
            <li key={line.id} className="truncate">
              {line.description || "Untitled row"}
              {lineIsLinked(line) ? (
                <span className="ml-1 text-[10px] font-medium uppercase text-zinc-500">
                  linked
                </span>
              ) : null}
            </li>
          ))}
          {more > 0 ? <li className="text-zinc-500">…and {more} more</li> : null}
        </ul>

        {anyLinked ? (
          <div className="mt-4 space-y-2">
            <button
              type="button"
              onClick={props.onFinanceOnly}
              className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-left hover:border-violet-300 hover:bg-violet-50/50"
            >
              <p className="text-sm font-medium text-zinc-900">Remove from finance only</p>
              <p className="text-xs text-zinc-500">
                {allLinked
                  ? "Keep linked trip items on the calendar — remove these cost rows only"
                  : "Linked rows stay on the trip; unlinked rows are deleted from finance"}
              </p>
            </button>
            <button
              type="button"
              onClick={props.onRemoveFromTrip}
              className="w-full rounded-xl border border-red-200 px-4 py-3 text-left hover:bg-red-50"
            >
              <p className="text-sm font-medium text-red-800">Remove from trip</p>
              <p className="text-xs text-red-600">
                Deletes linked activities, stays, or transport and removes these finance rows
              </p>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={props.onFinanceOnly}
            className="mt-4 w-full rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-800"
          >
            Delete {count === 1 ? "row" : "selected rows"}
          </button>
        )}

        <button
          type="button"
          onClick={props.onCancel}
          className="mt-4 w-full text-center text-sm text-zinc-500 hover:text-zinc-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
