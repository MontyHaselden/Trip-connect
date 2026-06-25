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

type Flow = "pick-name" | "sign-in" | "password" | "fallback";

export function StudentJoinForm(props: {
  inviteCode: string;
  tripInviteCode?: string;
  tripName: string;
  onJoined?: () => void;
}) {
  const { inviteCode, tripInviteCode = inviteCode, tripName, onJoined } = props;
  const [flow, setFlow] = useState<Flow>("pick-name");
  const [isSignIn, setIsSignIn] = useState(false);
  const [roster, setRoster] = useState<JoinRosterResponse | null>(null);
  const [rosterLoading, setRosterLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  function resetToNameList() {
    setSelectedId(null);
    setPassword("");
    setError(null);
    setFlow(isSignIn ? "sign-in" : "pick-name");
  }

  function startSignIn() {
    setIsSignIn(true);
    setSelectedId(null);
    setPassword("");
    setError(null);
    setFlow("sign-in");
  }

  function startJoin() {
    setIsSignIn(false);
    setSelectedId(null);
    setPassword("");
    setError(null);
    setFlow("pick-name");
  }

  function pickPerson(id: string) {
    setSelectedId(id);
    setPassword("");
    setError(null);
    setFlow("password");
  }

  async function onClaim(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    try {
      const endpoint =
        isSignIn
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
  const availableNames = roster?.available ?? [];
  const joinedNames = roster?.joined ?? [];
  const nameList = isSignIn ? joinedNames : availableNames;

  function roleBadge(role: string) {
    if (role === "teacher") return "Teacher";
    if (role === "helper") return "Helper";
    return null;
  }

  return (
    <main className="student-app-scroll flex h-dvh flex-col items-center justify-center overflow-y-auto overscroll-y-contain bg-[var(--student-bg)] px-6 py-10">
      <div className="student-card w-full max-w-md shadow-sm">
        <h1 className="text-xl font-bold text-[var(--student-text)]">{displayName}</h1>

        {flow === "password" && selectedPerson ? (
          <>
            <div className="mt-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[var(--student-text-muted)]">
              <span className="rounded-full bg-[var(--student-nav)] px-2 py-0.5 text-white">
                1
              </span>
              <span className="text-[var(--student-text-muted)]">Name</span>
              <span className="text-[var(--student-line)]">→</span>
              <span className="rounded-full bg-[var(--student-nav)] px-2 py-0.5 text-white">
                2
              </span>
              <span className="text-[var(--student-text)]">Password</span>
            </div>
            <p className="mt-2 text-sm text-[var(--student-text-muted)]">
              {isSignIn
                ? "Enter the password you chose when you joined."
                : "Choose a password so you can sign back in on a new phone."}
            </p>
          </>
        ) : flow === "sign-in" ? (
          <p className="mt-2 text-sm text-[var(--student-text-muted)]">
            Tap your name, then enter your password.
          </p>
        ) : flow === "fallback" ? null : (
          <p className="mt-2 text-sm text-[var(--student-text-muted)]">
            <span className="font-medium text-[var(--student-text)]">Step 1:</span> tap your name
            from the list below.
          </p>
        )}

        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

        {rosterLoading ? (
          <p className="mt-6 text-center text-sm text-[var(--student-text-muted)]">Loading names…</p>
        ) : flow === "password" && selectedPerson ? (
          <form onSubmit={onClaim} className="mt-4 space-y-3">
            <div className="rounded-xl bg-[var(--student-surface)] px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--student-text-muted)]">
                {isSignIn ? "Signing in as" : "You are"}
              </p>
              <p className="mt-1 text-lg font-semibold text-[var(--student-text)]">
                {selectedPerson.fullName}
              </p>
              <button
                type="button"
                onClick={resetToNameList}
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
                autoComplete={isSignIn ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-[var(--student-line)] bg-[var(--student-surface)] px-3"
              />
            </label>
            {!isSignIn ? (
              <p className="text-xs text-[var(--student-text-muted)]">
                At least 8 characters. You&apos;ll need this if you sign out or change phones.
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              className="student-btn-primary h-11 w-full text-sm disabled:opacity-50"
            >
              {busy ? "Loading…" : isSignIn ? "Sign in" : "Join trip"}
            </button>
          </form>
        ) : flow === "fallback" ? (
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
              onClick={() => {
                setFlow("pick-name");
                setError(null);
              }}
              className="w-full text-sm text-[var(--student-text-muted)]"
            >
              Back to name list
            </button>
          </form>
        ) : nameList.length > 0 ? (
          <div className="mt-5">
            <p className="mb-2 text-sm font-semibold text-[var(--student-text)]">
              {isSignIn ? "Who are you?" : "Tap your name"}
            </p>
            <ul className="max-h-72 space-y-2 overflow-y-auto">
              {nameList.map((person) => {
                const badge = roleBadge(person.role);
                return (
                  <li key={person.id}>
                    <button
                      type="button"
                      onClick={() => pickPerson(person.id)}
                      className="flex w-full items-center gap-3 rounded-xl border-2 border-[var(--student-line)] bg-[var(--student-surface)] px-4 py-3.5 text-left transition active:scale-[0.99] hover:border-[var(--student-nav)] hover:bg-[var(--student-nav)]/5"
                    >
                      <span className="min-w-0 flex-1 font-semibold text-[var(--student-text)]">
                        {person.fullName}
                      </span>
                      {badge ? (
                        <span className="shrink-0 text-xs text-[var(--student-text-muted)]">
                          {badge}
                        </span>
                      ) : null}
                      <span
                        className="shrink-0 rounded-lg bg-[var(--student-nav)] px-3 py-1.5 text-xs font-semibold text-white"
                        aria-hidden
                      >
                        {isSignIn ? "Sign in" : "Continue"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {isSignIn ? (
              <button
                type="button"
                onClick={startJoin}
                className="mt-4 w-full text-sm font-medium text-[var(--student-nav)]"
              >
                ← First time here? Join instead
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setFlow("fallback");
                    setError(null);
                  }}
                  className="mt-4 w-full text-sm text-[var(--student-text-muted)] underline-offset-2 hover:underline"
                >
                  My name isn&apos;t listed
                </button>
                {(roster?.joined.length ?? 0) > 0 ? (
                  <button
                    type="button"
                    onClick={startSignIn}
                    className="mt-3 w-full rounded-xl border border-[var(--student-line)] py-2.5 text-sm font-medium text-[var(--student-text-muted)] transition hover:border-[var(--student-nav)] hover:text-[var(--student-text)]"
                  >
                    Already joined? Sign in
                  </button>
                ) : null}
              </>
            )}
          </div>
        ) : isSignIn ? (
          <div className="mt-5 space-y-3">
            <p className="text-sm text-[var(--student-text-muted)]">
              Nobody has joined yet. Pick your name from the join list to get started.
            </p>
            <button
              type="button"
              onClick={startJoin}
              className="student-btn-primary h-11 w-full text-sm"
            >
              Join trip
            </button>
          </div>
        ) : availableNames.length === 0 && joinedNames.length > 0 ? (
          <div className="mt-5 space-y-3">
            <p className="text-sm text-[var(--student-text-muted)]">
              Everyone on the list has already joined. Sign in with the password you chose.
            </p>
            <button
              type="button"
              onClick={startSignIn}
              className="student-btn-primary h-11 w-full text-sm"
            >
              Sign in
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            <p className="text-sm text-[var(--student-text-muted)]">
              No names have been added yet. Ask your teacher to add you, or join manually below.
            </p>
            <button
              type="button"
              onClick={() => setFlow("fallback")}
              className="student-btn-primary h-11 w-full text-sm"
            >
              Join manually
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
