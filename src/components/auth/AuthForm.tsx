"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AirportPicker } from "@/components/geo/AirportPicker";
import { PlacePicker } from "@/components/geo/PlacePicker";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { tripFieldClass } from "@/components/trip-os/shared/TripInput";
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
  const [homeCity, setHomeCity] = useState("");
  const [defaultAirport, setDefaultAirport] = useState("");
  const [organisationName, setOrganisationName] = useState("");
  const [interestMessage, setInterestMessage] = useState("");
  const [role, setRole] = useState<"teacher" | "helper" | "host">("teacher");
  const [foundingSchool, setFoundingSchool] = useState(false);
  const [plan, setPlan] = useState<SubscriptionPlan>(
    initialPlan && [...SCHOOL_PLANS, ...PERSONAL_PLANS].includes(initialPlan)
      ? initialPlan
      : signupKind === "personal"
        ? "personal"
        : "school_pro_plus",
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
              homeCity,
              defaultAirport,
              plan: "school_pro_plus" as const,
              foundingSchool,
            }
          : {
              accountType: "personal" as const,
              email,
              password,
              fullName,
              homeCity,
              defaultAirport,
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
                : "7-day free trial · $400/year + GST after trial · founding schools $240 first year"}
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
                  setPlan(kind === "personal" ? "personal" : "school_pro_plus");
                }}
                className={[
                  "rounded-lg px-3 py-2 text-sm font-medium",
                  signupKind === kind
                    ? "bg-violet-600 text-white"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
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
                className={["mt-1", tripFieldClass, "h-11"].join(" ")}
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
                className={["mt-1", tripFieldClass, "h-11"].join(" ")}
              />
            </label>
          ) : null}

          {mode === "signup" && signupKind !== "organisation" ? (
            <>
              <label className="block">
                <span className="text-sm font-medium">Home city or town</span>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Where your group starts and ends trips — e.g. Christchurch for a Darfield school.
                </p>
                <PlacePicker
                  value={homeCity}
                  onChange={setHomeCity}
                  countryNames={["New Zealand"]}
                  inputClassName={["mt-1 h-11", tripFieldClass].join(" ")}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Default airport</span>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Usual departure airport — flights from here keep the home city for the rest of that day.
                </p>
                <AirportPicker
                  value={defaultAirport}
                  onChange={setDefaultAirport}
                  countryNames={["New Zealand"]}
                  inputClassName={["mt-1 h-11", tripFieldClass].join(" ")}
                />
              </label>
            </>
          ) : null}

          {mode === "signup" && signupKind === "school" ? (
            <>
              <label className="block">
                <span className="text-sm font-medium">School name</span>
                <input
                  required
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  className={["mt-1", tripFieldClass, "h-11"].join(" ")}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Role / title</span>
                <input
                  required
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g. International trips coordinator"
                  className={["mt-1", tripFieldClass, "h-11"].join(" ")}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Phone (optional)</span>
                <input
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className={["mt-1", tripFieldClass, "h-11"].join(" ")}
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
              className={["mt-1 h-11", tripFieldClass].join(" ")}
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
                className={["mt-1", tripFieldClass, "h-11"].join(" ")}
              />
            </label>
          ) : null}

          {mode === "signup" && signupKind === "school" ? (
            <label className="block">
              <span className="text-sm font-medium">Staff role</span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as typeof role)}
                className={["mt-1", tripFieldClass, "h-11"].join(" ")}
              >
                <option value="teacher">Teacher</option>
                <option value="helper">Helper</option>
                <option value="host">Trip coordinator</option>
              </select>
            </label>
          ) : null}

          {mode === "signup" && signupKind === "school" ? (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
              <p className="font-medium">School plan — $400 NZD + GST / year</p>
              <p className="mt-1 text-xs text-zinc-600">
                Includes AI builder, unlimited students on invite links, and full trip tools. No card
                required — start your 7-day trial now.
              </p>
              <label className="mt-3 flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={foundingSchool}
                  onChange={(e) => setFoundingSchool(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  Request <strong>founding school</strong> pricing ($240 NZD + GST first year, limited
                  places)
                </span>
              </label>
            </div>
          ) : null}

          {mode === "signup" && signupKind === "personal" ? (
            <label className="block">
              <span className="text-sm font-medium">Plan</span>
              <select
                value={plan}
                onChange={(e) => setPlan(e.target.value as SubscriptionPlan)}
                className={["mt-1", tripFieldClass, "h-11"].join(" ")}
              >
                {planOptions.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name} — {p.priceDisplay}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {mode === "signup" && signupKind === "organisation" ? (
            <label className="block">
              <span className="text-sm font-medium">Message (optional)</span>
              <textarea
                value={interestMessage}
                onChange={(e) => setInterestMessage(e.target.value)}
                rows={4}
                className={["mt-1", tripFieldClass].join(" ")}
              />
            </label>
          ) : null}

          <button
            type="submit"
            disabled={
              busy ||
              (mode === "signup" &&
                signupKind !== "organisation" &&
                (!homeCity.trim() || !defaultAirport.trim()))
            }
            className="h-11 w-full rounded-full bg-violet-600 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
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
