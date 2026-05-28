"use client";

export function CalendarTile(props: {
  dateISO: string;
  cityLabel: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const { dateISO, cityLabel, selected, onSelect } = props;
  const dayOfMonth = dateISO.split("-")[2] ?? "";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "w-full rounded-2xl border p-4 text-left",
        selected ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white",
      ].join(" ")}
    >
      <div className="text-xl font-semibold leading-none">{Number(dayOfMonth)}</div>
      <div className={["mt-2 text-sm", selected ? "text-zinc-100" : "text-zinc-700"].join(" ")}>
        {cityLabel}
      </div>
    </button>
  );
}

