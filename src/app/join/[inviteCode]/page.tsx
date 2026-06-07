"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { phoneInputProps } from "@/lib/mobile/phone-input-props";
import {
  getStoredTripSession,
  redirectToStudentTrip,
  studentTripTodayPath,
} from "@/lib/mobile/trip-storage";

type JoinResponse = {
  tripId: string;
  participantId: string;
  accessToken: string;
  tripName: string;
  publishedVersion: number;
};

function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

export default function JoinTripPage() {
  const router = useRouter();
  const params = useParams();
  const inviteCode = String(params.inviteCode ?? "");

  const alreadyConnected = useMemo(() => {
    const session = getStoredTripSession();
    return Boolean(
      session?.accessToken && session.inviteCode === inviteCode,
    );
  }, [inviteCode]);

  useEffect(() => {
    const session = getStoredTripSession();
    if (session?.accessToken && session.inviteCode === inviteCode) {
      router.replace(studentTripTodayPath(session.tripId));
    }
  }, [inviteCode, router]);

  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/join/${encodeURIComponent(inviteCode)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fullName, phoneNumber }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof body?.error === "string" ? body.error : `Join failed (${res.status})`,
        );
      }

      const data = body as JoinResponse;

      storageSet("tc_trip_id", data.tripId);
      storageSet("tc_participant_id", data.participantId);
      storageSet("tc_access_token", data.accessToken);
      storageSet("tc_invite_code", inviteCode);
      storageSet("tc_joined_at", new Date().toISOString());

      redirectToStudentTrip(data.tripId, { promptInstall: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Join failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-dvh bg-zinc-50 px-5 py-10 text-zinc-900">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Join trip</h1>
          <p className="text-sm text-zinc-600">
            Enter your details to save the trip to this phone.
          </p>
        </header>

        {alreadyConnected ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <p className="text-sm text-zinc-700">
              You&apos;re already connected on this phone.
            </p>
            <button
              type="button"
              onClick={() => {
                const session = getStoredTripSession();
                router.replace(
                  session?.tripId
                    ? studentTripTodayPath(session.tripId)
                    : "/app/today",
                );
              }}
              className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50"
            >
              Open Trip
            </button>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="rounded-2xl border border-zinc-200 bg-white p-5"
          >
            <label className="block">
              <span className="text-sm font-medium text-zinc-900">
                Full name
              </span>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                placeholder="e.g. Sam Lee"
                autoComplete="name"
                required
              />
            </label>

            <label className="mt-4 block">
              <span className="text-sm font-medium text-zinc-900">
                Phone number
              </span>
              <input
                {...phoneInputProps}
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                placeholder="e.g. +64 21 123 456"
                required
              />
              <p className="mt-2 text-xs text-zinc-600">
                If you rejoin later with the same phone number, we&apos;ll reconnect
                you.
              </p>
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
              {submitting ? "Joining…" : "Join & save offline"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
