import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-dvh bg-zinc-50 px-5 py-10 text-zinc-900">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Trip Connect</h1>
          <p className="text-sm text-zinc-600">
            Offline-ready school trip booklet (MVP).
          </p>
        </header>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-700">
            Join a trip using an invite link like:
          </p>
          <p className="mt-2 rounded-lg bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-800">
            /join/abc123
          </p>
          <div className="mt-4 flex gap-3">
            <Link
              href="/join/abc123"
              className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white"
            >
              Try join demo
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
