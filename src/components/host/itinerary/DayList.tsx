"use client";

import type { TripDay } from "./types";

export function DayList(props: {
  days: TripDay[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { days, selectedId, onSelect } = props;

  if (!days.length) {
    return (
      <p className="text-sm text-zinc-600">No trip days yet. Generate or add one below.</p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {days.map((d) => (
        <li key={d.id}>
          <button
            type="button"
            onClick={() => onSelect(d.id)}
            className={[
              "w-full rounded-xl border px-4 py-3 text-left text-sm",
              selectedId === d.id
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50",
            ].join(" ")}
          >
            <span className="font-medium">{d.date}</span>
            <span className={selectedId === d.id ? "text-zinc-300" : "text-zinc-600"}>
              {" "}
              · {d.cityLabel}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
