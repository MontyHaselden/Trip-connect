"use client";

import QRCode from "qrcode";
import { useCallback, useEffect, useMemo, useState } from "react";

import { studentAppPath } from "@/lib/mobile/student-app-paths";

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

const POLL_MS = 4000;

function joinUrl(inviteCode: string) {
  if (typeof window === "undefined") return studentAppPath(inviteCode);
  return `${window.location.origin}${studentAppPath(inviteCode)}`;
}

function roleLabel(role: string) {
  if (role === "teacher") return "Teacher";
  if (role === "helper") return "Helper";
  return null;
}

export function JoinBoardClient(props: { inviteCode: string; tripName: string }) {
  const { inviteCode, tripName } = props;
  const [roster, setRoster] = useState<JoinRosterResponse | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [url, setUrl] = useState(() => studentAppPath(inviteCode));

  const loadRoster = useCallback(async () => {
    try {
      const res = await fetch(`/api/join/${encodeURIComponent(inviteCode)}/roster`);
      const body = (await res.json().catch(() => ({}))) as JoinRosterResponse;
      if (res.ok) setRoster(body);
    } catch {
      // keep last good snapshot
    }
  }, [inviteCode]);

  useEffect(() => {
    const nextUrl = joinUrl(inviteCode);
    setUrl(nextUrl);
    void QRCode.toDataURL(nextUrl, {
      width: 320,
      margin: 2,
      color: { dark: "#0f172a", light: "#ffffff" },
    }).then(setQrDataUrl);
  }, [inviteCode]);

  useEffect(() => {
    void loadRoster();
    const id = window.setInterval(() => void loadRoster(), POLL_MS);
    return () => window.clearInterval(id);
  }, [loadRoster]);

  const displayName = roster?.tripName ?? tripName;
  const joined = roster?.joined ?? [];
  const waiting = roster?.available ?? [];
  const total = joined.length + waiting.length;
  const joinedCount = joined.length;
  const progress = total > 0 ? Math.round((joinedCount / total) * 100) : 0;

  const waitingSorted = useMemo(
    () => [...waiting].sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [waiting],
  );
  const joinedSorted = useMemo(
    () => [...joined].sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [joined],
  );

  return (
    <div className="flex min-h-dvh flex-col bg-slate-950 text-white">
      <header className="border-b border-white/10 px-8 py-6">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-violet-300">
          Join trip
        </p>
        <h1 className="mt-1 text-4xl font-bold tracking-tight md:text-5xl">{displayName}</h1>
        {total > 0 ? (
          <div className="mt-5 max-w-xl">
            <div className="flex items-baseline justify-between gap-4 text-sm text-slate-300">
              <span>
                <span className="text-2xl font-semibold text-white">{joinedCount}</span> of{" "}
                <span className="text-2xl font-semibold text-white">{total}</span> joined
              </span>
              <span>{progress}%</span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : null}
      </header>

      <div className="grid flex-1 gap-8 px-8 py-8 lg:grid-cols-[minmax(280px,360px)_1fr]">
        <section className="flex flex-col items-center rounded-3xl border border-white/10 bg-white p-8 text-slate-900 shadow-2xl">
          <p className="text-center text-lg font-semibold">Scan to join on your phone</p>
          <p className="mt-1 text-center text-sm text-slate-600">
            Tap your name, then set a password
          </p>
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt={`QR code to join ${displayName}`}
              className="mt-6 w-full max-w-[280px] rounded-xl"
            />
          ) : (
            <div className="mt-6 aspect-square w-full max-w-[280px] animate-pulse rounded-xl bg-slate-100" />
          )}
          <p className="mt-6 break-all text-center font-mono text-xs text-slate-500">{url}</p>
        </section>

        <section className="grid min-h-0 gap-6 md:grid-cols-2">
          <div className="flex min-h-0 flex-col rounded-3xl border border-emerald-500/30 bg-emerald-950/40 p-6">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-emerald-200">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-sm">
                ✓
              </span>
              Joined
              <span className="ml-auto text-3xl font-bold text-white">{joinedCount}</span>
            </h2>
            <ul className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {joinedSorted.length === 0 ? (
                <li className="text-sm text-emerald-200/70">Nobody yet — be the first!</li>
              ) : (
                joinedSorted.map((person) => (
                  <li
                    key={person.id}
                    className="flex items-center justify-between rounded-xl bg-emerald-500/10 px-4 py-3"
                  >
                    <span className="text-lg font-medium">{person.fullName}</span>
                    {roleLabel(person.role) ? (
                      <span className="text-xs text-emerald-200/80">{roleLabel(person.role)}</span>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="flex min-h-0 flex-col rounded-3xl border border-amber-500/30 bg-amber-950/30 p-6">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-amber-200">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 text-sm">
                …
              </span>
              Still to join
              <span className="ml-auto text-3xl font-bold text-white">{waiting.length}</span>
            </h2>
            <ul className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {waitingSorted.length === 0 ? (
                <li className="text-sm text-amber-200/70">
                  {total === 0 ? "No students on the roster yet." : "Everyone has joined!"}
                </li>
              ) : (
                waitingSorted.map((person) => (
                  <li
                    key={person.id}
                    className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3"
                  >
                    <span className="text-lg font-medium">{person.fullName}</span>
                    {roleLabel(person.role) ? (
                      <span className="text-xs text-amber-200/80">{roleLabel(person.role)}</span>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
