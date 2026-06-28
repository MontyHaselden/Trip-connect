"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { TripAppShell } from "@/components/layout/TripAppShell";
import { StudentInstallWizard } from "@/components/student/StudentInstallWizard";
import { StudentJoinForm } from "@/components/student/StudentJoinForm";
import { useStudentViewportLock } from "@/hooks/useStudentViewportLock";
import { needsStudentInstallWizard } from "@/lib/mobile/pwa-detect";
import {
  buildTripManifestHref,
  wirePwaHead,
} from "@/lib/mobile/wire-pwa-head";
import {
  clearTripSession,
  getStoredTripSession,
  redirectToStudentApp,
  studentAppPath,
} from "@/lib/mobile/trip-storage";

type AppPhase = "loading" | "install" | "join" | "app";

export function StudentAppRoot(props: {
  inviteCode: string;
  /** Code in the URL — may be a group link; used for join API. */
  joinInviteCode?: string;
  tripId: string;
  tripName: string;
  children: React.ReactNode;
}) {
  const { inviteCode, joinInviteCode = inviteCode, tripId, tripName, children } = props;
  const [phase, setPhase] = useState<AppPhase>("loading");

  const appPath = useMemo(() => studentAppPath(inviteCode), [inviteCode]);
  const manifestHref = useMemo(
    () => buildTripManifestHref(tripName, appPath, appPath),
    [tripName, appPath],
  );

  useStudentViewportLock();

  const resolvePhase = useCallback((): AppPhase => {
    const session = getStoredTripSession();
    if (session?.inviteCode && session.inviteCode !== inviteCode) {
      clearTripSession();
    } else if (session?.tripId && session.tripId !== tripId) {
      clearTripSession();
    } else if (session?.accessToken && session.inviteCode === inviteCode) {
      return "app";
    }

    if (needsStudentInstallWizard()) {
      return "install";
    }
    return "join";
  }, [inviteCode, tripId]);

  useEffect(() => {
    wirePwaHead({ manifestHref, appTitle: tripName });
    setPhase(resolvePhase());
  }, [manifestHref, tripName, resolvePhase]);

  const onInstallReady = useCallback(() => {
    setPhase("join");
  }, []);

  const onJoined = useCallback(() => {
    redirectToStudentApp(inviteCode);
  }, [inviteCode]);

  if (phase === "loading") {
    return (
      <p className="student-app flex h-dvh items-center justify-center bg-[var(--student-bg)] text-sm text-[var(--student-text-muted)]">
        Loading…
      </p>
    );
  }

  if (phase === "install") {
    return (
      <StudentInstallWizard
        tripName={tripName}
        manifestHref={manifestHref}
        onReady={onInstallReady}
      />
    );
  }

  if (phase === "join") {
    return (
      <StudentJoinForm
        inviteCode={joinInviteCode}
        tripInviteCode={inviteCode}
        tripName={tripName}
        onJoined={onJoined}
      />
    );
  }

  return (
    <TripAppShell tripId={tripId} inviteCode={inviteCode}>
      {children}
    </TripAppShell>
  );
}
