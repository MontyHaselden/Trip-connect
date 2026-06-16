"use client";

export function AccommodationLocationModal(props: {
  open: boolean;
  currentLocation: string;
  proposedLocation: string;
  draftLocation: string;
  onDraftChange: (value: string) => void;
  onClose: () => void;
  onKeep: () => void;
  onChange: () => void;
}) {
  const {
    open,
    currentLocation,
    proposedLocation,
    draftLocation,
    onDraftChange,
    onClose,
    onKeep,
    onChange,
  } = props;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold">Change day location?</h3>
        <p className="mt-2 text-sm text-zinc-600">
          This day already has a location. The accommodation suggests a different one for the
          calendar.
        </p>

        <div className="mt-4 space-y-3 rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-3 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Current location
            </p>
            <p className="mt-1 font-medium text-zinc-900">{currentLocation}</p>
          </div>
        </div>

        <label className="mt-4 block text-sm">
          <span className="font-medium text-zinc-700">Change day location to</span>
          <input
            value={draftLocation}
            onChange={(e) => onDraftChange(e.target.value)}
            placeholder={proposedLocation}
            className="mt-1.5 h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm"
          />
          <p className="mt-1 text-xs text-zinc-500">
            Suggested from accommodation: {proposedLocation}
          </p>
        </label>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-zinc-600"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onKeep}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            No, keep {currentLocation}
          </button>
          <button
            type="button"
            disabled={!draftLocation.trim()}
            onClick={onChange}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Change location
          </button>
        </div>
      </div>
    </div>
  );
}
