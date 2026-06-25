const TIMELINE = [
  { time: "8:30 AM", title: "Meet in hotel lobby", category: "Meeting", tint: "bg-rose-50/90" },
  { time: "9:15 AM", title: "Train to Asakusa", category: "Travel", tint: "bg-sky-50/90" },
  { time: "10:00 AM", title: "Senso-ji Temple visit", category: "Activity", tint: "bg-violet-50/80" },
  { time: "12:30 PM", title: "Lunch", category: "Meal", tint: "bg-amber-50/90" },
  { time: "3:00 PM", title: "Group check-in", category: "School", tint: "bg-indigo-50/80" },
] as const;

function CategoryDot({ category }: { category: string }) {
  const color =
    category === "Travel"
      ? "bg-sky-500"
      : category === "Activity"
        ? "bg-violet-500"
        : category === "Meal"
          ? "bg-amber-500"
          : category === "School"
            ? "bg-indigo-500"
            : "bg-rose-400";
  return <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} aria-hidden />;
}

export function MockPhoneItinerary() {
  return (
    <div className="relative mx-auto w-[280px]">
      <p className="mb-3 text-center text-xs font-medium text-zinc-500">What students see on their phones</p>
      <div className="rounded-[2.5rem] border-[7px] border-zinc-800 bg-zinc-800 p-[6px] shadow-2xl shadow-zinc-400/30">
        <div className="overflow-hidden rounded-[2rem] bg-[#f8f9fb]">
          {/* Status bar */}
          <div className="flex items-center justify-between px-5 pt-2.5 text-[10px] font-medium text-zinc-500">
            <span>9:41</span>
            <div className="mx-auto h-[22px] w-[88px] rounded-full bg-zinc-900" aria-hidden />
            <span className="tabular-nums">100%</span>
          </div>

          {/* Trip header */}
          <div className="border-b border-zinc-200/80 px-4 pb-3 pt-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-sky-700">
                  Japan 2026
                </p>
                <h3 className="mt-0.5 text-base font-bold tracking-tight text-zinc-900">Today — Tokyo</h3>
                <p className="text-xs text-zinc-500">Tuesday 16 July</p>
              </div>
              <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-medium text-emerald-800 ring-1 ring-emerald-200/80">
                Latest itinerary
              </span>
            </div>
            <p className="mt-2 text-[10px] text-zinc-600">28°C · light rain · updated 2 hours ago</p>
          </div>

          {/* Emergency shortcut */}
          <div className="mx-3 mt-3 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-3 py-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-red-900">Emergency card</p>
              <p className="text-[10px] text-red-800/90">Contacts, hotel &amp; phrases</p>
            </div>
            <span className="rounded-lg bg-red-600 px-2 py-1 text-[10px] font-semibold text-white">Help</span>
          </div>

          {/* Timeline */}
          <div className="mx-3 mt-3 overflow-hidden rounded-xl border border-zinc-200/90 bg-white shadow-sm">
            {TIMELINE.map((item, i) => (
              <div
                key={item.time}
                className={[
                  "flex flex-col gap-0.5 border-b border-zinc-100 px-3 py-2.5 last:border-b-0",
                  item.tint,
                  i === 0 ? "ring-2 ring-inset ring-red-100" : "",
                ].join(" ")}
              >
                <div className="flex items-center gap-2">
                  <CategoryDot category={item.category} />
                  <span className="text-[11px] font-semibold tabular-nums text-zinc-600">{item.time}</span>
                  <span className="text-[9px] font-medium uppercase tracking-wide text-zinc-400">
                    {item.category}
                  </span>
                </div>
                <p className="pl-4 text-[13px] font-semibold leading-snug text-zinc-900">{item.title}</p>
              </div>
            ))}
          </div>

          {/* Tonight accommodation */}
          <div className="mx-3 mt-3 rounded-xl border border-teal-200/80 bg-teal-50/90 px-3 py-2.5">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-teal-700">Tonight</p>
            <p className="mt-0.5 text-[13px] font-semibold text-zinc-900">Villa Fontaine Grand Haneda</p>
            <p className="text-[10px] text-zinc-600">Room 412 · Group A</p>
          </div>

          {/* Bottom nav */}
          <div className="mt-4 px-3 pb-4">
            <div className="flex items-center gap-1 rounded-full bg-white p-1 shadow-sm ring-1 ring-zinc-200/80">
              <div className="flex flex-1 items-center justify-center rounded-full bg-zinc-900 py-2.5 text-xs font-semibold text-white">
                Today
              </div>
              <div className="flex flex-1 items-center justify-center py-2.5 text-xs font-semibold text-zinc-500">
                My Trip
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
