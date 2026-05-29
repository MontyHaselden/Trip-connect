"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { enterTripAppClient } from "@/lib/client/enter-trip-app";

export default function HostLoginPage() {
  const router = useRouter();
  const params = useParams();
  const inviteCode = String(params.inviteCode ?? "");
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function checkSession() {
      try {
        const res = await fetch(`/api/host/${encodeURIComponent(inviteCode)}/me`);
        if (!cancelled && res.ok) {
          await enterTripAppClient(inviteCode);
          router.replace("/app/today");
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
  }, [inviteCode, router]);

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
          <h1 className="text-2xl font-semibold tracking-tight">Host portal</h1>
          <p className="text-sm text-zinc-600">
            Please sign in, then open this invite code.
          </p>
        </header>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-700">
            This trip uses host accounts (email + password).
          </p>
          <a
            href="/host"
            className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white"
          >
            Go to host portal
          </a>
          <p className="mt-3 text-xs text-zinc-600">
            After signing in, select your trip from the host portal to open the app.
          </p>
        </div>
      </div>
    </main>
  );
}
