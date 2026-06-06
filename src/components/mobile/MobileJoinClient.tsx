"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { InstallGate } from "@/components/mobile/InstallGate";
import {
  getStoredTripSession,
  saveTripSession,
} from "@/lib/mobile/trip-storage";

type JoinResponse = {
  tripId: string;
  participantId: string;
  accessToken: string;
  tripName: string;
};

export function MobileJoinClient(props: {
  inviteCode: string;
  tripName: string;
}) {
  const { inviteCode, tripName } = props;
  const router = useRouter();
  const [gateReady, setGateReady] = useState(false);
  const [tab, setTab] = useState<"join" | "signin">("join");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const manifestHref = `/api/manifest?name=${encodeURIComponent(tripName)}&startUrl=${encodeURIComponent(`/mobile/join/${inviteCode}`)}`;

  useEffect(() => {
    const session = getStoredTripSession();
    if (session && session.inviteCode === inviteCode) {
      router.replace(`/trip/${session.tripId}/today`);
    }
  }, [inviteCode, router]);

  async function onJoin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/join/${encodeURIComponent(inviteCode)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fullName, phoneNumber, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Join failed");
      const data = body as JoinResponse;
      saveTripSession({
        tripId: data.tripId,
        participantId: data.participantId,
        accessToken: data.accessToken,
        inviteCode,
      });
      router.replace(`/trip/${data.tripId}/today`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Join failed");
    } finally {
      setBusy(false);
    }
  }

  async function onSignIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/join/${encodeURIComponent(inviteCode)}/login`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ phoneNumber, password }),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Sign in failed");
      const data = body as JoinResponse;
      saveTripSession({
        tripId: data.tripId,
        participantId: data.participantId,
        accessToken: data.accessToken,
        inviteCode,
      });
      router.replace(`/trip/${data.tripId}/today`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  if (!gateReady) {
    return (
      <InstallGate
        tripName={tripName}
        manifestHref={manifestHref}
        onReady={() => setGateReady(true)}
      >
        <div />
      </InstallGate>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">{tripName}</h1>
        <p className="mt-1 text-sm text-zinc-600">Join your school trip app.</p>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setTab("join")}
            className={[
              "flex-1 rounded-lg py-2 text-sm font-medium",
              tab === "join" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700",
            ].join(" ")}
          >
            Join
          </button>
          <button
            type="button"
            onClick={() => setTab("signin")}
            className={[
              "flex-1 rounded-lg py-2 text-sm font-medium",
              tab === "signin" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700",
            ].join(" ")}
          >
            Sign in
          </button>
        </div>

        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

        {tab === "join" ? (
          <form onSubmit={onJoin} className="mt-4 space-y-3">
            <label className="block text-sm">
              <span className="font-medium">Full name</span>
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-zinc-200 px-3"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Phone number</span>
              <input
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-zinc-200 px-3"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Password</span>
              <input
                required
                type="password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-zinc-200 px-3"
              />
            </label>
            <p className="text-xs text-zinc-500">
              Password is only needed if you sign out or reinstall the app.
            </p>
            <button
              type="submit"
              disabled={busy}
              className="h-11 w-full rounded-xl bg-zinc-900 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? "Joining…" : "Join trip"}
            </button>
          </form>
        ) : (
          <form onSubmit={onSignIn} className="mt-4 space-y-3">
            <label className="block text-sm">
              <span className="font-medium">Phone number</span>
              <input
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-zinc-200 px-3"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Password</span>
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-zinc-200 px-3"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="h-11 w-full rounded-xl bg-zinc-900 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
