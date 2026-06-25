import {
  COST_STATUS_LABELS,
  FUNDING_STATUS_LABELS,
  LINE_PAYMENT_STATUS_LABELS,
  TAX_TREATMENT_LABELS,
  PAID_BY_TYPE_LABELS,
  SUPPLIER_PAYMENT_METHOD_LABELS,
} from "./finance-metadata";
import { computeFinanceTripSummary } from "./finance-summary";
import {
  financeSectionForLine,
  financeSectionLabel,
} from "./finance-sections";
import { convertToBaseCents, formatMoneyAmount } from "./format-money";
import { downloadFinancePortraitReport } from "./export-finance-portrait";
import type { CostLedgerProjection } from "./types";
import type { RosterSummary, TripEntityGraph } from "../types";

function escapeCsv(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowToCsv(cells: (string | number | null | undefined)[]): string {
  return cells.map(escapeCsv).join(",");
}

function centsDisplay(cents: number, currency: string): string {
  return formatMoneyAmount(cents, currency);
}

export function buildTripFinanceSummaryCsv(
  ledger: CostLedgerProjection,
  tripName: string,
): string {
  const s = computeFinanceTripSummary(ledger);
  const currency = ledger.settings.baseCurrency;
  const rows = [
    rowToCsv(["Field", "Value"]),
    rowToCsv(["Trip", tripName]),
    rowToCsv(["Currency", currency]),
    rowToCsv(["Total trip cost", centsDisplay(s.totalTripCostCents, currency)]),
    rowToCsv(["Funded", centsDisplay(s.totalFundedCents, currency)]),
    rowToCsv(["Paid out to suppliers", centsDisplay(s.totalPaidOutCents, currency)]),
    rowToCsv(["Outstanding to suppliers", centsDisplay(s.outstandingToSuppliersCents, currency)]),
    rowToCsv(["Remaining to fund / collect", centsDisplay(s.remainingToFundCents, currency)]),
    rowToCsv([
      s.surplusOrShortfallCents >= 0 ? "Surplus" : "Shortfall",
      centsDisplay(Math.abs(s.surplusOrShortfallCents), currency),
    ]),
    rowToCsv(["Reimbursements needed", centsDisplay(s.reimbursableCents, currency)]),
    rowToCsv(["Rows with no cost", s.unknownCostCount]),
    rowToCsv(["Missing invoices", s.missingInvoiceCount]),
    rowToCsv(["Missing receipts", s.missingReceiptCount]),
    rowToCsv(["Participant balances outstanding", centsDisplay(ledger.tripOutstandingCents, currency)]),
  ];
  return rows.join("\n");
}

export function buildCostItemsCsv(
  ledger: CostLedgerProjection,
  graph?: TripEntityGraph | null,
): string {
  const header = rowToCsv([
    "Description",
    "Category",
    "Section",
    "Supplier",
    "Amount",
    "Currency",
    "Cost status",
    "Payment status",
    "Funding status",
    "Estimated",
    "Actual",
    "Tax treatment",
    "Export category",
    "Export reference",
    "Booking reference",
    "Invoice recorded",
    "Receipt recorded",
    "Notes",
  ]);
  const lines = ledger.lineItems.map((line) => {
    const section = financeSectionForLine(line, graph, ledger.settings);
    return rowToCsv([
      line.description,
      line.category,
      section ? financeSectionLabel(section, ledger.settings) : "",
      line.supplierName,
      centsDisplay(line.totalAmountCents, line.currency),
      line.currency,
      COST_STATUS_LABELS[line.costStatus],
      LINE_PAYMENT_STATUS_LABELS[line.linePaymentStatus],
      FUNDING_STATUS_LABELS[line.fundingStatus],
      line.estimatedAmountCents != null
        ? centsDisplay(line.estimatedAmountCents, line.currency)
        : "",
      line.actualAmountCents != null
        ? centsDisplay(line.actualAmountCents, line.currency)
        : "",
      TAX_TREATMENT_LABELS[line.taxTreatment],
      line.exportCategoryLabel,
      line.exportReference,
      line.bookingReference,
      line.invoiceRecorded ? "yes" : "no",
      line.receiptRecorded ? "yes" : "no",
      line.notes,
    ]);
  });
  return [header, ...lines].join("\n");
}

export function buildPaymentsCsv(ledger: CostLedgerProjection): string {
  const header = rowToCsv([
    "Date",
    "Paid by",
    "Paid by name",
    "Paid to",
    "Linked cost item",
    "Amount",
    "Currency",
    "Method",
    "Reference",
    "Receipt status",
    "Reimbursement needed",
    "Notes",
  ]);
  const lineById = new Map(ledger.lineItems.map((l) => [l.id, l.description]));
  const rows = ledger.supplierPayments.map((p) =>
    rowToCsv([
      p.paidAt,
      PAID_BY_TYPE_LABELS[p.paidByType],
      p.paidByName,
      p.paidTo,
      p.costLineItemId ? lineById.get(p.costLineItemId) : "",
      centsDisplay(p.amountCents, p.currency),
      p.currency,
      SUPPLIER_PAYMENT_METHOD_LABELS[p.paymentMethod],
      p.reference,
      p.receiptStatus,
      p.reimbursementNeeded ? "yes" : "no",
      p.notes,
    ]),
  );
  return [header, ...rows].join("\n");
}

export function buildParticipantPaymentsCsv(ledger: CostLedgerProjection, roster: RosterSummary): string {
  const header = rowToCsv([
    "Date",
    "Participant",
    "Label",
    "Amount",
    "Currency",
    "Notes",
  ]);
  const nameById = new Map(roster.participants.map((p) => [p.id, p.fullName]));
  const rows = ledger.payments.map((p) =>
    rowToCsv([
      p.paidAt,
      nameById.get(p.participantId) ?? p.participantId,
      p.label,
      centsDisplay(p.amountCents, p.currency),
      p.currency,
      p.notes,
    ]),
  );
  return [header, ...rows].join("\n");
}

export function buildFundsCsv(ledger: CostLedgerProjection): string {
  const header = rowToCsv(["Name", "Amount", "Currency", "Notes"]);
  const rows = ledger.funds.map((f) =>
    rowToCsv([f.name, centsDisplay(f.amountCents, f.currency), f.currency, f.notes]),
  );
  return [header, ...rows].join("\n");
}


export function buildParticipantBalancesCsv(
  ledger: CostLedgerProjection,
  roster: RosterSummary,
  graph?: TripEntityGraph | null,
): string {
  const header = rowToCsv([
    "Participant",
    "Accommodation share",
    "Transport share",
    "Activities share",
    "Other share",
    "Total allocated",
    "Fund credits",
    "Paid by participant",
    "Balance owing",
  ]);
  const currency = ledger.settings.baseCurrency;
  const pool = roster.participants.filter((p) => p.inCostSplit && p.role !== "host");

  const rows = pool.map((participant) => {
    const balance = ledger.personBalances.find((b) => b.participantId === participant.id);
    let accommodation = 0;
    let transport = 0;
    let activities = 0;
    let other = 0;

    for (const line of ledger.lineItems) {
      const section = financeSectionForLine(line, graph);
      const alloc =
        ledger.lineAllocations.find((a) => a.lineItemId === line.id)?.allocations[
          participant.id
        ] ?? 0;
      const base = convertToBaseCents(alloc, line.currency, ledger.settings);
      if (section === "accommodation") accommodation += base;
      else if (section === "transport") transport += base;
      else if (section === "activities") activities += base;
      else other += base;
    }

    return rowToCsv([
      participant.fullName,
      centsDisplay(accommodation, currency),
      centsDisplay(transport, currency),
      centsDisplay(activities, currency),
      centsDisplay(other, currency),
      centsDisplay(balance?.grossCents ?? 0, currency),
      centsDisplay(balance?.fundCreditsCents ?? 0, currency),
      centsDisplay(balance?.paidCents ?? 0, currency),
      centsDisplay(balance?.balanceCents ?? 0, currency),
    ]);
  });

  return [header, ...rows].join("\n");
}

export function buildXeroBillsCsv(
  ledger: CostLedgerProjection,
  tripName: string,
  graph?: TripEntityGraph | null,
): string {
  const header = rowToCsv([
    "Supplier name",
    "Invoice date",
    "Due date",
    "Description",
    "Reference",
    "Currency",
    "Amount",
    "Tax treatment",
    "Category/account label",
    "Tracking label",
    "Linked itinerary item",
    "Notes",
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const rows = ledger.lineItems
    .filter((line) => line.totalAmountCents > 0)
    .map((line) => {
      const section = financeSectionForLine(line, graph, ledger.settings);
      const sectionLabel = section
        ? financeSectionLabel(section, ledger.settings)
        : line.category;
      const description = `${tripName} — ${sectionLabel} — ${line.description}`;
      return rowToCsv([
        line.supplierName ?? "",
        today,
        "",
        description,
        line.exportReference ?? line.bookingReference ?? "",
        line.currency,
        centsDisplay(line.totalAmountCents, line.currency),
        TAX_TREATMENT_LABELS[line.taxTreatment],
        line.exportCategoryLabel ?? sectionLabel,
        tripName,
        line.description,
        line.notes,
      ]);
    });
  return [header, ...rows].join("\n");
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type FinanceExportKind =
  | "portrait"
  | "summary"
  | "cost_items"
  | "supplier_payments"
  | "participant_payments"
  | "funds"
  | "participant_balances"
  | "xero_bills";

export type FinanceExportContext = {
  ledger: CostLedgerProjection;
  roster: RosterSummary;
  tripName: string;
  graph?: TripEntityGraph | null;
};

export const FINANCE_EXPORT_OPTIONS: {
  id: FinanceExportKind;
  label: string;
  description: string;
}[] = [
  {
    id: "portrait",
    label: "Finance report (HTML)",
    description: "Printable spreadsheet-style report with sections and per-person totals",
  },
  {
    id: "summary",
    label: "Trip finance summary (CSV)",
    description: "Totals, funding, outstanding, and checklist counts",
  },
  {
    id: "cost_items",
    label: "Cost items (CSV)",
    description: "Every finance row with status, supplier, and export fields",
  },
  {
    id: "supplier_payments",
    label: "Supplier payments (CSV)",
    description: "Money paid out to hotels, operators, etc.",
  },
  {
    id: "participant_payments",
    label: "Parent / participant payments (CSV)",
    description: "Deposits and payments received from families",
  },
  {
    id: "funds",
    label: "Funds (CSV)",
    description: "Grants, school contributions, and other funding",
  },
  {
    id: "participant_balances",
    label: "Participant balances (CSV)",
    description: "Per-person shares, credits, paid amounts, and balance owing",
  },
  {
    id: "xero_bills",
    label: "Xero-ready bills (CSV)",
    description: "Supplier bills formatted for manual import into Xero",
  },
];

function tripExportSlug(tripName: string): string {
  return tripName.replace(/[^\w-]+/g, "_").slice(0, 40) || "trip";
}

/** Download only the export types the user selected. */
export function downloadFinanceExports(
  kinds: FinanceExportKind[],
  options: FinanceExportContext,
): void {
  if (!kinds.length) return;

  const slug = tripExportSlug(options.tripName);
  const { ledger, roster, tripName, graph } = options;

  for (const kind of kinds) {
    switch (kind) {
      case "portrait":
        downloadFinancePortraitReport(options);
        break;
      case "summary":
        downloadCsv(`${slug}_finance_summary.csv`, buildTripFinanceSummaryCsv(ledger, tripName));
        break;
      case "cost_items":
        downloadCsv(`${slug}_cost_items.csv`, buildCostItemsCsv(ledger, graph));
        break;
      case "supplier_payments":
        downloadCsv(`${slug}_supplier_payments.csv`, buildPaymentsCsv(ledger));
        break;
      case "participant_payments":
        downloadCsv(
          `${slug}_participant_payments.csv`,
          buildParticipantPaymentsCsv(ledger, roster),
        );
        break;
      case "funds":
        downloadCsv(`${slug}_funds.csv`, buildFundsCsv(ledger));
        break;
      case "participant_balances":
        downloadCsv(
          `${slug}_participant_balances.csv`,
          buildParticipantBalancesCsv(ledger, roster, graph),
        );
        break;
      case "xero_bills":
        downloadCsv(`${slug}_xero_bills.csv`, buildXeroBillsCsv(ledger, tripName, graph));
        break;
    }
  }
}

/** @deprecated Use downloadFinanceExports with explicit kinds. */
export function downloadFinancePack(options: FinanceExportContext): void {
  downloadFinanceExports(["portrait", "cost_items", "xero_bills"], options);
}
