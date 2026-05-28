export default function TodayStubPage() {
  return (
    <main className="flex flex-col gap-4 py-6">
        <h1 className="text-2xl font-semibold tracking-tight">Today</h1>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-700">
            You’re connected. Trip details will appear here in Phase 5.
          </p>
          <p className="mt-3 rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-800">
            Trip saved for offline access.
          </p>
        </div>
    </main>
  );
}

