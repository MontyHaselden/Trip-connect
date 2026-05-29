"use client";

export type EnterTripAppResult = {
  ok: boolean;
  tripId: string;
  inviteCode: string;
  tripName: string;
  schoolName: string;
  startDate: string;
  endDate: string;
  timezone: string;
  publishedVersion: number;
  participantId: string;
  accessToken: string;
  canEdit: boolean;
  role: string;
};

export function saveStudentSession(data: {
  tripId: string;
  participantId: string;
  accessToken: string;
  inviteCode: string;
}) {
  localStorage.setItem("tc_trip_id", data.tripId);
  localStorage.setItem("tc_participant_id", data.participantId);
  localStorage.setItem("tc_access_token", data.accessToken);
  localStorage.setItem("tc_invite_code", data.inviteCode);
  localStorage.setItem("tc_joined_at", new Date().toISOString());
}

export async function enterTripAppClient(inviteCode: string): Promise<EnterTripAppResult> {
  const res = await fetch("/api/host/enter-app", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ inviteCode }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || "Failed to enter trip app");

  saveStudentSession({
    tripId: body.tripId,
    participantId: body.participantId,
    accessToken: body.accessToken,
    inviteCode: body.inviteCode,
  });

  localStorage.setItem("tc_host_invite_code", body.inviteCode);
  localStorage.setItem("tc_can_edit", body.canEdit ? "1" : "0");
  localStorage.setItem("tc_host_role", body.role ?? "");

  return body as EnterTripAppResult;
}
