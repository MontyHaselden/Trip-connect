"use client";

import { useState } from "react";

import { phoneInputProps } from "@/lib/mobile/phone-input-props";
import { redirectToStudentApp, saveTripSession } from "@/lib/mobile/trip-storage";

type JoinResponse = {
  tripId: string;
  participantId: string;
  accessToken: string;
  tripName: string;
  tripInviteCode?: string;
};

export function StudentJoinForm(props: {
  inviteCode: string;
  tripInviteCode?: string;
  tripName: string;
  onJoined?: () => void;
}) {
  const { inviteCode, tripInviteCode = inviteCode, tripName, onJoined } = props;
  const [tab, setTab] = useState<"join" | "signin">("join");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function complete(data: JoinResponse) {
    saveTripSession({
      tripId: data.tripId,
      participantId: data.participantId,
      accessToken: data.accessToken,
      inviteCode: data.tripInviteCode ?? tripInviteCode,
    });
    if (onJoined) {
      onJoined();
      return;
    }
    redirectToStudentApp(inviteCode, { promptInstall: true });
  }

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
      complete(body as JoinResponse);
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
      complete(body as JoinResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="student-app-scroll flex h-dvh flex-col items-center justify-center overflow-y-auto overscroll-y-contain bg-[var(--student-bg)] px-6 py-10">
      <div className="student-card w-full max-w-md shadow-sm">
        <h1 className="text-xl font-bold text-[var(--student-text)]">{tripName}</h1>
        <p className="mt-1 text-sm text-[var(--student-text-muted)]">
          Join your school trip. This link is your app — add it to your home screen
          when you&apos;re ready.
        </p>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setTab("join")}
            className={[
              "flex-1 rounded-lg py-2 text-sm font-medium",
              tab === "join"
                ? "bg-[var(--student-nav)] text-white"
                : "bg-[var(--student-line)]/50 text-[var(--student-text-muted)]",
            ].join(" ")}
          >
            Join
          </button>
          <button
            type="button"
            onClick={() => setTab("signin")}
            className={[
              "flex-1 rounded-lg py-2 text-sm font-medium",
              tab === "signin"
                ? "bg-[var(--student-nav)] text-white"
                : "bg-[var(--student-line)]/50 text-[var(--student-text-muted)]",
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
                autoComplete="name"
                className="mt-1 h-11 w-full rounded-xl border border-[var(--student-line)] bg-[var(--student-surface)] px-3"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Phone number</span>
              <input
                required
                {...phoneInputProps}
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="e.g. +64 21 123 456"
                className="mt-1 h-11 w-full rounded-xl border border-[var(--student-line)] bg-[var(--student-surface)] px-3"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Password</span>
              <input
                required
                type="password"
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-[var(--student-line)] bg-[var(--student-surface)] px-3"
              />
            </label>
            <p className="text-xs text-[var(--student-text-muted)]">
              You&apos;ll need this password if you sign out or reinstall the app.
            </p>
            <button
              type="submit"
              disabled={busy}
              className="student-btn-primary h-11 w-full text-sm disabled:opacity-50"
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
                {...phoneInputProps}
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="e.g. +64 21 123 456"
                className="mt-1 h-11 w-full rounded-xl border border-[var(--student-line)] bg-[var(--student-surface)] px-3"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Password</span>
              <input
                required
                type="password"
                minLength={8}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-[var(--student-line)] bg-[var(--student-surface)] px-3"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="student-btn-primary h-11 w-full text-sm disabled:opacity-50"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
