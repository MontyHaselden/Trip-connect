import type { ImportChatTurn } from "@/lib/client/run-import-chat";

export type AssistantChatSession = {
  messages: ImportChatTurn[];
  sourceText: string;
};

function storageKey(tripId: string): string {
  return `trip-os-assistant:${tripId}`;
}

function readLocalSession(tripId: string): AssistantChatSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(tripId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AssistantChatSession;
    if (!Array.isArray(parsed.messages)) return null;
    return {
      messages: parsed.messages,
      sourceText: typeof parsed.sourceText === "string" ? parsed.sourceText : "",
    };
  } catch {
    return null;
  }
}

/** Instant client cache — used so the assistant UI is not blocked on the server. */
export function readLocalAssistantChat(tripId: string): AssistantChatSession {
  return readLocalSession(tripId) ?? { messages: [], sourceText: "" };
}

function writeLocalSession(tripId: string, session: AssistantChatSession): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(tripId), JSON.stringify(session));
  } catch {
    // ignore quota errors
  }
}

function clearLocalSession(tripId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey(tripId));
  } catch {
    // ignore
  }
}

export async function loadAssistantChat(
  tripId: string,
): Promise<{ ok: true; session: AssistantChatSession } | { ok: false; error: string }> {
  const localFallback = readLocalAssistantChat(tripId);

  try {
    const controller = new AbortController();
    let timeoutId: number | undefined;
    if (typeof window !== "undefined") {
      timeoutId = window.setTimeout(() => controller.abort(), 12_000);
    }
    const res = await fetch(`/api/trips/${tripId}/assistant-chat`, {
      signal: controller.signal,
    });
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      const session = {
        messages: Array.isArray(body.messages) ? body.messages : [],
        sourceText: typeof body.sourceText === "string" ? body.sourceText : "",
      };
      writeLocalSession(tripId, session);
      return { ok: true, session };
    }
  } catch {
    // fall through to local cache
  }

  return { ok: true, session: localFallback };
}

export async function saveAssistantChat(
  tripId: string,
  session: AssistantChatSession,
): Promise<{ ok: true } | { ok: false; error: string }> {
  writeLocalSession(tripId, session);

  try {
    const res = await fetch(`/api/trips/${tripId}/assistant-chat`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(session),
    });
    if (!res.ok) {
      // Local cache is already saved — server sync can fail before migration is applied.
      return { ok: true };
    }
  } catch {
    // local cache already written
  }

  return { ok: true };
}

export async function clearAssistantChat(
  tripId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  clearLocalSession(tripId);

  try {
    const res = await fetch(`/api/trips/${tripId}/assistant-chat`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return {
        ok: false,
        error: typeof body.error === "string" ? body.error : "Could not clear chat on server.",
      };
    }
  } catch {
    // local already cleared
  }

  return { ok: true };
}
