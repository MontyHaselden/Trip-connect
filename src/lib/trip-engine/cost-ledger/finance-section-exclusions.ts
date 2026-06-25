import type { FinanceEntitySection } from "./finance-sections";
import type { TripCostSettingsDraft } from "./types";

export type FinanceSectionExclusions = Record<string, string[]>;

export function parseFinanceSectionExclusions(value: unknown): FinanceSectionExclusions {
  if (!value || typeof value !== "object") return {};
  const out: FinanceSectionExclusions = {};
  for (const [key, ids] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(ids)) continue;
    const valid = ids.filter((id): id is string => typeof id === "string" && id.length > 0);
    if (valid.length) out[key] = [...new Set(valid)];
  }
  return out;
}

export function excludedParticipantIdsForSection(
  settings: TripCostSettingsDraft,
  section: FinanceEntitySection | string,
): Set<string> {
  return new Set(settings.financeSectionExclusions[section] ?? []);
}

export function filterParticipantsForFinanceSection<T extends { id: string }>(
  participants: T[],
  settings: TripCostSettingsDraft,
  section: FinanceEntitySection | string | null,
): T[] {
  if (!section) return participants;
  const excluded = excludedParticipantIdsForSection(settings, section);
  if (!excluded.size) return participants;
  return participants.filter((p) => !excluded.has(p.id));
}

export function applySectionExclusionPatch(
  exclusions: FinanceSectionExclusions,
  section: string,
  participantId: string,
  excluded: boolean,
): FinanceSectionExclusions {
  const next = { ...exclusions };
  const current = new Set(next[section] ?? []);
  if (excluded) current.add(participantId);
  else current.delete(participantId);
  if (current.size) next[section] = [...current];
  else delete next[section];
  return next;
}
