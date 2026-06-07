export const TRIP_STORAGE_KEYS = {
  tripId: "tc_trip_id",
  participantId: "tc_participant_id",
  accessToken: "tc_access_token",
  inviteCode: "tc_invite_code",
  joinedAt: "tc_joined_at",
} as const;

export function saveTripSession(params: {
  tripId: string;
  participantId: string;
  accessToken: string;
  inviteCode: string;
}) {
  try {
    localStorage.setItem(TRIP_STORAGE_KEYS.tripId, params.tripId);
    localStorage.setItem(TRIP_STORAGE_KEYS.participantId, params.participantId);
    localStorage.setItem(TRIP_STORAGE_KEYS.accessToken, params.accessToken);
    localStorage.setItem(TRIP_STORAGE_KEYS.inviteCode, params.inviteCode);
    localStorage.setItem(TRIP_STORAGE_KEYS.joinedAt, new Date().toISOString());
  } catch {
    // ignore
  }
}

export function getStoredInviteCode(): string | null {
  try {
    return localStorage.getItem(TRIP_STORAGE_KEYS.inviteCode);
  } catch {
    return null;
  }
}

export function getStoredTripSession() {
  try {
    const tripId = localStorage.getItem(TRIP_STORAGE_KEYS.tripId);
    const accessToken = localStorage.getItem(TRIP_STORAGE_KEYS.accessToken);
    const inviteCode = localStorage.getItem(TRIP_STORAGE_KEYS.inviteCode);
    const participantId = localStorage.getItem(TRIP_STORAGE_KEYS.participantId);
    if (!tripId || !accessToken || !inviteCode || !participantId) return null;
    return { tripId, accessToken, inviteCode, participantId };
  } catch {
    return null;
  }
}

export const STUDENT_APP_LAUNCH_PATH = "/app/today";

export function studentJoinPath(inviteCode: string) {
  return `/join/${encodeURIComponent(inviteCode)}`;
}

export function studentMobileJoinPath(inviteCode: string) {
  return `/mobile/join/${encodeURIComponent(inviteCode)}`;
}

export function studentTripTodayPath(tripId: string) {
  return `/trip/${encodeURIComponent(tripId)}/today`;
}

export const INSTALL_HINT_SESSION_KEY = "tc_show_install_hint";

/** Full-page navigation so iOS picks up PWA meta tags before Add to Home Screen. */
export function redirectToStudentTrip(
  tripId: string,
  options?: { promptInstall?: boolean },
) {
  if (options?.promptInstall) {
    try {
      sessionStorage.setItem(INSTALL_HINT_SESSION_KEY, "1");
    } catch {
      // ignore
    }
  }
  window.location.assign(studentTripTodayPath(tripId));
}

export function resolveStudentAppLaunchPath(
  screen: "today" | "my-trip" = "today",
): string {
  const session = getStoredTripSession();
  if (session) {
    return screen === "my-trip"
      ? `/trip/${session.tripId}/my-trip`
      : `/trip/${session.tripId}/today`;
  }
  const inviteCode = getStoredInviteCode();
  if (inviteCode) return `/join/${inviteCode}`;
  return STUDENT_APP_LAUNCH_PATH;
}

export function clearTripSession() {
  for (const key of Object.values(TRIP_STORAGE_KEYS)) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}
