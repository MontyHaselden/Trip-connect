"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { MarketingShell } from "@/components/marketing/MarketingShell";
import {
  PERSONAL_PLANS,
  SCHOOL_PLANS,
  type SubscriptionPlan,
} from "@/lib/plans/plan-config";

type PublicPlanOption = {
  code: string;
  name: string;
  priceDisplay: string;
  description: string | null;
};

type SignupKind = "school" | "personal" | "organisation";

export function AuthForm(props: { mode: "login" | "signup" }) {
  const { mode } = props;
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialKind = (searchParams.get("type") as SignupKind) || "school";
  const initialPlan = searchParams.get("plan") as SubscriptionPlan | null;

  const [signupKind, setSignupKind] = useState<SignupKind>(
    initialKind === "organisation" ? "organisation" : initialKind === "personal" ? "personal" : "school",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [organisationName, setOrganisationName] = useState("");
  const [interestMessage, setInterestMessage] = useState("");
  const [role, setRole] = useState<"teacher" | "helper" | "host">("teacher");
  const [plan, setPlan] = useState<SubscriptionPlan>(
    initialPlan && [...SCHOOL_PLANS, ...PERSONAL_PLANS].includes(initialPlan)
      ? initialPlan
      : signupKind === "personal"
        ? "personal"
        : "school_starter",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [publicPlans, setPublicPlans] = useState<PublicPlanOption[]>([]);

  useEffect(() => {
    fetch("/api/plans/public")
      .then((r) => r.json())
      .then((body) => {
        if (Array.isArray(body.plans)) setPublicPlans(body.plans);
      })
      .catch(() => null);
  }, []);

  const planOptions = useMemo(() => {
    const type = signupKind === "personal" ? "personal" : "school";
    return publicPlans.filter((p) =>
      type === "personal"
        ? PERSONAL_PLANS.includes(p.code as SubscriptionPlan)
        : SCHOOL_PLANS.includes(p.code as SubscriptionPlan),
    );
  }, [signupKind, publicPlans]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      if (mode === "login") {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error || "Authentication failed");
        router.replace(body?.redirect ?? "/dashboard");
        return;
      }

      if (signupKind === "organisation") {
        const res = await fetch("/api/organisation-interest", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            fullName,
            email,
            organisationName,
            message: interestMessage || undefined,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error || "Submission failed");
        setSuccess(body.message ?? "Thanks — we'll be in touch.");
        return;
      }

      const payload =
        signupKind === "school"
          ? {
              accountType: "school" as const,
              email,
              password,
              fullName,
              phoneNumber: phoneNumber || undefined,
              defaultCountryCallingCode: "NZ",
              role,
              schoolName,
              jobTitle,
              plan: plan as "school_starter" | "school_pro" | "school_pro_plus",
            }
          : {
              accountType: "personal" as const,
              email,
              password,
              fullName,
              plan: plan as "personal_one_time" | "personal" | "personal_pro",
            };

      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Authentication failed");

      if (signupKind === "personal" && plan === "personal_one_time") {
        router.replace("/payshare?welcome=1");
      } else {
        router.replace("/dashboard");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <MarketingShell>
      <div className="mx-auto flex max-w-lg flex-col px-5 py-16">
        <h1 className="text-2xl font-semibold">
          {mode === "login"
            ? "Log in"
            : signupKind === "organisation"
              ? "Register organisation interest"
              : signupKind === "personal"
                ? "Create personal account"
                : "Create school account"}
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          {mode === "login"
            ? "Access your trip dashboard."
            : signupKind === "organisation"
              ? "Organisation plans are coming later. Tell us about your group trips."
              : signupKind === "personal"
                ? "For family holidays, friend trips, and small group travel."
                : "Built for schools — no per-student fees, no GPS tracking."}
        </p>

        {mode === "signup" ? (
          <div className="mt-6 flex flex-wrap gap-2">
            {(
              [
                ["school", "School account"],
                ["personal", "Personal account"],
                ["organisation", "Organisation interest"],
              ] as const
            ).map(([kind, label]) => (
              <button
                key={kind}
                type="button"
                onClick={() => {
                  setSignupKind(kind);
                  setPlan(kind === "personal" ? "personal" : "school_starter");
                }}
                className={[
                  "rounded-lg px-3 py-2 text-sm font-medium",
                  signupKind === kind
                    ? "bg-zinc-900 text-white"
                    : "border border-zinc-200 bg-white text-zinc-700",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
        ) : null}
        {success ? (
          <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            {success}
          </p>
        ) : null}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {mode === "signup" ? (
            <label className="block">
              <span className="text-sm font-medium">Full name</span>
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
              />
            </label>
          ) : null}

          {mode === "signup" && signupKind === "organisation" ? (
            <label className="block">
              <span className="text-sm font-medium">Organisation name</span>
              <input
                required
                value={organisationName}
                onChange={(e) => setOrganisationName(e.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
              />
            </label>
          ) : null}

          {mode === "signup" && signupKind === "school" ? (
            <>
              <label className="block">
                <span className="text-sm font-medium">School name</span>
                <input
                  required
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Role / title</span>
                <input
                  required
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g. International trips coordinator"
                  className="mt-1 h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Phone (optional)</span>
                <input
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
                />
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

          {signupKind !== "organisation" || mode === "login" ? (
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
          ) : null}

          {mode === "signup" && signupKind === "school" ? (
            <label className="block">
              <span className="text-sm font-medium">Staff role</span>
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
          ) : null}

          {mode === "signup" && signupKind !== "organisation" ? (
            <label className="block">
              <span className="text-sm font-medium">Plan</span>
              <select
                value={plan}
                onChange={(e) => setPlan(e.target.value as SubscriptionPlan)}
                className="mt-1 h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
              >
                {planOptions.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name} — {p.priceDisplay}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-zinc-500">
                Billing placeholder — no payment required during prototype.
              </p>
            </label>
          ) : null}

          {mode === "signup" && signupKind === "organisation" ? (
            <label className="block">
              <span className="text-sm font-medium">Message (optional)</span>
              <textarea
                value={interestMessage}
                onChange={(e) => setInterestMessage(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
              />
            </label>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="h-11 w-full rounded-xl bg-zinc-900 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy
              ? "Please wait…"
              : mode === "login"
                ? "Log in"
                : signupKind === "organisation"
                  ? "Register interest"
                  : "Create account"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-zinc-600">
          {mode === "login" ? (
            <>
              No account?{" "}
              <Link href="/signup?type=school" className="font-medium text-zinc-900">
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
