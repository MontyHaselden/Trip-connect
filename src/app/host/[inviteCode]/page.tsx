"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function HostLoginPage({
  params,
}: {
  params: { inviteCode: string };
}) {
  const router = useRouter();
  const inviteCode = params.inviteCode;
  const [hostCode, setHostCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dashboardPath = `/host/${encodeURIComponent(inviteCode)}/dashboard`;

  useEffect(() => {
    let cancelled = false;
    async function checkSession() {
      try {
        const res = await fetch(`/api/host/${encodeURIComponent(inviteCode)}/me`);
        if (!cancelled && res.ok) {
          router.replace(dashboardPath);
          return;
        }
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    }
    checkSession();
    return () => {
      cancelled = true;
    };
  }, [inviteCode, router, dashboardPath]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/host/${encodeURIComponent(inviteCode)}/auth`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hostCode }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Login failed");
      router.replace(dashboardPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="min-h-dvh bg-zinc-50 px-5 py-10 text-zinc-900">
        <div className="mx-auto flex w-full max-w-md flex-col gap-5">
          <p className="text-sm text-zinc-600">Checking session…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-zinc-50 px-5 py-10 text-zinc-900">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Host login</h1>
          <p className="text-sm text-zinc-600">Enter the host code to continue.</p>
        </header>

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-zinc-200 bg-white p-5"
        >
          <label className="block">
            <span className="text-sm font-medium text-zinc-900">Host code</span>
            <input
              value={hostCode}
              onChange={(e) => setHostCode(e.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
              placeholder="Enter host code"
              autoComplete="one-time-code"
              required
            />
          </label>

          {error ? (
            <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
