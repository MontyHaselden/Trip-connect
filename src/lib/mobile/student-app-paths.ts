const INVITE_CODE_KEY = "tc_invite_code";
const TRIP_ID_KEY = "tc_trip_id";
const ACCESS_TOKEN_KEY = "tc_access_token";
const PARTICIPANT_ID_KEY = "tc_participant_id";

function readInviteCode(): string | null {
  try {
    return localStorage.getItem(INVITE_CODE_KEY);
  } catch {
    return null;
  }
}

function readSession() {
  try {
    const tripId = localStorage.getItem(TRIP_ID_KEY);
    const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    const inviteCode = localStorage.getItem(INVITE_CODE_KEY);
    const participantId = localStorage.getItem(PARTICIPANT_ID_KEY);
    if (!tripId || !accessToken || !inviteCode || !participantId) return null;
    return { tripId, accessToken, inviteCode, participantId };
  } catch {
    return null;
  }
}

export const STUDENT_APP_LAUNCH_PATH = "/app/today";

/** Canonical student app URL — invite code is always in the path for PWA launch. */
export function studentAppPath(inviteCode: string) {
  return `/s/${encodeURIComponent(inviteCode)}`;
}

export function studentAppMyTripPath(inviteCode: string) {
  return `/s/${encodeURIComponent(inviteCode)}/my-trip`;
}

export function studentAppManifestId(inviteCode: string) {
  return studentAppPath(inviteCode);
}

/** @deprecated Use studentAppPath — kept for redirects. */
export function studentJoinPath(inviteCode: string) {
  return studentAppPath(inviteCode);
}

/** @deprecated Use studentAppPath — kept for redirects. */
export function studentMobileJoinPath(inviteCode: string) {
  return studentAppPath(inviteCode);
}

/** Legacy trip-id routes — prefer studentAppPath when invite code is known. */
export function studentTripTodayPath(tripId: string) {
  return `/trip/${encodeURIComponent(tripId)}/today`;
}

export function studentTripMyTripPath(tripId: string) {
  return `/trip/${encodeURIComponent(tripId)}/my-trip`;
}

export const INSTALL_HINT_SESSION_KEY = "tc_show_install_hint";

export function redirectToStudentApp(
  inviteCode: string,
  options?: { promptInstall?: boolean },
) {
  if (options?.promptInstall) {
    try {
      sessionStorage.setItem(INSTALL_HINT_SESSION_KEY, "1");
    } catch {
      // ignore
    }
  }
  window.location.assign(studentAppPath(inviteCode));
}

/** @deprecated Use redirectToStudentApp */
export function redirectToStudentTrip(
  tripId: string,
  options?: { promptInstall?: boolean },
) {
  const inviteCode = readInviteCode();
  if (inviteCode) {
    redirectToStudentApp(inviteCode, options);
    return;
  }
  window.location.assign(studentTripTodayPath(tripId));
}

export function resolveStudentAppLaunchPath(
  screen: "today" | "my-trip" = "today",
): string {
  const session = readSession();
  if (session) {
    return screen === "my-trip"
      ? studentAppMyTripPath(session.inviteCode)
      : studentAppPath(session.inviteCode);
  }
  const inviteCode = readInviteCode();
  if (inviteCode) return studentAppPath(inviteCode);
  return STUDENT_APP_LAUNCH_PATH;
}
