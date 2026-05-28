export default function Home() {
  return (
    <main className="min-h-dvh bg-zinc-50 px-5 py-10 text-zinc-900">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Trip Connect</h1>
          <p className="text-sm text-zinc-600">
            Host sign-in for managing trips.
          </p>
        </header>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-700">
            Continue to the host portal to log in or create an account.
          </p>
          <a
            href="/host"
            className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white"
          >
            Host portal
          </a>
          <p className="mt-3 text-xs text-zinc-600">
            Students join using an invite link: <span className="font-mono">/join/abc123</span>
          </p>
        </div>
      </div>
    </main>
  );
}
