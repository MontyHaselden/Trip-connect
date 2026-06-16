"use client";

export function AccommodationActivitiesModal(props: {
  open: boolean;
  activityCount: number;
  onClose: () => void;
  onKeep: () => void;
  onDelete: () => void;
}) {
  const { open, activityCount, onClose, onKeep, onDelete } = props;

  if (!open) return null;

  const label = activityCount === 1 ? "1 activity" : `${activityCount} activities`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold">Activities on these days</h3>
        <p className="mt-2 text-sm text-zinc-600">
          There {activityCount === 1 ? "is" : "are"} {label} on the dates for this accommodation.
          Keep them or remove them?
        </p>
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
            onClick={onDelete}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            Delete activities
          </button>
          <button
            type="button"
            onClick={onKeep}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
          >
            Keep activities
          </button>
        </div>
      </div>
    </div>
  );
}
