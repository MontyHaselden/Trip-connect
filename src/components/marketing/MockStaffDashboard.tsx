const SIDEBAR = ["Overview", "Itinerary", "Participants", "Groups", "Finance", "Exports"] as const;

export function MockStaffDashboard() {
  return (
    <div className="hidden w-full max-w-xl lg:block">
      <p className="mb-3 text-right text-xs font-medium text-zinc-500">Staff trip dashboard</p>
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl shadow-zinc-200/50">
        <div className="flex border-b border-zinc-200 bg-zinc-50 px-4 py-2.5 text-[11px] text-zinc-500">
          <span className="font-medium text-zinc-800">Japan 2026</span>
          <span className="mx-2">·</span>
          <span>Live · 42 participants</span>
          <span className="ml-auto rounded-md bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">
            Published
          </span>
        </div>
        <div className="flex min-h-[220px] text-[11px]">
          <aside className="w-[130px] shrink-0 border-r border-zinc-200 bg-zinc-50/80 p-2">
            {SIDEBAR.map((item, i) => (
              <div
                key={item}
                className={[
                  "rounded-lg px-2 py-1.5 font-medium",
                  i === 0 ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200" : "text-zinc-600",
                ].join(" ")}
              >
                {item}
              </div>
            ))}
          </aside>
          <div className="min-w-0 flex-1 p-3">
            <p className="font-semibold text-zinc-900">Tuesday 16 July — Tokyo</p>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {[
                "8 staff · 34 students",
                "4 activity groups",
                "Finance: $128,400 tracked",
                "Last publish: 2 hours ago",
              ].map((stat) => (
                <div
                  key={stat}
                  className="rounded-lg border border-zinc-100 bg-zinc-50 px-2 py-1.5 text-zinc-700"
                >
                  {stat}
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-1">
              {["Edit day schedule", "Send update to students", "Export finance summary"].map((action) => (
                <div
                  key={action}
                  className="flex items-center justify-between rounded-lg border border-zinc-100 px-2 py-1.5 text-zinc-700"
                >
                  {action}
                  <span className="text-zinc-400">→</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
