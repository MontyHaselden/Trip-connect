"use client";

import { CalendarTile } from "./CalendarTile";

export function CalendarSheet(props: {
  open: boolean;
  onClose: () => void;
  days: Array<{ id: string; date: string; cityLabel: string; sortOrder: number }>;
  selectedDateISO: string;
  onSelectDate: (dateISO: string) => void;
}) {
  const { open, onClose, days, selectedDateISO, onSelectDate } = props;

  if (!open) return null;

  const sorted = [...days].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close calendar"
        onClick={onClose}
        className="absolute inset-0 bg-black/30"
      />
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md rounded-t-3xl bg-zinc-50 px-5 pb-[max(env(safe-area-inset-bottom),0px)] pt-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Calendar</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium"
          >
            Done
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 pb-6">
          {sorted.map((d) => (
            <CalendarTile
              key={d.id}
              dateISO={d.date}
              cityLabel={d.cityLabel}
              selected={d.date === selectedDateISO}
              onSelect={() => onSelectDate(d.date)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

