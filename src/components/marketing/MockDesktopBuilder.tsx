export function MockDesktopBuilder() {
  return (
    <div className="hidden w-full max-w-md rounded-xl border border-zinc-200 bg-white shadow-lg lg:block">
      <div className="flex border-b border-zinc-200 text-[10px]">
        <div className="w-2/5 border-r border-zinc-200 bg-zinc-50 p-3">
          <p className="font-semibold text-zinc-800">Trip setup wizard</p>
          <div className="mt-2 space-y-1.5">
            <div className="rounded bg-white px-2 py-1 text-zinc-600">Step 3 · Cities</div>
            <div className="rounded border border-sky-200 bg-sky-50 px-2 py-1 text-sky-800">
              Tokyo · Kyoto · Osaka
            </div>
            <p className="mt-2 text-zinc-500">Optional AI assistant</p>
            <div className="rounded border border-zinc-200 bg-white px-2 py-1.5 text-zinc-700">
              Add pre-trip meeting 22 May…
            </div>
          </div>
        </div>
        <div className="min-w-0 flex-1 p-3">
          <p className="font-semibold text-zinc-800">Live preview</p>
          <p className="text-zinc-500">Tuesday 16 July · Tokyo</p>
          <div className="mt-2 space-y-1">
            {[
              "08:30 Meet in lobby",
              "09:15 Train to Harajuku",
              "10:00 Meiji Shrine",
              "12:00 Lunch",
            ].map((row) => (
              <div
                key={row}
                className="rounded border border-zinc-100 bg-zinc-50 px-2 py-1 text-zinc-700"
              >
                {row}
              </div>
            ))}
          </div>
          <div className="mt-2 rounded bg-zinc-900 px-2 py-1 text-center text-white">
            Publish trip
          </div>
        </div>
      </div>
    </div>
  );
}
