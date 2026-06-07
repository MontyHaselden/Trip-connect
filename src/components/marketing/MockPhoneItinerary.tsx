const MOCK_ITEMS = [
  { time: "08:30", title: "Meet in lobby", dot: "bg-sky-500" },
  { time: "09:15", title: "Train to Harajuku", dot: "bg-sky-500" },
  { time: "10:00", title: "Meiji Shrine", dot: "bg-violet-400" },
  { time: "12:00", title: "Lunch", dot: "bg-amber-500" },
  { time: "18:00", title: "School dinner", dot: "bg-amber-500" },
] as const;

export function MockPhoneItinerary() {
  return (
    <div className="mx-auto w-[260px] rounded-[2rem] border-[6px] border-zinc-800 bg-zinc-900 p-2 shadow-2xl shadow-zinc-300/50">
      <div className="overflow-hidden rounded-[1.4rem] bg-zinc-50">
        <div className="border-b border-zinc-200/80 px-4 py-3 text-center">
          <p className="text-[10px] font-medium text-zinc-500">Japan School Trip</p>
          <p className="mt-1 text-sm font-semibold text-zinc-900">Tuesday 16 July</p>
          <p className="text-xs font-medium text-zinc-600">Tokyo</p>
        </div>
        <div className="space-y-1 px-3 py-2">
          <p className="text-[10px] leading-snug text-zinc-600">
            28°C, light rain
          </p>
          <p className="text-[10px] text-zinc-500">6 activities · busy day</p>
        </div>
        <div className="space-y-0 px-3 pb-4">
          {MOCK_ITEMS.map((item) => (
            <div key={item.time} className="flex items-center gap-2 py-1">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.dot}`} />
              <span className="shrink-0 text-[11px] font-medium tabular-nums text-zinc-700">
                {item.time}
              </span>
              <span className="text-zinc-300">—</span>
              <span className="truncate text-[11px] text-zinc-900">{item.title}</span>
            </div>
          ))}
        </div>
        <div className="flex border-t border-zinc-200 bg-white p-1.5">
          <div className="flex flex-1 items-center justify-center rounded-lg bg-zinc-900 py-1.5 text-[10px] font-medium text-white">
            Today
          </div>
          <div className="flex flex-1 items-center justify-center py-1.5 text-[10px] font-medium text-zinc-600">
            My Trip
          </div>
        </div>
      </div>
    </div>
  );
}
