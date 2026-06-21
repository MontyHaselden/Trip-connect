"use client";

import { useEffect, useState } from "react";

import {
  clearTripSession,
  getStoredInviteCode,
  getStoredTripSession,
} from "@/lib/mobile/trip-storage";

export function StudentInvalidInvite(props: { attemptedCode: string }) {
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    const session = getStoredTripSession();
    const stored = getStoredInviteCode();
    const stale =
      stored?.toLowerCase() === props.attemptedCode.toLowerCase() ||
      session?.inviteCode?.toLowerCase() === props.attemptedCode.toLowerCase();
    if (stale) {
      clearTripSession();
      setCleared(true);
    }
  }, [props.attemptedCode]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-sm font-medium text-[var(--student-text)]">
        This join link is no longer valid
      </p>
      <p className="mt-2 max-w-sm text-sm text-[var(--student-text-muted)]">
        Code <span className="font-mono">{props.attemptedCode}</span> doesn&apos;t match a
        current trip. Ask your organiser for a fresh link from Trip OS → Join links.
      </p>
      {cleared ? (
        <p className="mt-4 max-w-sm text-xs text-[var(--student-text-muted)]">
          We cleared an old saved trip from this device. Open the new link your organiser sends
          you.
        </p>
      ) : null}
    </div>
  );
}
