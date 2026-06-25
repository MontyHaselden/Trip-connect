import {
  buildFinancePortraitHtml,
  downloadHtml,
} from "./export-finance-portrait";
import {
  groupedStatementSections,
  participantStatementLines,
  participantStatementTotals,
  statementLinesForScope,
} from "./export-personal-statement";
import { effectiveStayNights, nightsLabel } from "./accommodation-nights";
import {
  financeSectionDescription,
  financeSectionForLine,
  financeSectionLabel,
  financeSectionList,
  groupLinesByFinanceSection,
  participantAllocationCents,
  type FinanceEntitySection,
  type FinanceExportScope,
} from "./finance-sections";
import { filterParticipantsForFinanceSection } from "./finance-section-exclusions";
import { convertToBaseCents, formatMoneyAmount } from "./format-money";
import type { CostLedgerProjection, CostLineItemDraft } from "./types";
import type { RosterSummary, TripEntityGraph } from "../types";

export type { FinanceExportScope } from "./finance-sections";

export type FinanceExportFormat = "html" | "csv";

export type FinanceExportRequest = {
  scope: FinanceExportScope;
  /** When set, export is scoped to one participant only. */
  participantId: string | null;
  format: FinanceExportFormat;
};

export type FinanceExportContext = {
  ledger: CostLedgerProjection;
  roster: RosterSummary;
  tripName: string;
  graph?: TripEntityGraph | null;
};

export type FinanceExportScopeOption = {
  id: FinanceExportScope;
  label: string;
  description: string;
  lineCount: number;
};

function escapeCsv(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowToCsv(cells: (string | number | null | undefined)[]): string {
  return cells.map(escapeCsv).join(",");
}

function tripExportSlug(tripName: string): string {
  return tripName.replace(/[^\w-]+/g, "_").slice(0, 40) || "trip";
}

function participantSlug(name: string): string {
  return name.replace(/[^\w-]+/g, "_").slice(0, 24) || "participant";
}

function scopeSlug(scope: FinanceExportScope): string {
  if (scope === "all") return "finance";
  return `${scope}_finance`;
}

function costSplitPool(roster: RosterSummary): RosterSummary["participants"] {
  return roster.participants.filter((p) => p.inCostSplit && p.role !== "host");
}

function buildAllocationByLine(
  ledger: CostLedgerProjection,
): Map<string, Record<string, number>> {
  const map = new Map<string, Record<string, number>>();
  for (const row of ledger.lineAllocations) {
    map.set(row.lineItemId, row.allocations);
  }
  return map;
}

function visibleFinanceLines(
  ledger: CostLedgerProjection,
  graph?: TripEntityGraph | null,
): CostLineItemDraft[] {
  return ledger.lineItems.filter(
    (line) => financeSectionForLine(line, graph, ledger.settings) != null,
  );
}

function lineQtyLabel(line: CostLineItemDraft, graph?: TripEntityGraph | null): string {
  const nights = effectiveStayNights(line, graph);
  if (nights != null && nights > 0) return nightsLabel(nights);
  if (line.quantity != null && line.quantity > 0) return String(line.quantity);
  return "";
}

function linesForScope(
  ledger: CostLedgerProjection,
  graph: TripEntityGraph | null | undefined,
  scope: FinanceExportScope,
): CostLineItemDraft[] {
  const lines = visibleFinanceLines(ledger, graph);
  if (scope === "all") return lines;
  return lines.filter(
    (line) => financeSectionForLine(line, graph, ledger.settings) === scope,
  );
}

function participantPool(
  roster: RosterSummary,
  settings: CostLedgerProjection["settings"],
  scope: FinanceExportScope,
  participantId: string | null,
): RosterSummary["participants"] {
  let pool = costSplitPool(roster);
  if (scope !== "all") {
    pool = filterParticipantsForFinanceSection(pool, settings, scope);
  }
  if (participantId) {
    const match = pool.find((p) => p.id === participantId);
    return match ? [match] : [];
  }
  return pool;
}

export function listFinanceExportScopes(
  ledger: CostLedgerProjection,
  graph?: TripEntityGraph | null,
): FinanceExportScopeOption[] {
  const lines = visibleFinanceLines(ledger, graph);
  const linesBySection = groupLinesByFinanceSection(lines, graph, ledger.settings);
  const sections = financeSectionList(ledger.settings);

  const sectionOptions: FinanceExportScopeOption[] = sections.map((section) => {
    const sectionLines = linesBySection.get(section) ?? [];
    const label = financeSectionLabel(section, ledger.settings);
    return {
      id: section,
      label: `${label} finance`,
      description: financeSectionDescription(section, ledger.settings),
      lineCount: sectionLines.length,
    };
  });

  return [
    {
      id: "all",
      label: "Full trip finance",
      description: "All sections, trip summary, and per-person balances",
      lineCount: lines.length,
    },
    ...sectionOptions,
  ];
}

function qtyColumnLabel(scope: FinanceExportScope): string {
  if (scope === "accommodation") return "Nights";
  return "Qty";
}

function buildSectionSpreadsheetCsvBlock(options: {
  section: FinanceEntitySection;
  sectionLines: CostLineItemDraft[];
  ledger: CostLedgerProjection;
  graph?: TripEntityGraph | null;
  pool: RosterSummary["participants"];
  allocationByLine: Map<string, Record<string, number>>;
  singleParticipant: boolean;
}): string[] {
  const { section, sectionLines, ledger, graph, pool, allocationByLine, singleParticipant } =
    options;
  if (!sectionLines.length) return [];

  const currency = ledger.settings.baseCurrency;
  const label = financeSectionLabel(section, ledger.settings);
  const qtyLabel = qtyColumnLabel(section);
  const rows: string[] = [];

  rows.push(rowToCsv([label]));
  rows.push(
    rowToCsv([
      "Description",
      qtyLabel,
      ...(singleParticipant ? ["Share"] : pool.map((p) => p.fullName)),
      "Line total",
    ]),
  );

  let sectionTotal = 0;
  const participantTotals = new Map<string, number>();
  for (const participant of pool) participantTotals.set(participant.id, 0);

  for (const line of sectionLines) {
    const lineTotal = convertToBaseCents(line.totalAmountCents, line.currency, ledger.settings);
    sectionTotal += lineTotal;

    const participantCells = pool.map((participant) => {
      const cents = participantAllocationCents(
        line,
        participant.id,
        allocationByLine,
        ledger.settings,
      );
      participantTotals.set(
        participant.id,
        (participantTotals.get(participant.id) ?? 0) + cents,
      );
      return cents > 0 ? formatMoneyAmount(cents, currency) : "";
    });

    rows.push(
      rowToCsv([
        line.description,
        lineQtyLabel(line, graph),
        ...participantCells,
        lineTotal > 0 ? formatMoneyAmount(lineTotal, currency) : "",
      ]),
    );
  }

  rows.push(
    rowToCsv([
      `${label} subtotal`,
      "",
      ...pool.map((participant) => {
        const total = participantTotals.get(participant.id) ?? 0;
        return total > 0 ? formatMoneyAmount(total, currency) : "";
      }),
      sectionTotal > 0 ? formatMoneyAmount(sectionTotal, currency) : "",
    ]),
  );

  return rows;
}

function buildPersonalSectionCsv(options: {
  ledger: CostLedgerProjection;
  roster: RosterSummary;
  tripName: string;
  graph?: TripEntityGraph | null;
  participantId: string;
  scope: FinanceEntitySection;
}): string {
  const { ledger, roster, tripName, graph, participantId, scope } = options;
  const participant = roster.participants.find((p) => p.id === participantId);
  if (!participant) return "";

  const currency = ledger.settings.baseCurrency;
  const allocationByLine = buildAllocationByLine(ledger);
  const lines = statementLinesForScope(ledger, graph, scope);
  const statementLines = participantStatementLines(
    lines,
    participantId,
    ledger,
    allocationByLine,
  );
  const totals = participantStatementTotals(
    lines,
    participantId,
    ledger,
    allocationByLine,
  );

  const rows: string[] = [
    rowToCsv(["Trip", tripName]),
    rowToCsv(["Currency", currency]),
    rowToCsv(["Scope", financeSectionLabel(scope, ledger.settings)]),
    rowToCsv(["Participant", participant.fullName]),
    "",
    rowToCsv(["Description", "Your cost"]),
  ];

  for (const { line, shareCents } of statementLines) {
    rows.push(
      rowToCsv([line.description, formatMoneyAmount(shareCents, currency)]),
    );
  }

  rows.push("");
  rows.push(rowToCsv(["Total", formatMoneyAmount(totals.totalCents, currency)]));
  rows.push(
    rowToCsv([
      "Total to be paid",
      formatMoneyAmount(totals.toBePaidCents, currency),
    ]),
  );

  return rows.join("\n");
}

function buildPersonalStatementCsv(options: {
  ledger: CostLedgerProjection;
  roster: RosterSummary;
  tripName: string;
  graph?: TripEntityGraph | null;
  participantId: string;
}): string {
  const { ledger, roster, tripName, graph, participantId } = options;
  const participant = roster.participants.find((p) => p.id === participantId);
  if (!participant) return "";

  const currency = ledger.settings.baseCurrency;
  const allocationByLine = buildAllocationByLine(ledger);
  const lines = visibleFinanceLines(ledger, graph);

  const rows: string[] = [
    rowToCsv(["Trip", tripName]),
    rowToCsv(["Participant", participant.fullName]),
    rowToCsv(["Currency", currency]),
    "",
    rowToCsv(["Description", "Section", "Your cost"]),
  ];

  for (const { section, lines: sectionLines } of groupedStatementSections(
    lines,
    graph,
    ledger.settings,
  )) {
    for (const { line, shareCents } of participantStatementLines(
      sectionLines,
      participantId,
      ledger,
      allocationByLine,
    )) {
      rows.push(
        rowToCsv([
          line.description,
          financeSectionLabel(section, ledger.settings),
          formatMoneyAmount(shareCents, currency),
        ]),
      );
    }
  }

  const totals = participantStatementTotals(
    lines,
    participantId,
    ledger,
    allocationByLine,
  );

  rows.push("");
  rows.push(rowToCsv(["Total", "", formatMoneyAmount(totals.totalCents, currency)]));
  rows.push(
    rowToCsv([
      "Total to be paid",
      "",
      formatMoneyAmount(totals.toBePaidCents, currency),
    ]),
  );

  const balance = ledger.personBalances.find((b) => b.participantId === participantId);
  if (balance && (balance.paidCents > 0 || balance.fundCreditsCents > 0)) {
    rows.push(
      rowToCsv([
        "Paid by you",
        "",
        formatMoneyAmount(balance.paidCents, currency),
      ]),
    );
    rows.push(
      rowToCsv([
        "Fund credits",
        "",
        formatMoneyAmount(balance.fundCreditsCents, currency),
      ]),
    );
    rows.push(
      rowToCsv([
        "Balance owing",
        "",
        formatMoneyAmount(balance.balanceCents, currency),
      ]),
    );
  }

  return rows.join("\n");
}

export function buildFinanceSpreadsheetCsv(
  request: FinanceExportRequest,
  context: FinanceExportContext,
): string {
  const { ledger, roster, graph } = context;
  const { scope, participantId } = request;
  const currency = ledger.settings.baseCurrency;
  const allocationByLine = buildAllocationByLine(ledger);
  const pool = participantPool(roster, ledger.settings, scope, participantId);
  const singleParticipant = participantId != null;

  if (singleParticipant && scope === "all") {
    return buildPersonalStatementCsv({
      ledger,
      roster,
      tripName: context.tripName,
      graph,
      participantId,
    });
  }

  if (singleParticipant && scope !== "all") {
    return buildPersonalSectionCsv({
      ledger,
      roster,
      tripName: context.tripName,
      graph,
      participantId,
      scope,
    });
  }

  const metaRows = [
    rowToCsv(["Trip", context.tripName]),
    rowToCsv(["Currency", currency]),
    rowToCsv([
      "Scope",
      scope === "all" ? "Full trip" : financeSectionLabel(scope, ledger.settings),
    ]),
    ...(singleParticipant && pool[0]
      ? [rowToCsv(["Participant", pool[0].fullName])]
      : []),
    "",
  ];

  const lines = linesForScope(ledger, graph, scope);
  const linesBySection = groupLinesByFinanceSection(lines, graph, ledger.settings);

  const sectionsToExport =
    scope === "all"
      ? financeSectionList(ledger.settings).filter(
          (section) => (linesBySection.get(section) ?? []).length > 0,
        )
      : [scope];

  const dataRows: string[] = [];
  for (const section of sectionsToExport) {
    const block = buildSectionSpreadsheetCsvBlock({
      section,
      sectionLines: linesBySection.get(section) ?? [],
      ledger,
      graph,
      pool,
      allocationByLine,
      singleParticipant,
    });
    if (!block.length) continue;
    if (dataRows.length) dataRows.push("");
    dataRows.push(...block);
  }

  return [...metaRows, ...dataRows].join("\n");
}

export function buildExportFilename(
  request: FinanceExportRequest,
  context: FinanceExportContext,
): string {
  const slug = tripExportSlug(context.tripName);
  const ext = request.format === "html" ? "html" : "csv";

  let name = `${slug}_${scopeSlug(request.scope)}`;
  if (request.participantId) {
    const participant = context.roster.participants.find(
      (p) => p.id === request.participantId,
    );
    if (participant) {
      name += `_${participantSlug(participant.fullName)}`;
    }
  }

  return `${name}.${ext}`;
}

export function downloadFinanceExport(
  request: FinanceExportRequest,
  context: FinanceExportContext,
): void {
  const filename = buildExportFilename(request, context);

  if (request.format === "html") {
    const html = buildFinancePortraitHtml({
      ...context,
      filters: {
        scope: request.scope,
        participantId: request.participantId,
      },
    });
    downloadHtml(filename, html);
    return;
  }

  const csv = buildFinanceSpreadsheetCsv(request, context);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
