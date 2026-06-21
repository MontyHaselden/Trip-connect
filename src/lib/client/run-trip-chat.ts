import type { TripCommand } from "@/lib/trip-engine/commands";

export type TripChatResult = {
  assistantReply: string;
  needsClarification: boolean;
  proposedCommands: TripCommand[];
  commandSummaries: string[];
  warnings: string[];
};

export async function runTripChat(params: {
  tripId: string;
  groupId: string;
  messages: Array<{ role: "user" | "assistant"; text: string }>;
}): Promise<{ ok: true; result: TripChatResult } | { ok: false; error: string }> {
  const res = await fetch(`/api/trips/${params.tripId}/trip-chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      messages: params.messages,
      groupId: params.groupId,
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (typeof body.assistantReply === "string") {
    return { ok: true, result: body as TripChatResult };
  }
  if (!res.ok) {
    return {
      ok: false,
      error:
        typeof body.error === "string"
          ? body.error
          : "I couldn't reach the assistant just now — try sending that again.",
    };
  }

  return { ok: true, result: body as TripChatResult };
}
