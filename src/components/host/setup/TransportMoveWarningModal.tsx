"use client";

export function TransportMoveWarningModal(props: {
  open: boolean;
  reason: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { open, reason, onClose, onConfirm } = props;
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-labelledby="transport-move-warning-title"
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
      >
        <h2 id="transport-move-warning-title" className="text-base font-semibold text-zinc-900">
          Move transport divider?
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          {reason} Moving the divider may desync your plan.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Move anyway
          </button>
        </div>
      </div>
    </div>
  );
}
