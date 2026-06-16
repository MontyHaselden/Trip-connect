"use client";

import { useEffect, useState } from "react";

import { TripAppShell } from "@/components/layout/TripAppShell";
import { StudentJoinForm } from "@/components/student/StudentJoinForm";
import { useStudentViewportLock } from "@/hooks/useStudentViewportLock";
import {
  buildTripManifestHref,
  wirePwaHead,
} from "@/lib/mobile/wire-pwa-head";
import {
  getStoredTripSession,
  redirectToStudentApp,
  studentAppPath,
} from "@/lib/mobile/trip-storage";

export function StudentAppRoot(props: {
  inviteCode: string;
  /** Code in the URL — may be a group link; used for join API. */
  joinInviteCode?: string;
  tripId: string;
  tripName: string;
  children: React.ReactNode;
}) {
  const { inviteCode, joinInviteCode = inviteCode, tripId, tripName, children } = props;
  const [phase, setPhase] = useState<"loading" | "join" | "app">("loading");

  useStudentViewportLock();

  useEffect(() => {
    const appPath = studentAppPath(inviteCode);
    wirePwaHead({
      manifestHref: buildTripManifestHref(tripName, appPath, appPath),
      appTitle: tripName,
    });

    const session = getStoredTripSession();
    if (session?.inviteCode && session.inviteCode !== inviteCode) {
      redirectToStudentApp(session.inviteCode);
      return;
    }
    if (session?.accessToken && session.inviteCode === inviteCode) {
      setPhase("app");
      return;
    }
    setPhase("join");
  }, [inviteCode, tripName]);

  if (phase === "loading") {
    return (
      <p className="student-app flex h-dvh items-center justify-center bg-[var(--student-bg)] text-sm text-[var(--student-text-muted)]">
        Loading…
      </p>
    );
  }

  if (phase === "join") {
    return (
      <StudentJoinForm
        inviteCode={joinInviteCode}
        tripInviteCode={inviteCode}
        tripName={tripName}
        onJoined={() => redirectToStudentApp(inviteCode, { promptInstall: true })}
      />
    );
  }

  return (
    <TripAppShell tripId={tripId} inviteCode={inviteCode}>
      {children}
    </TripAppShell>
  );
}
