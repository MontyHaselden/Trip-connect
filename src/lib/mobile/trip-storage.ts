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

export function clearTripSession() {
  for (const key of Object.values(TRIP_STORAGE_KEYS)) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}
