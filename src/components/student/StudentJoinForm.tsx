"use client";

import { useEffect, useState } from "react";

import { redirectToStudentApp, saveTripSession } from "@/lib/mobile/trip-storage";

type JoinResponse = {
  tripId: string;
  participantId: string;
  accessToken: string;
  tripName: string;
  tripInviteCode?: string;
};

type RosterPerson = {
  id: string;
  fullName: string;
  role: string;
  hasJoined: boolean;
};

type JoinRosterResponse = {
  tripName: string;
  available: RosterPerson[];
  joined: RosterPerson[];
  error?: string;
};

export function StudentJoinForm(props: {
  inviteCode: string;
  tripInviteCode?: string;
  tripName: string;
  onJoined?: () => void;
}) {
  const { inviteCode, tripInviteCode = inviteCode, tripName, onJoined } = props;
  const [tab, setTab] = useState<"join" | "signin">("join");
  const [roster, setRoster] = useState<JoinRosterResponse | null>(null);
  const [rosterLoading, setRosterLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  const [fallbackName, setFallbackName] = useState("");
  const [fallbackPhone, setFallbackPhone] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadRoster() {
      setRosterLoading(true);
      try {
        const res = await fetch(`/api/join/${encodeURIComponent(inviteCode)}/roster`);
        const body = (await res.json().catch(() => ({}))) as JoinRosterResponse;
        if (!res.ok) throw new Error(body.error || "Could not load names");
        if (!cancelled) setRoster(body);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load names");
        }
      } finally {
        if (!cancelled) setRosterLoading(false);
      }
    }
    void loadRoster();
    return () => {
      cancelled = true;
    };
  }, [inviteCode]);

  const selectedPerson =
    roster?.available.find((p) => p.id === selectedId) ??
    roster?.joined.find((p) => p.id === selectedId);

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

  function resetSelection() {
    setSelectedId(null);
    setPassword("");
    setError(null);
  }

  async function onClaim(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    try {
      const endpoint =
        tab === "signin"
          ? `/api/join/${encodeURIComponent(inviteCode)}/login`
          : `/api/join/${encodeURIComponent(inviteCode)}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ participantId: selectedId, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not continue");
      complete(body as JoinResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not continue");
    } finally {
      setBusy(false);
    }
  }

  async function onFallbackJoin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/join/${encodeURIComponent(inviteCode)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName: fallbackName,
          phoneNumber: fallbackPhone,
          password,
        }),
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

  const displayName = roster?.tripName ?? tripName;
  const nameList = tab === "join" ? (roster?.available ?? []) : (roster?.joined ?? []);
  const hasNamePicker = nameList.length > 0;

  return (
    <main className="student-app-scroll flex h-dvh flex-col items-center justify-center overflow-y-auto overscroll-y-contain bg-[var(--student-bg)] px-6 py-10">
      <div className="student-card w-full max-w-md shadow-sm">
        <h1 className="text-xl font-bold text-[var(--student-text)]">{displayName}</h1>
        <p className="mt-1 text-sm text-[var(--student-text-muted)]">
          {tab === "join"
            ? "Tap your name, then set a password. Your itinerary loads straight away."
            : "Tap your name and enter your password."}
        </p>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setTab("join");
              resetSelection();
              setShowFallback(false);
            }}
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
            onClick={() => {
              setTab("signin");
              resetSelection();
              setShowFallback(false);
            }}
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

        {rosterLoading ? (
          <p className="mt-6 text-center text-sm text-[var(--student-text-muted)]">Loading names…</p>
        ) : selectedId && selectedPerson ? (
          <form onSubmit={onClaim} className="mt-4 space-y-3">
            <div className="rounded-xl bg-[var(--student-surface)] px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--student-text-muted)]">
                {tab === "join" ? "You are" : "Signing in as"}
              </p>
              <p className="mt-1 text-lg font-semibold text-[var(--student-text)]">
                {selectedPerson.fullName}
              </p>
              <button
                type="button"
                onClick={resetSelection}
                className="mt-2 text-sm font-medium text-[var(--student-nav)]"
              >
                Choose someone else
              </button>
            </div>
            <label className="block text-sm">
              <span className="font-medium">Password</span>
              <input
                required
                type="password"
                minLength={8}
                autoComplete={tab === "join" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-[var(--student-line)] bg-[var(--student-surface)] px-3"
              />
            </label>
            {tab === "join" ? (
              <p className="text-xs text-[var(--student-text-muted)]">
                You&apos;ll need this if you sign out or get a new phone.
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              className="student-btn-primary h-11 w-full text-sm disabled:opacity-50"
            >
              {busy ? "Loading…" : tab === "join" ? "Join trip" : "Sign in"}
            </button>
          </form>
        ) : showFallback ? (
          <form onSubmit={onFallbackJoin} className="mt-4 space-y-3">
            <p className="text-sm text-[var(--student-text-muted)]">
              Your teacher may not have added you yet. Join with your name and phone instead.
            </p>
            <label className="block text-sm">
              <span className="font-medium">Full name</span>
              <input
                required
                value={fallbackName}
                onChange={(e) => setFallbackName(e.target.value)}
                autoComplete="name"
                className="mt-1 h-11 w-full rounded-xl border border-[var(--student-line)] bg-[var(--student-surface)] px-3"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Phone number</span>
              <input
                required
                inputMode="tel"
                autoComplete="tel"
                value={fallbackPhone}
                onChange={(e) => setFallbackPhone(e.target.value)}
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
            <button
              type="submit"
              disabled={busy}
              className="student-btn-primary h-11 w-full text-sm disabled:opacity-50"
            >
              {busy ? "Joining…" : "Join trip"}
            </button>
            <button
              type="button"
              onClick={() => setShowFallback(false)}
              className="w-full text-sm text-[var(--student-text-muted)]"
            >
              Back to name list
            </button>
          </form>
        ) : hasNamePicker ? (
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium text-[var(--student-text)]">
              {tab === "join" ? "Find your name" : "Who are you?"}
            </p>
            <ul className="max-h-64 space-y-2 overflow-y-auto">
              {nameList.map((person) => (
                <li key={person.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(person.id);
                      setPassword("");
                      setError(null);
                    }}
                    className="flex w-full items-center justify-between rounded-xl border border-[var(--student-line)] bg-[var(--student-surface)] px-4 py-3 text-left transition hover:border-[var(--student-nav)]"
                  >
                    <span className="font-medium text-[var(--student-text)]">{person.fullName}</span>
                    {person.role === "teacher" ? (
                      <span className="text-xs text-[var(--student-text-muted)]">Teacher</span>
                    ) : person.role === "helper" ? (
                      <span className="text-xs text-[var(--student-text-muted)]">Helper</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
            {tab === "join" ? (
              <button
                type="button"
                onClick={() => setShowFallback(true)}
                className="mt-4 w-full text-sm text-[var(--student-text-muted)] underline-offset-2 hover:underline"
              >
                My name isn&apos;t listed
              </button>
            ) : null}
          </div>
        ) : tab === "join" ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-[var(--student-text-muted)]">
              No names have been added yet. Ask your teacher to add you, or join manually below.
            </p>
            <button
              type="button"
              onClick={() => setShowFallback(true)}
              className="student-btn-primary h-11 w-full text-sm"
            >
              Join manually
            </button>
          </div>
        ) : (
          <p className="mt-6 text-center text-sm text-[var(--student-text-muted)]">
            Nobody has joined yet. Use Join to get started.
          </p>
        )}
      </div>
    </main>
  );
}
