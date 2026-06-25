import type { TripCommand } from "@/lib/trip-engine/commands";

/** Common host typos when asking to remove activities. */
export function normalizeChatTypos(message: string): string {
  return message
    .replace(/\bactivies\b/gi, "activities")
    .replace(/\bactivites\b/gi, "activities")
    .replace(/\bactivties\b/gi, "activities")
    .replace(/\bactivite\b/gi, "activity")
    .replace(/\bactvities\b/gi, "activities")
    .replace(/\bactvity\b/gi, "activity");
}

const DELETE_VERB_RE = /\b(clear|remove|delete|wipe|drop)\b/i;

const WHOLE_TRIP_RE =
  /\b(everything|start\s+over|whole\s+trip|entire\s+trip|from\s+scratch)\b|\b(clear|wipe|reset)\s+(the\s+)?(calendar|trip)\b/i;

/** Matches activity / activities and common misspellings (activies, activites, …). */
export const ACTIVITY_WORD_RE = /\bactivit\w*\b/i;

export const SCOPED_CLEAR_ENTITY_RE =
  /\b(?:activit\w+|stays?|accommodation|hotels?|transport|legs?|flights?)\b/i;

export const CLEAR_ACTIVITIES_RE =
  /\b(clear|remove|delete|wipe|drop)\b(?:\s+\w+){0,6}?\s*(?:all\s+)?activit\w*\b|\bactivit\w*\s+only\b/i;

export const CLEAR_STAYS_RE =
  /\b(clear|remove|delete|wipe|drop)\b(?:\s+\w+){0,6}?\s*(?:all\s+)?(?:stays?|accommodation|hotels?)\b/i;

export const CLEAR_TRANSPORT_RE =
  /\b(clear|remove|delete|wipe|drop)\b(?:\s+\w+){0,6}?\s*(?:all\s+)?(?:transport|legs?|flights?)\b/i;

export const CLEAR_TRIP_RE =
  /\b(clear|remove|delete|wipe|reset|start\s+over|empty|undo\s+import)\b.*\b(everything|calendar|trip|itinerary|import|content|this|data)\b|\b(start\s+over|reset\s+(the\s+)?trip|clear\s+(the\s+)?(calendar|trip)|wipe\s+(the\s+)?calendar)\b|\b(remove|delete)\s+all\b(?!\s+(?:activit\w*|stays?|accommodation|transport|legs?|flights?|hotels?))/i;

export type ScopedDeleteTarget = "activities" | "stays" | "transport" | "trip";

export function detectScopedDeleteTarget(message: string): ScopedDeleteTarget | null {
  const trimmed = normalizeChatTypos(message.trim());
  if (!trimmed || !DELETE_VERB_RE.test(trimmed)) return null;

  if (CLEAR_ACTIVITIES_RE.test(trimmed)) return "activities";
  if (CLEAR_STAYS_RE.test(trimmed)) return "stays";
  if (CLEAR_TRANSPORT_RE.test(trimmed)) return "transport";

  if (CLEAR_TRIP_RE.test(trimmed) && !SCOPED_CLEAR_ENTITY_RE.test(trimmed)) {
    return "trip";
  }

  return null;
}

/** True when the AI (or a bug) proposed a full calendar wipe for a scoped delete request. */
export function proposalOverreachesScopedDelete(
  target: ScopedDeleteTarget,
  commands: TripCommand[],
): boolean {
  if (target === "trip") return false;
  return commands.some((command) => command.type === "clearDayRange");
}
