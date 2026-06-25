import { effectiveStayNights, nightsLabel } from "./accommodation-nights";
import { participantHeaderLabel } from "./display-utils";
import { filterParticipantsForFinanceSection } from "./finance-section-exclusions";
import {
  financeSectionDescription,
  financeSectionForLine,
  financeSectionLabel,
  financeSectionList,
  groupLinesByFinanceSection,
  logisticsGrossForParticipant,
  participantAllocationCents,
  sectionTotalForParticipant,
} from "./finance-sections";
import { computeFinanceTripSummary } from "./finance-summary";
import {
  groupedStatementSections,
  participantStatementLines,
  participantStatementTotals,
  statementLinesForScope,
} from "./export-personal-statement";
import {
  COST_STATUS_LABELS,
  FUNDING_STATUS_LABELS,
  LINE_PAYMENT_STATUS_LABELS,
  PAID_BY_TYPE_LABELS,
  SUPPLIER_PAYMENT_METHOD_LABELS,
  TAX_TREATMENT_LABELS,
} from "./finance-metadata";
import { convertToBaseCents, formatMoney } from "./format-money";
import { lineDateSpanLabel } from "./presence";
import type { CostLedgerProjection, CostLineItemDraft } from "./types";
import type { RosterSummary, TripEntityGraph } from "../types";
import type { FinanceExportScope } from "./finance-sections";

export type FinancePortraitFilters = {
  scope?: FinanceExportScope;
  participantId?: string | null;
};

function escapeHtml(value: string | number | null | undefined): string {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildAllocationByLine(ledger: CostLedgerProjection): Map<string, Record<string, number>> {
  const map = new Map<string, Record<string, number>>();
  for (const row of ledger.lineAllocations) {
    map.set(row.lineItemId, row.allocations);
  }
  return map;
}

function lineQtyLabel(line: CostLineItemDraft, graph?: TripEntityGraph | null): string {
  const nights = effectiveStayNights(line, graph);
  if (nights != null && nights > 0) return nightsLabel(nights);
  if (line.quantity != null && line.quantity > 0) return String(line.quantity);
  return "—";
}

function visibleFinanceLines(
  ledger: CostLedgerProjection,
  graph?: TripEntityGraph | null,
): CostLineItemDraft[] {
  return ledger.lineItems.filter(
    (line) => financeSectionForLine(line, graph, ledger.settings) != null,
  );
}

function portraitStyles(): string {
  return `
    :root {
      --ink: #18181b;
      --muted: #71717a;
      --line: #e4e4e7;
      --panel: #fafafa;
      --accent: #7c3aed;
      --accent-soft: #f5f3ff;
      --accent-mid: #ddd6fe;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #f4f4f5;
      color: var(--ink);
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      font-size: 11pt;
      line-height: 1.45;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .doc {
      max-width: 210mm;
      margin: 0 auto;
      background: #fff;
      box-shadow: 0 12px 40px rgba(24, 24, 27, 0.08);
    }
    @media print {
      html, body { background: #fff; }
      .doc { box-shadow: none; max-width: none; }
      .page-break { break-before: page; page-break-before: always; }
      .avoid-break { break-inside: avoid; page-break-inside: avoid; }
    }
    @page { size: A4 portrait; margin: 14mm 12mm 16mm; }

    .hero {
      position: relative;
      padding: 28px 32px 24px;
      border-bottom: 1px solid var(--line);
      overflow: hidden;
    }
    .hero::before {
      content: "";
      position: absolute;
      inset: 0 0 auto 0;
      height: 5px;
      background: linear-gradient(90deg, #7c3aed 0%, #a78bfa 55%, #c4b5fd 100%);
    }
    .hero-kicker {
      margin: 0 0 6px;
      font-size: 9pt;
      font-weight: 600;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--accent);
    }
    .hero-title {
      margin: 0;
      font-family: Georgia, "Times New Roman", serif;
      font-size: 28pt;
      font-weight: 600;
      letter-spacing: -0.02em;
      line-height: 1.1;
      color: var(--ink);
    }
    .hero-meta {
      margin-top: 14px;
      display: flex;
      flex-wrap: wrap;
      gap: 10px 18px;
      font-size: 9.5pt;
      color: var(--muted);
    }
    .hero-meta strong { color: var(--ink); font-weight: 600; }

    .section {
      padding: 22px 32px 8px;
    }
    .section:last-child { padding-bottom: 28px; }

    .section-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 14px;
      padding-bottom: 8px;
      border-bottom: 2px solid var(--accent-mid);
    }
    .section-title {
      margin: 0;
      font-size: 14pt;
      font-weight: 700;
      letter-spacing: -0.01em;
    }
    .section-desc {
      margin: 4px 0 0;
      font-size: 9.5pt;
      color: var(--muted);
    }
    .section-total {
      font-size: 11pt;
      font-weight: 700;
      color: var(--accent);
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    @media (min-width: 480px) {
      .summary-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    }
    .summary-card {
      border: 1px solid var(--line);
      border-radius: 10px;
      background: linear-gradient(180deg, #fff 0%, var(--panel) 100%);
      padding: 10px 12px;
    }
    .summary-card .label {
      font-size: 8pt;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .summary-card .value {
      margin-top: 4px;
      font-size: 12pt;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }

    table.data {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5pt;
    }
    table.data th,
    table.data td {
      border: 1px solid var(--line);
      padding: 7px 9px;
      vertical-align: top;
    }
    table.data th {
      background: #f4f4f5;
      font-size: 8.5pt;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #52525b;
      text-align: left;
    }
    table.data td.num,
    table.data th.num { text-align: right; font-variant-numeric: tabular-nums; }
    table.data tr.subtotal td {
      background: var(--accent-soft);
      font-weight: 700;
    }
    table.data tr.line-row td:first-child { font-weight: 600; }

    .line-card {
      border: 1px solid var(--line);
      border-radius: 10px;
      margin-bottom: 12px;
      overflow: hidden;
      background: #fff;
    }
    .line-card-head {
      display: grid;
      grid-template-columns: 1fr auto auto;
      gap: 8px 14px;
      align-items: baseline;
      padding: 10px 12px;
      background: linear-gradient(180deg, #fff 0%, var(--panel) 100%);
      border-bottom: 1px solid var(--line);
    }
    .line-title { font-weight: 700; font-size: 10.5pt; }
    .line-meta { font-size: 8.5pt; color: var(--muted); margin-top: 2px; }
    .line-qty, .line-total {
      font-size: 9pt;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .line-total { color: var(--accent); font-size: 10pt; }

    .alloc-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
    }
    .alloc-table td {
      padding: 5px 12px;
      border-top: 1px solid #f4f4f5;
      font-variant-numeric: tabular-nums;
    }
    .alloc-table td:first-child { color: #3f3f46; }
    .alloc-table td:last-child { text-align: right; font-weight: 500; }
    .alloc-table tr:nth-child(even) td { background: #fafafa; }

    .footnote {
      margin-top: 18px;
      font-size: 8.5pt;
      color: var(--muted);
      text-align: center;
    }
    .appendix-title {
      margin: 0 0 10px;
      font-size: 11pt;
      font-weight: 700;
    }

    .personal-summary {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-bottom: 20px;
    }
    .personal-summary-card {
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 18px 20px;
      background: linear-gradient(180deg, #fff 0%, var(--panel) 100%);
    }
    .personal-summary-card.accent {
      border-color: var(--accent-mid);
      background: linear-gradient(135deg, #faf5ff 0%, #f5f3ff 100%);
    }
    .personal-summary-card .label {
      font-size: 9pt;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .personal-summary-card .value {
      margin-top: 6px;
      font-family: Georgia, "Times New Roman", serif;
      font-size: 22pt;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: var(--ink);
    }
    .personal-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10pt;
    }
    .personal-table th,
    .personal-table td {
      border: 1px solid #d4d4d8;
      padding: 10px 14px;
      vertical-align: top;
    }
    .personal-table th {
      background: #f4f4f5;
      font-size: 8.5pt;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #52525b;
      text-align: left;
    }
    .personal-table td.amount {
      text-align: right;
      font-variant-numeric: tabular-nums;
      font-weight: 600;
      white-space: nowrap;
      width: 8rem;
    }
    .personal-table tr.line-row td:first-child {
      font-weight: 500;
    }
    .personal-table tr.total-row td {
      background: #f4f4f5;
      font-weight: 700;
    }
    .personal-table tr.due-row td {
      background: linear-gradient(90deg, #fffbeb 0%, #fef3c7 100%);
      font-weight: 700;
      color: #92400e;
    }
    .section-group-title {
      margin: 18px 0 8px;
      font-size: 10pt;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--muted);
    }
  `;
}

function summarySectionHtml(ledger: CostLedgerProjection, currency: string): string {
  const s = computeFinanceTripSummary(ledger);
  const items = [
    { label: "Total trip cost", value: formatMoney(s.totalTripCostCents, currency) },
    { label: "Funded", value: formatMoney(s.totalFundedCents, currency) },
    { label: "Paid out", value: formatMoney(s.totalPaidOutCents, currency) },
    {
      label: "Outstanding to suppliers",
      value: formatMoney(s.outstandingToSuppliersCents, currency),
    },
    { label: "Remaining to fund / collect", value: formatMoney(s.remainingToFundCents, currency) },
    {
      label: s.surplusOrShortfallCents >= 0 ? "Surplus" : "Shortfall",
      value: formatMoney(Math.abs(s.surplusOrShortfallCents), currency),
    },
    {
      label: "Participant balances owing",
      value: formatMoney(ledger.tripOutstandingCents, currency),
    },
    { label: "Reimbursements needed", value: formatMoney(s.reimbursableCents, currency) },
    { label: "Missing costs", value: String(s.unknownCostCount) },
    { label: "Missing invoices", value: String(s.missingInvoiceCount) },
    { label: "Missing receipts", value: String(s.missingReceiptCount) },
  ];

  const cards = items
    .map(
      (item) => `
        <div class="summary-card">
          <div class="label">${escapeHtml(item.label)}</div>
          <div class="value">${escapeHtml(item.value)}</div>
        </div>`,
    )
    .join("");

  return `
    <section class="section">
      <div class="section-head">
        <div>
          <h2 class="section-title">Trip summary</h2>
          <p class="section-desc">High-level funding and balance overview</p>
        </div>
      </div>
      <div class="summary-grid">${cards}</div>
    </section>`;
}

function personalStatementHtml(
  participant: RosterSummary["participants"][number],
  scope: FinanceExportScope,
  ledger: CostLedgerProjection,
  graph: TripEntityGraph | null | undefined,
  allocationByLine: Map<string, Record<string, number>>,
): string {
  const currency = ledger.settings.baseCurrency;
  const scopedLines = statementLinesForScope(ledger, graph, scope);
  const totals = participantStatementTotals(
    scopedLines,
    participant.id,
    ledger,
    allocationByLine,
  );

  const summaryCards = `
    <div class="personal-summary">
      <div class="personal-summary-card">
        <div class="label">Total</div>
        <div class="value">${escapeHtml(formatMoney(totals.totalCents, currency))}</div>
      </div>
      <div class="personal-summary-card accent">
        <div class="label">Total to be paid</div>
        <div class="value">${escapeHtml(formatMoney(totals.toBePaidCents, currency))}</div>
      </div>
    </div>`;

  const lineRows: string[] = [];

  if (scope === "all") {
    for (const { section, lines } of groupedStatementSections(
      scopedLines,
      graph,
      ledger.settings,
    )) {
      const sectionStatement = participantStatementLines(
        lines,
        participant.id,
        ledger,
        allocationByLine,
      );
      if (!sectionStatement.length) continue;
      lineRows.push(
        `<tr><td colspan="2" style="background:#fafafa;font-size:9pt;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;border-color:#e4e4e7">${escapeHtml(financeSectionLabel(section, ledger.settings))}</td></tr>`,
      );
      for (const { line, shareCents } of sectionStatement) {
        lineRows.push(`
          <tr class="line-row">
            <td>${escapeHtml(line.description)}</td>
            <td class="amount">${escapeHtml(formatMoney(shareCents, currency))}</td>
          </tr>`);
      }
    }
  } else {
    for (const { line, shareCents } of participantStatementLines(
      scopedLines,
      participant.id,
      ledger,
      allocationByLine,
    )) {
      lineRows.push(`
        <tr class="line-row">
          <td>${escapeHtml(line.description)}</td>
          <td class="amount">${escapeHtml(formatMoney(shareCents, currency))}</td>
        </tr>`);
    }
  }

  const table = `
    <table class="personal-table avoid-break">
      <thead>
        <tr>
          <th>Description</th>
          <th class="amount">Your cost</th>
        </tr>
      </thead>
      <tbody>
        ${lineRows.join("")}
        <tr class="total-row">
          <td>Total</td>
          <td class="amount">${escapeHtml(formatMoney(totals.totalCents, currency))}</td>
        </tr>
        <tr class="due-row">
          <td>Total to be paid</td>
          <td class="amount">${escapeHtml(formatMoney(totals.toBePaidCents, currency))}</td>
        </tr>
      </tbody>
    </table>`;

  return `
    <section class="section">
      ${summaryCards}
      ${table}
    </section>`;
}

function reportTitle(
  tripName: string,
  scope: FinanceExportScope,
  settings: CostLedgerProjection["settings"],
  participant: RosterSummary["participants"][number] | null,
): string {
  if (participant && scope !== "all") {
    return `${participant.fullName} — ${financeSectionLabel(scope, settings)}`;
  }
  if (participant) return `${participant.fullName} — Trip costs`;
  if (scope !== "all") return `${financeSectionLabel(scope, settings)} finance`;
  return tripName;
}

function reportKicker(
  scope: FinanceExportScope,
  participant: RosterSummary["participants"][number] | null,
): string {
  if (participant) return "Participant finance";
  if (scope !== "all") return "Section finance";
  return "Finance report";
}

function participantOverviewHtml(
  ledger: CostLedgerProjection,
  roster: RosterSummary,
  graph: TripEntityGraph | null | undefined,
  pool: RosterSummary["participants"],
  allocationByLine: Map<string, Record<string, number>>,
): string {
  const currency = ledger.settings.baseCurrency;
  const sections = financeSectionList(ledger.settings);
  const lines = visibleFinanceLines(ledger, graph);
  const linesBySection = groupLinesByFinanceSection(lines, graph, ledger.settings);

  const headerCells = sections
    .map((section) => {
      const sectionLines = linesBySection.get(section) ?? [];
      if (!sectionLines.length) return "";
      return `<th class="num">${escapeHtml(financeSectionLabel(section, ledger.settings))}</th>`;
    })
    .filter(Boolean)
    .join("");

  const bodyRows = pool
    .map((participant) => {
      const balance = ledger.personBalances.find((b) => b.participantId === participant.id);
      const sectionCells = sections
        .map((section) => {
          const sectionLines = linesBySection.get(section) ?? [];
          if (!sectionLines.length) return "";
          const total = sectionTotalForParticipant(
            sectionLines,
            participant.id,
            allocationByLine,
            ledger.settings,
          );
          return `<td class="num">${escapeHtml(total > 0 ? formatMoney(total, currency) : "—")}</td>`;
        })
        .filter(Boolean)
        .join("");

      const gross = logisticsGrossForParticipant(
        lines,
        participant.id,
        allocationByLine,
        ledger.settings,
        graph,
      );

      return `
        <tr>
          <td>${escapeHtml(participant.fullName)}</td>
          ${sectionCells}
          <td class="num">${escapeHtml(gross > 0 ? formatMoney(gross, currency) : "—")}</td>
          <td class="num">${escapeHtml(formatMoney(balance?.balanceCents ?? 0, currency))}</td>
        </tr>`;
    })
    .join("");

  return `
    <section class="section page-break">
      <div class="section-head">
        <div>
          <h2 class="section-title">Overall — per participant</h2>
          <p class="section-desc">Allocated share by section and balance owing</p>
        </div>
      </div>
      <table class="data avoid-break">
        <thead>
          <tr>
            <th>Participant</th>
            ${headerCells}
            <th class="num">Total allocated</th>
            <th class="num">Balance owing</th>
          </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </section>`;
}

function lineAllocationsHtml(
  line: CostLineItemDraft,
  participants: RosterSummary["participants"],
  allocationByLine: Map<string, Record<string, number>>,
  settings: CostLedgerProjection["settings"],
  currency: string,
): string {
  const rows = participants
    .map((participant) => {
      const cents = participantAllocationCents(
        line,
        participant.id,
        allocationByLine,
        settings,
      );
      if (cents <= 0) return "";
      const label = participantHeaderLabel(participant, participants);
      return `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(formatMoney(cents, currency))}</td></tr>`;
    })
    .filter(Boolean)
    .join("");

  if (!rows) return `<p class="line-meta" style="padding:8px 12px">No per-person allocations recorded.</p>`;

  return `<table class="alloc-table">${rows}</table>`;
}

function financeSectionBlockHtml(
  section: string,
  sectionLines: CostLineItemDraft[],
  ledger: CostLedgerProjection,
  roster: RosterSummary,
  graph: TripEntityGraph | null | undefined,
  pool: RosterSummary["participants"],
  allocationByLine: Map<string, Record<string, number>>,
): string {
  if (!sectionLines.length) return "";

  const currency = ledger.settings.baseCurrency;
  const sectionPool = filterParticipantsForFinanceSection(pool, ledger.settings, section);
  const label = financeSectionLabel(section, ledger.settings);
  const description = financeSectionDescription(section, ledger.settings);

  let sectionTotal = 0;
  for (const line of sectionLines) {
    sectionTotal += convertToBaseCents(line.totalAmountCents, line.currency, ledger.settings);
  }

  const lineCards = sectionLines
    .map((line) => {
      const metaParts: string[] = [];
      if (graph) {
        const span = lineDateSpanLabel(line, graph);
        if (span) metaParts.push(span);
      }
      if (line.supplierName?.trim()) metaParts.push(line.supplierName.trim());

      const totalBase = convertToBaseCents(line.totalAmountCents, line.currency, ledger.settings);

      return `
        <div class="line-card avoid-break">
          <div class="line-card-head">
            <div>
              <div class="line-title">${escapeHtml(line.description)}</div>
              ${metaParts.length ? `<div class="line-meta">${escapeHtml(metaParts.join(" · "))}</div>` : ""}
            </div>
            <div class="line-qty">${escapeHtml(lineQtyLabel(line, graph))}</div>
            <div class="line-total">${escapeHtml(totalBase > 0 ? formatMoney(totalBase, currency) : "—")}</div>
          </div>
          ${lineAllocationsHtml(line, sectionPool, allocationByLine, ledger.settings, currency)}
        </div>`;
    })
    .join("");

  const subtotalCells = sectionPool
    .map((participant) => {
      const total = sectionTotalForParticipant(
        sectionLines,
        participant.id,
        allocationByLine,
        ledger.settings,
      );
      return `<td class="num">${escapeHtml(total > 0 ? formatMoney(total, currency) : "—")}</td>`;
    })
    .join("");

  const participantHeaders = sectionPool
    .map((p) => `<th class="num">${escapeHtml(participantHeaderLabel(p, sectionPool))}</th>`)
    .join("");

  return `
    <section class="section page-break">
      <div class="section-head">
        <div>
          <h2 class="section-title">${escapeHtml(label)}</h2>
          <p class="section-desc">${escapeHtml(description)}</p>
        </div>
        <div class="section-total">${escapeHtml(formatMoney(sectionTotal, currency))}</div>
      </div>
      ${lineCards}
      <table class="data avoid-break" style="margin-top:4px">
        <thead>
          <tr>
            <th>Section subtotal</th>
            ${participantHeaders}
            <th class="num">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr class="subtotal">
            <td>${escapeHtml(label)}</td>
            ${subtotalCells}
            <td class="num">${escapeHtml(formatMoney(sectionTotal, currency))}</td>
          </tr>
        </tbody>
      </table>
    </section>`;
}

function appendixTableHtml(title: string, header: string[], rows: string[][]): string {
  if (!rows.length) return "";
  const head = header.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
  const body = rows
    .map(
      (cells) =>
        `<tr>${cells.map((c, i) => `<td${i > 0 ? ' class="num"' : ""}>${escapeHtml(c)}</td>`).join("")}</tr>`,
    )
    .join("");
  return `
    <div class="avoid-break" style="margin-bottom:22px">
      <h3 class="appendix-title">${escapeHtml(title)}</h3>
      <table class="data">
        <thead><tr>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
}

function appendixSectionHtml(
  ledger: CostLedgerProjection,
  roster: RosterSummary,
  graph: TripEntityGraph | null | undefined,
  tripName: string,
): string {
  const currency = ledger.settings.baseCurrency;
  const nameById = new Map(roster.participants.map((p) => [p.id, p.fullName]));
  const lineById = new Map(ledger.lineItems.map((l) => [l.id, l.description]));

  const costRows = ledger.lineItems.map((line) => {
    const section = financeSectionForLine(line, graph, ledger.settings);
    return [
      line.description,
      section ? financeSectionLabel(section, ledger.settings) : "",
      line.supplierName ?? "",
      formatMoney(convertToBaseCents(line.totalAmountCents, line.currency, ledger.settings), currency),
      COST_STATUS_LABELS[line.costStatus],
      LINE_PAYMENT_STATUS_LABELS[line.linePaymentStatus],
    ];
  });

  const fundRows = ledger.funds.map((f) => [
    f.name,
    formatMoney(convertToBaseCents(f.amountCents, f.currency, ledger.settings), currency),
    f.notes ?? "",
  ]);

  const paymentRows = ledger.payments.map((p) => [
    p.paidAt,
    nameById.get(p.participantId) ?? p.participantId,
    p.label,
    formatMoney(convertToBaseCents(p.amountCents, p.currency, ledger.settings), currency),
  ]);

  const supplierRows = ledger.supplierPayments.map((p) => [
    p.paidAt,
    p.paidTo,
    p.costLineItemId ? (lineById.get(p.costLineItemId) ?? "") : "",
    formatMoney(convertToBaseCents(p.amountCents, p.currency, ledger.settings), currency),
    SUPPLIER_PAYMENT_METHOD_LABELS[p.paymentMethod],
    PAID_BY_TYPE_LABELS[p.paidByType],
  ]);

  const xeroRows = ledger.lineItems
    .filter((line) => line.totalAmountCents > 0)
    .map((line) => {
      const section = financeSectionForLine(line, graph, ledger.settings);
      const sectionLabel = section
        ? financeSectionLabel(section, ledger.settings)
        : line.category;
      return [
        line.supplierName ?? "",
        `${tripName} — ${sectionLabel} — ${line.description}`,
        line.exportReference ?? line.bookingReference ?? "",
        formatMoney(line.totalAmountCents, line.currency),
        TAX_TREATMENT_LABELS[line.taxTreatment],
        FUNDING_STATUS_LABELS[line.fundingStatus],
      ];
    });

  const blocks = [
    appendixTableHtml("Cost items", ["Description", "Section", "Supplier", "Amount", "Cost", "Payment"], costRows),
    appendixTableHtml("Funds", ["Name", "Amount", "Notes"], fundRows),
    appendixTableHtml(
      "Participant payments",
      ["Date", "Participant", "Label", "Amount"],
      paymentRows,
    ),
    appendixTableHtml(
      "Supplier payments",
      ["Date", "Paid to", "Cost item", "Amount", "Method", "Paid by"],
      supplierRows,
    ),
    appendixTableHtml(
      "Xero bills",
      ["Supplier", "Description", "Reference", "Amount", "Tax", "Funding"],
      xeroRows,
    ),
  ].filter(Boolean);

  if (!blocks.length) return "";

  return `
    <section class="section page-break">
      <div class="section-head">
        <div>
          <h2 class="section-title">Appendix</h2>
          <p class="section-desc">Accounting detail for export and reconciliation</p>
        </div>
      </div>
      ${blocks.join("")}
    </section>`;
}

export function buildFinancePortraitHtml(options: {
  ledger: CostLedgerProjection;
  roster: RosterSummary;
  tripName: string;
  graph?: TripEntityGraph | null;
  filters?: FinancePortraitFilters;
}): string {
  const { ledger, roster, tripName, graph, filters } = options;
  const scope = filters?.scope ?? "all";
  const participantId = filters?.participantId ?? null;
  const currency = ledger.settings.baseCurrency;
  const generatedAt = new Date().toLocaleString(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  });

  let pool = roster.participants.filter((p) => p.inCostSplit && p.role !== "host");
  if (scope !== "all") {
    pool = filterParticipantsForFinanceSection(pool, ledger.settings, scope);
  }
  if (participantId) {
    const match = pool.find((p) => p.id === participantId);
    pool = match ? [match] : [];
  }

  const focusParticipant = participantId
    ? (pool[0] ?? roster.participants.find((p) => p.id === participantId) ?? null)
    : null;

  const allocationByLine = buildAllocationByLine(ledger);
  const lines = visibleFinanceLines(ledger, graph);
  const linesBySection = groupLinesByFinanceSection(lines, graph, ledger.settings);
  const allSections = financeSectionList(ledger.settings);
  const sectionsToRender =
    scope === "all"
      ? allSections
      : allSections.filter((section) => section === scope);

  const sectionBlocks = sectionsToRender
    .map((section) =>
      financeSectionBlockHtml(
        section,
        linesBySection.get(section) ?? [],
        ledger,
        roster,
        graph,
        pool,
        allocationByLine,
      ),
    )
    .filter(Boolean)
    .join("");

  const showTripSummary = scope === "all" && !participantId;
  const showParticipantOverview = scope === "all" && !participantId;
  const showPersonalStatement = Boolean(participantId && focusParticipant);
  const showAppendix = scope === "all" && !participantId;

  const title = reportTitle(tripName, scope, ledger.settings, focusParticipant);
  const kicker = reportKicker(scope, focusParticipant);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>${portraitStyles()}</style>
</head>
<body>
  <article class="doc">
    <header class="hero">
      <p class="hero-kicker">${escapeHtml(kicker)}</p>
      <h1 class="hero-title">${escapeHtml(title)}</h1>
      <div class="hero-meta">
        <span>Trip <strong>${escapeHtml(tripName)}</strong></span>
        <span>Generated <strong>${escapeHtml(generatedAt)}</strong></span>
        <span>Base currency <strong>${escapeHtml(currency)}</strong></span>
        ${
          focusParticipant
            ? ""
            : `<span>Participants <strong>${pool.length}</strong></span>`
        }
      </div>
    </header>

    ${showTripSummary ? summarySectionHtml(ledger, currency) : ""}
    ${
      showPersonalStatement && focusParticipant
        ? personalStatementHtml(
            focusParticipant,
            scope,
            ledger,
            graph,
            allocationByLine,
          )
        : ""
    }
    ${showParticipantOverview ? participantOverviewHtml(ledger, roster, graph, pool, allocationByLine) : ""}
    ${showPersonalStatement ? "" : sectionBlocks}
    ${showAppendix ? appendixSectionHtml(ledger, roster, graph, tripName) : ""}

    <p class="footnote">Open in a browser and choose Print → Save as PDF for a portrait PDF copy.</p>
  </article>
</body>
</html>`;
}

export function downloadHtml(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/html;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadFinancePortraitReport(options: {
  ledger: CostLedgerProjection;
  roster: RosterSummary;
  tripName: string;
  graph?: TripEntityGraph | null;
}): void {
  const slug = options.tripName.replace(/[^\w-]+/g, "_").slice(0, 40) || "trip";
  const html = buildFinancePortraitHtml(options);
  downloadHtml(`${slug}_finance_report.html`, html);
}
