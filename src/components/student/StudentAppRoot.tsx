"use client";

import { useEffect, useState } from "react";

import { TripAppShell } from "@/components/layout/TripAppShell";
import { StudentJoinForm } from "@/components/student/StudentJoinForm";
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
  tripId: string;
  tripName: string;
  children: React.ReactNode;
}) {
  const { inviteCode, tripId, tripName, children } = props;
  const [phase, setPhase] = useState<"loading" | "join" | "app">("loading");

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
      <p className="flex min-h-dvh items-center justify-center text-sm text-zinc-600">
        Loading…
      </p>
    );
  }

  if (phase === "join") {
    return (
      <StudentJoinForm
        inviteCode={inviteCode}
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
