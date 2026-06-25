import {
  financeSectionForLine,
  financeSectionLabel,
  financeSectionList,
  groupLinesByFinanceSection,
  participantAllocationCents,
  sectionTotalForParticipant,
  type FinanceExportScope,
} from "./finance-sections";
import { supplierPaidCentsForParticipantOnLines } from "./finance-grid-totals";
import { formatMoneyAmount } from "./format-money";
import type { CostLedgerProjection, CostLineItemDraft } from "./types";
import type { TripEntityGraph } from "../types";

export type ParticipantStatementTotals = {
  totalCents: number;
  paidCents: number;
  toBePaidCents: number;
};

export function participantStatementTotals(
  lines: CostLineItemDraft[],
  participantId: string,
  ledger: CostLedgerProjection,
  allocationByLine: Map<string, Record<string, number>>,
): ParticipantStatementTotals {
  const totalCents = sectionTotalForParticipant(
    lines,
    participantId,
    allocationByLine,
    ledger.settings,
  );
  const paidCents = supplierPaidCentsForParticipantOnLines(
    lines,
    participantId,
    ledger,
    allocationByLine,
  );
  return {
    totalCents,
    paidCents,
    toBePaidCents: Math.max(0, totalCents - paidCents),
  };
}

export type ParticipantStatementLine = {
  line: CostLineItemDraft;
  shareCents: number;
};

export function participantStatementLines(
  lines: CostLineItemDraft[],
  participantId: string,
  ledger: CostLedgerProjection,
  allocationByLine: Map<string, Record<string, number>>,
): ParticipantStatementLine[] {
  const out: ParticipantStatementLine[] = [];
  for (const line of lines) {
    const shareCents = participantAllocationCents(
      line,
      participantId,
      allocationByLine,
      ledger.settings,
    );
    if (shareCents > 0) out.push({ line, shareCents });
  }
  return out;
}

export function statementLinesForScope(
  ledger: CostLedgerProjection,
  graph: TripEntityGraph | null | undefined,
  scope: FinanceExportScope,
): CostLineItemDraft[] {
  const all = ledger.lineItems.filter(
    (line) => financeSectionForLine(line, graph, ledger.settings) != null,
  );
  if (scope === "all") return all;
  return all.filter(
    (line) => financeSectionForLine(line, graph, ledger.settings) === scope,
  );
}

export function formatStatementAmount(cents: number, currency: string): string {
  return formatMoneyAmount(cents, currency);
}

export function groupedStatementSections(
  lines: CostLineItemDraft[],
  graph: TripEntityGraph | null | undefined,
  settings: CostLedgerProjection["settings"],
): { section: string; lines: CostLineItemDraft[] }[] {
  const grouped = groupLinesByFinanceSection(lines, graph, settings);
  return financeSectionList(settings)
    .map((section) => ({
      section,
      lines: grouped.get(section) ?? [],
    }))
    .filter((bucket) => bucket.lines.length > 0);
}

export function sectionLabelForScope(
  scope: FinanceExportScope,
  settings: CostLedgerProjection["settings"],
): string {
  if (scope === "all") return "Full trip";
  return financeSectionLabel(scope, settings);
}
