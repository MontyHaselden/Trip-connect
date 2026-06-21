import type { CostLedgerProjection } from "./types";
import { COST_CATEGORIES } from "./types";

export function emptyCostLedgerProjection(
  settings?: Partial<CostLedgerProjection["settings"]>,
): CostLedgerProjection {
  const base = {
    baseCurrency: "NZD",
    foreignCurrency: null,
    exchangeRate: null,
    exchangeRateDate: null,
    exchangeRateManual: false,
    ...settings,
  };
  return {
    settings: base,
    lineItems: [],
    lineAllocations: [],
    funds: [],
    fundAllocations: {},
    payments: [],
    personBalances: [],
    categoryTotals: Object.fromEntries(COST_CATEGORIES.map((c) => [c, 0])) as CostLedgerProjection["categoryTotals"],
    tripGrossCents: 0,
    tripFundCreditsCents: 0,
    tripPaidCents: 0,
    tripOutstandingCents: 0,
  };
}
