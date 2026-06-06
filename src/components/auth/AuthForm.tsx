"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { MarketingShell } from "@/components/marketing/MarketingShell";

export function AuthForm(props: { mode: "login" | "signup" }) {
  const { mode } = props;
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [role, setRole] = useState<"teacher" | "helper" | "host">("teacher");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
      const payload =
        mode === "login"
          ? { email, password }
          : {
              email,
              password,
              fullName,
              phoneNumber,
              defaultCountryCallingCode: "NZ",
              role,
            };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Authentication failed");
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <MarketingShell>
      <div className="mx-auto flex max-w-md flex-col px-5 py-16">
        <h1 className="text-2xl font-semibold">
          {mode === "login" ? "Log in" : "Create host account"}
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          {mode === "login"
            ? "Access your trip dashboard."
            : "Start building school trip itineraries."}
        </p>
        {error ? (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
        ) : null}
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {mode === "signup" ? (
            <>
              <label className="block">
                <span className="text-sm font-medium">Full name</span>
                <input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Phone</span>
                <input
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Role</span>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as typeof role)}
                  className="mt-1 h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
                >
                  <option value="teacher">Teacher</option>
                  <option value="helper">Helper</option>
                  <option value="host">Trip coordinator</option>
                </select>
              </label>
            </>
          ) : null}
          <label className="block">
            <span className="text-sm font-medium">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Password</span>
            <input
              type="password"
              required
              minLength={mode === "signup" ? 8 : 1}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="h-11 w-full rounded-xl bg-zinc-900 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-zinc-600">
          {mode === "login" ? (
            <>
              No account?{" "}
              <Link href="/signup" className="font-medium text-zinc-900">
                Sign up
              </Link>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-zinc-900">
                Log in
              </Link>
            </>
          )}
        </p>
      </div>
    </MarketingShell>
  );
}
