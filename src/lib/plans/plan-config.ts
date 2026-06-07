export type AccountType = "school" | "personal" | "organisation_interest";

export type SubscriptionPlan =
  | "school_starter"
  | "school_pro"
  | "school_pro_plus"
  | "personal_one_time"
  | "personal"
  | "personal_pro";

export type PlanLimits = {
  label: string;
  accountType: AccountType;
  staffAccounts: number;
  activeTrips: number;
  groupMax: number | null;
  aiBuilder: boolean;
  aiPhrases: boolean;
  schoolTools: boolean;
  validityMonths: number | null;
  priceLabel: string;
};

export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  school_starter: {
    label: "School Starter",
    accountType: "school",
    staffAccounts: 3,
    activeTrips: 4,
    groupMax: null,
    aiBuilder: false,
    aiPhrases: false,
    schoolTools: true,
    validityMonths: 12,
    priceLabel: "$150/year",
  },
  school_pro: {
    label: "School Pro",
    accountType: "school",
    staffAccounts: 6,
    activeTrips: 8,
    groupMax: null,
    aiBuilder: true,
    aiPhrases: true,
    schoolTools: true,
    validityMonths: 12,
    priceLabel: "$250/year",
  },
  school_pro_plus: {
    label: "School Pro+",
    accountType: "school",
    staffAccounts: 12,
    activeTrips: 20,
    groupMax: null,
    aiBuilder: true,
    aiPhrases: true,
    schoolTools: true,
    validityMonths: 12,
    priceLabel: "$400/year",
  },
  personal_one_time: {
    label: "Personal One-Time Trip",
    accountType: "personal",
    staffAccounts: 1,
    activeTrips: 1,
    groupMax: 6,
    aiBuilder: false,
    aiPhrases: false,
    schoolTools: false,
    validityMonths: 6,
    priceLabel: "$18 once",
  },
  personal: {
    label: "Personal",
    accountType: "personal",
    staffAccounts: 1,
    activeTrips: 2,
    groupMax: 6,
    aiBuilder: false,
    aiPhrases: false,
    schoolTools: false,
    validityMonths: 12,
    priceLabel: "$40/year",
  },
  personal_pro: {
    label: "Personal Pro",
    accountType: "personal",
    staffAccounts: 1,
    activeTrips: 5,
    groupMax: 15,
    aiBuilder: true,
    aiPhrases: false,
    schoolTools: false,
    validityMonths: 12,
    priceLabel: "$80/year",
  },
};

export const SCHOOL_PLANS: SubscriptionPlan[] = [
  "school_starter",
  "school_pro",
  "school_pro_plus",
];

export const PERSONAL_PLANS: SubscriptionPlan[] = [
  "personal_one_time",
  "personal",
  "personal_pro",
];

/** Sync fallback for dev/tests. Prefer `getPlanLimitsFromDb` on the server. */
export function getPlanLimits(plan: SubscriptionPlan): PlanLimits {
  return PLAN_LIMITS[plan];
}

export function canCreateActiveTrip(params: {
  plan: SubscriptionPlan;
  activeTripCount: number;
}): { allowed: boolean; reason?: string } {
  const limits = getPlanLimits(params.plan);
  if (params.activeTripCount >= limits.activeTrips) {
    return {
      allowed: false,
      reason: `Your ${limits.label} plan allows up to ${limits.activeTrips} active trips. Completed trips move to history and free up a slot.`,
    };
  }
  return { allowed: true };
}

export function hasAiBuilder(plan: SubscriptionPlan): boolean {
  return getPlanLimits(plan).aiBuilder;
}
