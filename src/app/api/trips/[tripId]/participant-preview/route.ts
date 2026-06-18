import { NextResponse } from "next/server";

import { requireHostSessionHostId } from "@/lib/auth/host-session";
import { hostApiError } from "@/lib/host/api-errors";
import { getTripByIdForHost } from "@/lib/host/get-trip-by-id";
import { loadRoster } from "@/lib/host/roster-queries";
import { buildParticipantPreviewForHost } from "@/lib/publish/build-participant-preview";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await ctx.params;
  try {
    const hostId = await requireHostSessionHostId();
    const trip = await getTripByIdForHost(hostId, tripId);
    if (!trip) {
      return NextResponse.json({ error: "Trip not found." }, { status: 404 });
    }

    const roster = await loadRoster(tripId);
    const groupNameById = new Map(roster.groups.map((g) => [g.id, g.name]));

    const participants = roster.participants
      .filter((p) => p.role !== "host")
      .map((p) => ({
        id: p.id,
        fullName: p.fullName,
        role: p.role,
        groupIds: p.groupIds,
        groupNames: p.groupIds.map((id) => groupNameById.get(id) ?? "Group"),
      }));

    const url = new URL(req.url);
    const participantId = url.searchParams.get("participantId");

    const base = {
      inviteCode: trip.inviteCode,
      publishedVersion: trip.publishedVersion,
      groups: roster.groups.map((g) => ({ id: g.id, name: g.name, type: g.type })),
      participants,
    };

    if (!participantId) {
      const defaultParticipantId =
        participants.find((p) => p.role === "student")?.id ?? participants[0]?.id ?? null;
      return NextResponse.json({ ...base, defaultParticipantId });
    }

    const participant = participants.find((p) => p.id === participantId);
    if (!participant) {
      return NextResponse.json({ error: "Participant not found." }, { status: 404 });
    }

    const preview = await buildParticipantPreviewForHost(tripId, participantId);

    return NextResponse.json({
      ...base,
      preview: {
        participantId: preview.participantId,
        payload: preview.payload,
        version: preview.version,
        publishedAt: preview.publishedAt,
        source: preview.source,
        liveForStudents: preview.liveForStudents,
        staleVsPublished: preview.staleVsPublished,
      },
    });
  } catch (err) {
    return hostApiError(err);
  }
}
