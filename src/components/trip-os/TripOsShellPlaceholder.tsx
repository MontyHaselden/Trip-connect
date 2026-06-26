"use client";

/** Instant paint while the heavy Trip OS bundle downloads — no trip-engine imports. */
export function TripOsShellPlaceholder() {
  return (
    <div className="trip-os flex h-dvh min-h-0 flex-col bg-white">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="flex w-52 shrink-0 flex-col bg-[#2d1f4e] px-3 py-4 text-white">
          <p className="mb-6 px-2 text-sm font-semibold tracking-wide text-white/90">TRIP OS</p>
          <div className="space-y-1">
            {["Overview", "Locations", "Transport", "Accommodation"].map((label) => (
              <div
                key={label}
                className="rounded-lg px-3 py-2 text-sm text-white/70"
              >
                {label}
              </div>
            ))}
          </div>
          <p className="mt-auto px-2 text-xs text-white/50">← All trips</p>
        </aside>
        <main className="flex min-h-0 flex-1 flex-col bg-white p-6">
          <p className="text-sm font-medium text-zinc-800">Opening trip workspace…</p>
          <p className="mt-1 text-xs text-zinc-500">Loading application code (first visit can take a few seconds).</p>
          <div className="mt-4 h-2 max-w-md overflow-hidden rounded-full bg-zinc-100">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-violet-400" />
          </div>
        </main>
      </div>
    </div>
  );
}
