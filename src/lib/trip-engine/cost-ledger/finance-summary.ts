import { convertToBaseCents } from "./format-money";
import type {
  CostLedgerProjection,
  CostLineItemDraft,
  SupplierPaymentDraft,
  TripCostSettingsDraft,
} from "./types";

export type FinanceTripSummary = {
  totalTripCostCents: number;
  /** Trip-level funds (grants, school pool, etc.) — not supplier payouts. */
  totalFundedCents: number;
  /** Family / student payments recorded against participants. */
  totalFamilyPaymentsCents: number;
  /** All money collected toward the trip (funds + family payments). */
  totalCollectedCents: number;
  /** Money paid out to suppliers (separate from funding). */
  totalPaidOutCents: number;
  outstandingToSuppliersCents: number;
  remainingToFundCents: number;
  surplusOrShortfallCents: number;
  reimbursableCents: number;
  unknownCostCount: number;
  missingInvoiceCount: number;
  missingReceiptCount: number;
};

export type FinanceWarning = {
  id: string;
  severity: "info" | "warn";
  message: string;
  lineId?: string;
};

function lineCostBase(line: CostLineItemDraft, settings: TripCostSettingsDraft): number {
  const cents = line.actualAmountCents ?? line.totalAmountCents;
  return convertToBaseCents(cents, line.currency, settings);
}

function paidOutForLine(
  lineId: string,
  supplierPayments: SupplierPaymentDraft[],
  settings: TripCostSettingsDraft,
): number {
  return supplierPayments
    .filter((p) => p.costLineItemId === lineId)
    .reduce((sum, p) => sum + convertToBaseCents(p.amountCents, p.currency, settings), 0);
}

export function computeFinanceTripSummary(
  ledger: CostLedgerProjection,
): FinanceTripSummary {
  const { settings, lineItems, funds, supplierPayments } = ledger;

  const totalTripCostCents = ledger.tripGrossCents;
  const totalFundedCents = funds.reduce(
    (sum, f) => sum + convertToBaseCents(f.amountCents, f.currency, settings),
    0,
  );
  const totalFamilyPaymentsCents = ledger.payments.reduce(
    (sum, p) => sum + convertToBaseCents(p.amountCents, p.currency, settings),
    0,
  );
  const totalCollectedCents = totalFundedCents + totalFamilyPaymentsCents;
  const totalPaidOutCents = supplierPayments.reduce(
    (sum, p) => sum + convertToBaseCents(p.amountCents, p.currency, settings),
    0,
  );

  let outstandingToSuppliersCents = 0;
  let unknownCostCount = 0;
  let missingInvoiceCount = 0;
  let missingReceiptCount = 0;

  for (const line of lineItems) {
    const cost = lineCostBase(line, settings);
    const paid = paidOutForLine(line.id, supplierPayments, settings);
    outstandingToSuppliersCents += Math.max(0, cost - paid);

    if (
      line.totalAmountCents === 0 &&
      line.costStatus === "unknown"
    ) {
      unknownCostCount += 1;
    }
    if (
      (line.costStatus === "confirmed" ||
        line.costStatus === "invoiced" ||
        line.costStatus === "paid") &&
      !line.invoiceRecorded
    ) {
      missingInvoiceCount += 1;
    }
    if (
      (line.linePaymentStatus === "paid" || line.costStatus === "paid") &&
      !line.receiptRecorded
    ) {
      missingReceiptCount += 1;
    }
  }

  const remainingToFundCents = Math.max(0, totalTripCostCents - totalCollectedCents);
  const surplusOrShortfallCents = totalCollectedCents - totalTripCostCents;
  const reimbursableCents = supplierPayments
    .filter((p) => p.reimbursementNeeded)
    .reduce(
      (sum, p) => sum + convertToBaseCents(p.amountCents, p.currency, settings),
      0,
    );

  return {
    totalTripCostCents,
    totalFundedCents,
    totalFamilyPaymentsCents,
    totalCollectedCents,
    totalPaidOutCents,
    outstandingToSuppliersCents,
    remainingToFundCents,
    surplusOrShortfallCents,
    reimbursableCents,
    unknownCostCount,
    missingInvoiceCount,
    missingReceiptCount,
  };
}

export function computeFinanceWarnings(
  ledger: CostLedgerProjection,
): FinanceWarning[] {
  const warnings: FinanceWarning[] = [];
  const { settings, lineItems, supplierPayments } = ledger;

  for (const line of lineItems) {
    if (line.totalAmountCents === 0 && line.costStatus !== "no_cost") {
      warnings.push({
        id: `no-cost-${line.id}`,
        severity: "info",
        message: `"${line.description}" has no cost entered yet`,
        lineId: line.id,
      });
    }

    if (
      (line.costStatus === "confirmed" || line.costStatus === "invoiced") &&
      !line.invoiceRecorded
    ) {
      warnings.push({
        id: `no-invoice-${line.id}`,
        severity: "warn",
        message: `"${line.description}" is confirmed but has no invoice recorded`,
        lineId: line.id,
      });
    }

    if (
      (line.linePaymentStatus === "paid" || line.costStatus === "paid") &&
      !line.receiptRecorded
    ) {
      warnings.push({
        id: `no-receipt-${line.id}`,
        severity: "warn",
        message: `"${line.description}" is marked paid but has no receipt recorded`,
        lineId: line.id,
      });
    }

    const linkedPayments = supplierPayments.filter(
      (p) => p.costLineItemId === line.id && p.reimbursementNeeded,
    );
    if (linkedPayments.length) {
      warnings.push({
        id: `reimburse-${line.id}`,
        severity: "info",
        message: `"${line.description}" has ${linkedPayments.length} payment(s) needing reimbursement`,
        lineId: line.id,
      });
    }

    const estimate = line.estimatedAmountCents;
    const actual = line.actualAmountCents;
    if (
      estimate != null &&
      actual != null &&
      actual > estimate &&
      line.totalAmountCents > 0
    ) {
      warnings.push({
        id: `variance-${line.id}`,
        severity: "warn",
        message: `"${line.description}" actual cost exceeds estimate`,
        lineId: line.id,
      });
    }
  }

  return warnings.slice(0, 12);
}

export function paidCentsForLine(
  lineId: string,
  supplierPayments: SupplierPaymentDraft[],
  settings: TripCostSettingsDraft,
): number {
  return paidOutForLine(lineId, supplierPayments, settings);
}

export function outstandingCentsForLine(
  line: CostLineItemDraft,
  supplierPayments: SupplierPaymentDraft[],
  settings: TripCostSettingsDraft,
): number {
  const cost = lineCostBase(line, settings);
  const paid = paidOutForLine(line.id, supplierPayments, settings);
  return Math.max(0, cost - paid);
}
