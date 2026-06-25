import type { ActivityDraft } from "@/lib/host/wizard/types";
import type { TripCommand } from "@/lib/trip-engine/commands";

export type TripChatResult = {
  assistantReply: string;
  needsClarification: boolean;
  proposedCommands: TripCommand[];
  commandSummaries: string[];
  warnings: string[];
};

const TRIP_CHAT_TIMEOUT_MS = 30_000;

function mergeAbortSignals(primary: AbortSignal, secondary: AbortSignal): AbortSignal {
  if (typeof AbortSignal !== "undefined" && "any" in AbortSignal) {
    return AbortSignal.any([primary, secondary]);
  }
  const merged = new AbortController();
  const abort = () => merged.abort();
  if (primary.aborted || secondary.aborted) {
    merged.abort();
    return merged.signal;
  }
  primary.addEventListener("abort", abort, { once: true });
  secondary.addEventListener("abort", abort, { once: true });
  return merged.signal;
}

export async function runTripChat(params: {
  tripId: string;
  groupId: string;
  messages: Array<{ role: "user" | "assistant"; text: string }>;
  clientActivities?: ActivityDraft[];
  signal?: AbortSignal;
}): Promise<{ ok: true; result: TripChatResult } | { ok: false; error: string }> {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), TRIP_CHAT_TIMEOUT_MS);
  const signal = params.signal
    ? mergeAbortSignals(params.signal, timeoutController.signal)
    : timeoutController.signal;

  try {
    const res = await fetch(`/api/trips/${params.tripId}/trip-chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        messages: params.messages,
        groupId: params.groupId,
        clientActivities: params.clientActivities?.length ? params.clientActivities : undefined,
      }),
      signal,
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
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      if (timeoutController.signal.aborted && !params.signal?.aborted) {
        return {
          ok: false,
          error:
            "The assistant timed out after 30 seconds. Try again — adding activities by date should reply instantly.",
        };
      }
    }
    return {
      ok: false,
      error: "I couldn't reach the assistant just now — try sending that again.",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
