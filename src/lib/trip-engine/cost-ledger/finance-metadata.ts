export type CostStatus =
  | "unknown"
  | "estimate"
  | "quoted"
  | "confirmed"
  | "invoiced"
  | "paid"
  | "cancelled"
  | "no_cost";

export type LinePaymentStatus =
  | "unpaid"
  | "deposit_paid"
  | "part_paid"
  | "paid"
  | "reimbursable";

export type FundingStatus = "unfunded" | "part_funded" | "fully_funded";

export type TaxTreatment = "no_gst" | "gst" | "gst_exempt" | "overseas" | "unknown";

export type PaidByType =
  | "school_bank"
  | "school_card"
  | "staff_member"
  | "student_parent"
  | "grant_fund"
  | "payshare"
  | "other";

export type SupplierPaymentMethod =
  | "bank_transfer"
  | "card"
  | "cash"
  | "payshare"
  | "invoice_payment"
  | "other";

export const COST_STATUSES: CostStatus[] = [
  "unknown",
  "estimate",
  "quoted",
  "confirmed",
  "invoiced",
  "paid",
  "cancelled",
  "no_cost",
];

export const LINE_PAYMENT_STATUSES: LinePaymentStatus[] = [
  "unpaid",
  "deposit_paid",
  "part_paid",
  "paid",
  "reimbursable",
];

export const FUNDING_STATUSES: FundingStatus[] = [
  "unfunded",
  "part_funded",
  "fully_funded",
];

export const TAX_TREATMENTS: TaxTreatment[] = [
  "no_gst",
  "gst",
  "gst_exempt",
  "overseas",
  "unknown",
];

export const PAID_BY_TYPES: PaidByType[] = [
  "school_bank",
  "school_card",
  "staff_member",
  "student_parent",
  "grant_fund",
  "payshare",
  "other",
];

export const SUPPLIER_PAYMENT_METHODS: SupplierPaymentMethod[] = [
  "bank_transfer",
  "card",
  "cash",
  "payshare",
  "invoice_payment",
  "other",
];

export const COST_STATUS_LABELS: Record<CostStatus, string> = {
  unknown: "Unknown",
  estimate: "Estimate",
  quoted: "Quoted",
  confirmed: "Confirmed",
  invoiced: "Invoiced",
  paid: "Paid",
  cancelled: "Cancelled",
  no_cost: "No cost",
};

export function lineIsIntentionallyNoCost(line: { costStatus: CostStatus }): boolean {
  return line.costStatus === "no_cost";
}

export const LINE_PAYMENT_STATUS_LABELS: Record<LinePaymentStatus, string> = {
  unpaid: "Unpaid",
  deposit_paid: "Deposit paid",
  part_paid: "Part-paid",
  paid: "Paid",
  reimbursable: "Reimbursable",
};

export const FUNDING_STATUS_LABELS: Record<FundingStatus, string> = {
  unfunded: "Unfunded",
  part_funded: "Part-funded",
  fully_funded: "Fully funded",
};

export const TAX_TREATMENT_LABELS: Record<TaxTreatment, string> = {
  no_gst: "No GST",
  gst: "GST",
  gst_exempt: "GST exempt",
  overseas: "Overseas / no GST",
  unknown: "Unknown",
};

export const PAID_BY_TYPE_LABELS: Record<PaidByType, string> = {
  school_bank: "School bank account",
  school_card: "School card",
  staff_member: "Staff member",
  student_parent: "Student / parent",
  grant_fund: "Grant / fund",
  payshare: "PayShare",
  other: "Other",
};

export const SUPPLIER_PAYMENT_METHOD_LABELS: Record<SupplierPaymentMethod, string> = {
  bank_transfer: "Bank transfer",
  card: "Card",
  cash: "Cash",
  payshare: "PayShare",
  invoice_payment: "Invoice payment",
  other: "Other",
};

export function compactStatusSummary(
  costStatus: CostStatus,
  linePaymentStatus: LinePaymentStatus,
  fundingStatus: FundingStatus,
): string {
  const parts = [
    COST_STATUS_LABELS[costStatus],
    LINE_PAYMENT_STATUS_LABELS[linePaymentStatus],
    FUNDING_STATUS_LABELS[fundingStatus],
  ];
  return parts.join(" · ");
}

/** Suggest payment status from supplier payouts vs line total (does not overwrite manual statuses). */
export function suggestLinePaymentStatus(
  totalCents: number,
  paidCents: number,
  current: LinePaymentStatus,
): LinePaymentStatus {
  if (current === "reimbursable") return current;
  if (totalCents <= 0 || paidCents <= 0) return current === "paid" ? current : "unpaid";
  if (paidCents >= totalCents) return "paid";
  if (paidCents > 0) {
    return paidCents < totalCents * 0.25 ? "deposit_paid" : "part_paid";
  }
  return "unpaid";
}

export function defaultCostLineFinanceFields() {
  return {
    costStatus: "unknown" as const,
    linePaymentStatus: "unpaid" as const,
    fundingStatus: "unfunded" as const,
    supplierName: null,
    estimatedAmountCents: null,
    actualAmountCents: null,
    taxTreatment: "unknown" as const,
    exportCategoryLabel: null,
    exportReference: null,
    bookingReference: null,
    invoiceRecorded: false,
    receiptRecorded: false,
  };
}
