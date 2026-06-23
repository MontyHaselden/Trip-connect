import type { CostStatus, FundingStatus, LinePaymentStatus, TaxTreatment } from "@/lib/trip-engine/cost-ledger/finance-metadata";
import type { CostLineItemDraft } from "@/lib/trip-engine/cost-ledger/types";

export type FinanceLineFormValues = {
  description: string;
  notes: string;
  supplierName: string;
  costStatus: CostStatus;
  linePaymentStatus: LinePaymentStatus;
  fundingStatus: FundingStatus;
  estimatedAmountCents: number | null;
  actualAmountCents: number | null;
  taxTreatment: TaxTreatment;
  exportCategoryLabel: string;
  exportReference: string;
  bookingReference: string;
  invoiceRecorded: boolean;
  receiptRecorded: boolean;
};

export function lineToFinanceFormValues(line: CostLineItemDraft): FinanceLineFormValues {
  return {
    description: line.description,
    notes: line.notes ?? "",
    supplierName: line.supplierName ?? "",
    costStatus: line.costStatus,
    linePaymentStatus: line.linePaymentStatus,
    fundingStatus: line.fundingStatus,
    estimatedAmountCents: line.estimatedAmountCents,
    actualAmountCents: line.actualAmountCents,
    taxTreatment: line.taxTreatment,
    exportCategoryLabel: line.exportCategoryLabel ?? "",
    exportReference: line.exportReference ?? "",
    bookingReference: line.bookingReference ?? "",
    invoiceRecorded: line.invoiceRecorded,
    receiptRecorded: line.receiptRecorded,
  };
}

export function financeLinePatch(values: FinanceLineFormValues): Record<string, unknown> {
  return {
    description: values.description.trim(),
    notes: values.notes.trim() || null,
    supplierName: values.supplierName.trim() || null,
    costStatus: values.costStatus,
    linePaymentStatus: values.linePaymentStatus,
    fundingStatus: values.fundingStatus,
    estimatedAmountCents: values.estimatedAmountCents,
    actualAmountCents: values.actualAmountCents,
    taxTreatment: values.taxTreatment,
    exportCategoryLabel: values.exportCategoryLabel.trim() || null,
    exportReference: values.exportReference.trim() || null,
    bookingReference: values.bookingReference.trim() || null,
    invoiceRecorded: values.invoiceRecorded,
    receiptRecorded: values.receiptRecorded,
  };
}
