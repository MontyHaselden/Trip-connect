export type CostLineCategory =
  | "flights"
  | "transport"
  | "insurance"
  | "accommodation"
  | "meals"
  | "activities"
  | "other";

export type CostAllocationRuleType =
  | "equal_cost_participants"
  | "equal_group"
  | "equal_present"
  | "assign_one"
  | "manual";

export type CostLineScope = "presence" | "trip_wide";

export type CostAllocationRulePayload = {
  groupId?: string;
  participantId?: string;
};

export type CostLineItemDraft = {
  id: string;
  sortOrder: number;
  category: CostLineCategory;
  description: string;
  notes: string | null;
  totalAmountCents: number;
  currency: string;
  quantity: number | null;
  allocationRuleType: CostAllocationRuleType;
  allocationRulePayload: CostAllocationRulePayload;
  linkedStayId: string | null;
  linkedTransportLegId: string | null;
  linkedActivityId: string | null;
  scope: CostLineScope;
  supplierPaymentStatus: "estimated" | "invoiced" | "paid" | null;
};

export type CostAllocationOverrideDraft = {
  lineItemId: string;
  participantId: string;
  amountCents: number;
};

export type TripFundDraft = {
  id: string;
  name: string;
  amountCents: number;
  currency: string;
  allocationRuleType: CostAllocationRuleType;
  allocationRulePayload: CostAllocationRulePayload;
  sortOrder: number;
  notes: string | null;
};

export type ParticipantPaymentDraft = {
  id: string;
  participantId: string;
  amountCents: number;
  currency: string;
  paidAt: string;
  label: string;
  notes: string | null;
};

export type TripCostSettingsDraft = {
  baseCurrency: string;
  foreignCurrency: string | null;
  exchangeRate: number | null;
  exchangeRateDate: string | null;
  exchangeRateManual: boolean;
};

export type CostLedgerRaw = {
  settings: TripCostSettingsDraft;
  lineItems: CostLineItemDraft[];
  overrides: CostAllocationOverrideDraft[];
  funds: TripFundDraft[];
  payments: ParticipantPaymentDraft[];
};

export type AllocatableItem = {
  id: string;
  totalAmountCents: number;
  currency: string;
  allocationRuleType: CostAllocationRuleType;
  allocationRulePayload: CostAllocationRulePayload;
  scope?: CostLineScope;
  linkedStayId?: string | null;
  linkedTransportLegId?: string | null;
  linkedActivityId?: string | null;
};

export type LineAllocationResult = {
  lineItemId: string;
  allocations: Record<string, number>;
  eligibleParticipantIds: string[];
  balanced: boolean;
  allocatedTotalCents: number;
};

export type PersonBalance = {
  participantId: string;
  grossCents: number;
  fundCreditsCents: number;
  paidCents: number;
  balanceCents: number;
};

export type CostLedgerProjection = {
  settings: TripCostSettingsDraft;
  lineItems: CostLineItemDraft[];
  lineAllocations: LineAllocationResult[];
  funds: TripFundDraft[];
  fundAllocations: Record<string, Record<string, number>>;
  payments: ParticipantPaymentDraft[];
  personBalances: PersonBalance[];
  categoryTotals: Record<CostLineCategory, number>;
  tripGrossCents: number;
  tripFundCreditsCents: number;
  tripPaidCents: number;
  tripOutstandingCents: number;
};

export const COST_CATEGORIES: CostLineCategory[] = [
  "flights",
  "transport",
  "insurance",
  "accommodation",
  "meals",
  "activities",
  "other",
];

export const COST_CATEGORY_LABELS: Record<CostLineCategory, string> = {
  flights: "Flights",
  transport: "Transport",
  insurance: "Insurance",
  accommodation: "Accommodation",
  meals: "Meals",
  activities: "Activities / tourist",
  other: "Other",
};
