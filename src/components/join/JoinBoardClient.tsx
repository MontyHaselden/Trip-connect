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
const QR_SIZE = 520;

function joinUrl(inviteCode: string) {
  if (typeof window === "undefined") return studentAppPath(inviteCode);
  return `${window.location.origin}${studentAppPath(inviteCode)}`;
}

function roleLabel(role: string) {
  if (role === "teacher") return "Teacher";
  if (role === "helper") return "Helper";
  return null;
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
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
      width: QR_SIZE,
      margin: 2,
      color: { dark: "#18181b", light: "#ffffff" },
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
    <div className="flex min-h-dvh flex-col bg-zinc-100 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white px-6 py-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-700">
          Join trip
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-zinc-900 md:text-5xl">
          {displayName}
        </h1>
        {total > 0 ? (
          <div className="mx-auto mt-6 max-w-md">
            <div className="flex items-baseline justify-between gap-4 text-sm text-zinc-600">
              <span>
                <span className="text-2xl font-semibold text-emerald-700">{joinedCount}</span> of{" "}
                <span className="text-2xl font-semibold text-zinc-900">{total}</span> joined
              </span>
              <span className="font-medium tabular-nums">{progress}%</span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-zinc-200">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : null}
      </header>

      <div className="grid flex-1 gap-5 px-4 py-6 lg:grid-cols-[minmax(11rem,14rem)_minmax(0,1fr)_minmax(11rem,14rem)] lg:px-6 xl:grid-cols-[minmax(12rem,16rem)_minmax(0,1fr)_minmax(12rem,16rem)]">
        <section className="flex min-h-0 flex-col rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-200/80 text-xs">
              …
            </span>
            <span className="min-w-0 truncate">Still to join</span>
            <span className="ml-auto shrink-0 text-xl font-bold tabular-nums text-amber-950">
              {waiting.length}
            </span>
          </h2>
          <ul className="mt-3 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
            {waitingSorted.length === 0 ? (
              <li className="text-xs leading-relaxed text-amber-800/80">
                {total === 0 ? "No students on the roster yet." : "Everyone has joined!"}
              </li>
            ) : (
              waitingSorted.map((person) => (
                <li
                  key={person.id}
                  className="rounded-lg border border-amber-200/80 bg-white px-2.5 py-2"
                  title={person.fullName}
                >
                  <p className="truncate text-sm font-medium text-zinc-900">
                    {firstName(person.fullName)}
                  </p>
                  {roleLabel(person.role) ? (
                    <p className="truncate text-[10px] text-amber-800/70">{roleLabel(person.role)}</p>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="flex flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm lg:p-8">
          <p className="text-center text-xl font-semibold text-zinc-900">Scan to join on your phone</p>
          <p className="mt-1 text-center text-sm text-zinc-600">
            Tap your name, then set a password
          </p>
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt={`QR code to join ${displayName}`}
              className="mt-6 w-full max-w-[min(520px,72vw)] rounded-xl"
            />
          ) : (
            <div className="mt-6 aspect-square w-full max-w-[min(520px,72vw)] animate-pulse rounded-xl bg-zinc-100" />
          )}
          <p className="mt-5 max-w-lg break-all text-center font-mono text-[10px] text-zinc-400">
            {url}
          </p>
        </section>

        <section className="flex min-h-0 flex-col rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-200/80 text-xs">
              ✓
            </span>
            <span className="min-w-0 truncate">Joined</span>
            <span className="ml-auto shrink-0 text-xl font-bold tabular-nums text-emerald-950">
              {joinedCount}
            </span>
          </h2>
          <ul className="mt-3 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
            {joinedSorted.length === 0 ? (
              <li className="text-xs leading-relaxed text-emerald-800/80">Nobody yet — be the first!</li>
            ) : (
              joinedSorted.map((person) => (
                <li
                  key={person.id}
                  className="rounded-lg border border-emerald-200/80 bg-white px-2.5 py-2"
                  title={person.fullName}
                >
                  <p className="truncate text-sm font-medium text-zinc-900">
                    {firstName(person.fullName)}
                  </p>
                  {roleLabel(person.role) ? (
                    <p className="truncate text-[10px] text-emerald-800/70">
                      {roleLabel(person.role)}
                    </p>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
