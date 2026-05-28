"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type TripsResponse = {
  trips: Array<{
    id: string;
    inviteCode: string;
    name: string;
    schoolName: string;
    startDate: string;
    endDate: string;
    publishedVersion: number;
  }>;
};

export default function HostPortalPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Account fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [role, setRole] = useState<"teacher" | "helper" | "host">("teacher");
  const [defaultCountryCallingCode, setDefaultCountryCallingCode] = useState("NZ");

  // Trip create fields
  const tzDefault = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  }, []);
  const [tripName, setTripName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [timezone, setTimezone] = useState(tzDefault);

  const [trips, setTrips] = useState<TripsResponse["trips"] | null>(null);
  const [loadingTrips, setLoadingTrips] = useState(true);

  async function loadTrips() {
    setLoadingTrips(true);
    try {
      const res = await fetch("/api/host/trips");
      const body = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setTrips(null);
        return;
      }
      if (!res.ok) throw new Error(body?.error || "Failed to load trips");
      setTrips((body as TripsResponse).trips ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load trips");
    } finally {
      setLoadingTrips(false);
    }
  }

  useEffect(() => {
    loadTrips();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const endpoint =
        mode === "login" ? "/api/host/auth/login" : "/api/host/auth/signup";
      const payload =
        mode === "login"
          ? { email, password }
          : {
              email,
              password,
              fullName,
              phoneNumber,
              defaultCountryCallingCode,
              role,
            };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Auth failed");
      await loadTrips();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setBusy(false);
    }
  }

  async function onCreateTrip(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/host/trips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: tripName,
          schoolName,
          startDate,
          endDate,
          timezone,
          defaultCountryCallingCode,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Create trip failed");
      router.replace(`/host/${encodeURIComponent(body.inviteCode)}/dashboard`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create trip failed");
    } finally {
      setBusy(false);
    }
  }

  const signedIn = Array.isArray(trips);

  return (
    <main className="min-h-dvh bg-zinc-50 px-5 py-10 text-zinc-900">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Host portal</h1>
          <p className="text-sm text-zinc-600">
            Sign in to manage a trip, or create a new one.
          </p>
        </header>

        {error ? (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        {!signedIn ? (
          <section className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={[
                  "h-10 flex-1 rounded-xl border px-3 text-sm font-medium",
                  mode === "login"
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white text-zinc-900",
                ].join(" ")}
              >
                Log in
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={[
                  "h-10 flex-1 rounded-xl border px-3 text-sm font-medium",
                  mode === "signup"
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white text-zinc-900",
                ].join(" ")}
              >
                Create account
              </button>
            </div>

            <form onSubmit={onAuthSubmit} className="mt-4 flex flex-col gap-3">
              <label className="block">
                <span className="text-sm font-medium text-zinc-900">Email</span>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-2 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                  autoComplete="email"
                  inputMode="email"
                  required
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-zinc-900">Password</span>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-2 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  required
                />
              </label>

              {mode === "signup" ? (
                <>
                  <label className="block">
                    <span className="text-sm font-medium text-zinc-900">
                      Full name
                    </span>
                    <input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="mt-2 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                      autoComplete="name"
                      required
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-zinc-900">
                      Phone number
                    </span>
                    <input
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="mt-2 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="e.g. +64 21 123 456"
                      required
                    />
                    <p className="mt-2 text-xs text-zinc-600">
                      Used for contact and recovery. Stored in E.164 format.
                    </p>
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="text-sm font-medium text-zinc-900">
                        Country code
                      </span>
                      <input
                        value={defaultCountryCallingCode}
                        onChange={(e) =>
                          setDefaultCountryCallingCode(e.target.value.toUpperCase())
                        }
                        className="mt-2 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                        placeholder="NZ"
                        maxLength={2}
                        required
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-medium text-zinc-900">Role</span>
                      <select
                        value={role}
                        onChange={(e) =>
                          setRole(e.target.value as "teacher" | "helper" | "host")
                        }
                        className="mt-2 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                      >
                        <option value="teacher">Teacher</option>
                        <option value="helper">Helper</option>
                        <option value="host">Host</option>
                      </select>
                    </label>
                  </div>
                </>
              ) : null}

              <button
                type="submit"
                disabled={busy}
                className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50"
              >
                {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
              </button>
            </form>
          </section>
        ) : (
          <>
            <section className="rounded-2xl border border-zinc-200 bg-white p-5">
              <h2 className="text-base font-semibold">Your trips</h2>
              {loadingTrips ? (
                <p className="mt-2 text-sm text-zinc-600">Loading…</p>
              ) : trips.length ? (
                <div className="mt-3 flex flex-col gap-2">
                  {trips.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() =>
                        router.replace(
                          `/host/${encodeURIComponent(t.inviteCode)}/dashboard`,
                        )
                      }
                      className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left"
                    >
                      <div>
                        <div className="text-sm font-medium">{t.name}</div>
                        <div className="text-xs text-zinc-600">
                          {t.schoolName} · {t.startDate} → {t.endDate}
                        </div>
                      </div>
                      <div className="text-xs text-zinc-500">
                        {t.publishedVersion ? `v${t.publishedVersion}` : "v0"}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-zinc-600">
                  No trips yet. Create your first trip below.
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white p-5">
              <h2 className="text-base font-semibold">Create a trip</h2>
              <form onSubmit={onCreateTrip} className="mt-3 flex flex-col gap-3">
                <label className="block">
                  <span className="text-sm font-medium text-zinc-900">Trip name</span>
                  <input
                    value={tripName}
                    onChange={(e) => setTripName(e.target.value)}
                    className="mt-2 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                    placeholder="e.g. Japan School Trip"
                    required
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-zinc-900">School name</span>
                  <input
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    className="mt-2 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                    placeholder="e.g. Example School"
                    required
                  />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-sm font-medium text-zinc-900">Start</span>
                    <input
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="mt-2 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                      type="date"
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-zinc-900">End</span>
                    <input
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="mt-2 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                      type="date"
                      required
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="text-sm font-medium text-zinc-900">Timezone</span>
                  <input
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="mt-2 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                    placeholder="e.g. Pacific/Auckland"
                    required
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-zinc-900">
                    Default calling code
                  </span>
                  <input
                    value={defaultCountryCallingCode}
                    onChange={(e) =>
                      setDefaultCountryCallingCode(e.target.value.toUpperCase())
                    }
                    className="mt-2 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                    placeholder="NZ"
                    maxLength={2}
                    required
                  />
                </label>

                <button
                  type="submit"
                  disabled={busy}
                  className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50"
                >
                  {busy ? "Creating…" : "Create trip"}
                </button>
              </form>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

