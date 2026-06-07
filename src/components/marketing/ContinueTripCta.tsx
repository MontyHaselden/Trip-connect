"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getStoredTripSession, studentAppPath } from "@/lib/mobile/trip-storage";

export function ContinueTripCta() {
  const [tripHref, setTripHref] = useState<string | null>(null);

  useEffect(() => {
    const session = getStoredTripSession();
    if (session) {
      setTripHref(studentAppPath(session.inviteCode));
    }
  }, []);

  if (!tripHref) return null;

  return (
    <Link
      href={tripHref}
      className="inline-flex h-11 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 px-6 text-sm font-medium text-sky-900"
    >
      Continue your trip
    </Link>
  );
}
