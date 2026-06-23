import type { CostAllocationRuleType, CostLineItemDraft, TripCostSettingsDraft } from "./types";
import type { RosterSummary } from "../types";
import { convertToBaseCents, formatMoney } from "./format-money";

export function participantHeaderLabel(
  participant: RosterSummary["participants"][number],
  pool: RosterSummary["participants"],
): string {
  const parts = participant.fullName.trim().split(/\s+/);
  const first = parts[0] ?? participant.fullName;
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  const sameFirst = pool.filter((p) => p.fullName.trim().split(/\s+/)[0] === first).length;
  if (sameFirst > 1 && last) {
    return last.length <= 4 ? `${first} ${last}` : `${first} ${last.slice(0, 3)}`;
  }
  if (last) return `${first} ${last[0]}.`;
  return first.length > 10 ? `${first.slice(0, 9)}…` : first;
}

/** Header font size (px) — shrink long names so columns stay narrow. */
export function participantHeaderFontSize(labelLength: number): number {
  if (labelLength <= 9) return 12;
  if (labelLength <= 12) return 11;
  if (labelLength <= 15) return 10;
  return 9;
}

export function allocationRuleLabel(
  ruleType: CostAllocationRuleType,
  payload: { groupId?: string; participantId?: string },
  roster: RosterSummary,
): string {
  switch (ruleType) {
    case "equal_present":
      return "÷ present";
    case "equal_cost_participants":
      return "Equal split";
    case "equal_group": {
      const group = roster.groups.find((g) => g.id === payload.groupId);
      return group ? `÷ ${group.name}` : "÷ group";
    }
    case "assign_one": {
      const person = roster.participants.find((p) => p.id === payload.participantId);
      return person ? `→ ${person.fullName}` : "→ one person";
    }
    case "manual":
      return "Manual";
    default:
      return ruleType;
  }
}

export function formatLineTotal(
  line: Pick<CostLineItemDraft, "totalAmountCents" | "currency">,
  settings: TripCostSettingsDraft,
): { primary: string; secondary?: string } {
  const primary = formatMoney(line.totalAmountCents, line.currency);
  if (
    line.currency !== settings.baseCurrency &&
    line.totalAmountCents > 0 &&
    settings.exchangeRate &&
    settings.exchangeRate > 0
  ) {
    const base = convertToBaseCents(line.totalAmountCents, line.currency, settings);
    return {
      primary,
      secondary: `≈ ${formatMoney(base, settings.baseCurrency)}`,
    };
  }
  return { primary };
}

export type GroupColumn = {
  id: string;
  label: string;
  participantIds: string[];
};

export function buildGroupColumns(roster: RosterSummary): GroupColumn[] {
  const pool = roster.participants.filter((p) => p.inCostSplit);
  const assigned = new Set<string>();
  const columns: GroupColumn[] = [];

  for (const group of roster.groups) {
    const members = pool.filter((p) => p.groupIds.includes(group.id));
    if (!members.length) continue;
    for (const m of members) assigned.add(m.id);
    columns.push({
      id: group.id,
      label: group.name,
      participantIds: members.map((m) => m.id),
    });
  }

  const ungrouped = pool.filter((p) => !assigned.has(p.id));
  if (ungrouped.length) {
    columns.push({
      id: "__ungrouped",
      label: "Ungrouped",
      participantIds: ungrouped.map((p) => p.id),
    });
  }

  return columns;
}

export function sumAllocationsForParticipants(
  allocations: Record<string, number>,
  participantIds: string[],
  lineCurrency: string,
  settings: TripCostSettingsDraft,
): number {
  let total = 0;
  for (const id of participantIds) {
    const cents = allocations[id];
    if (cents != null) total += convertToBaseCents(cents, lineCurrency, settings);
  }
  return total;
}
