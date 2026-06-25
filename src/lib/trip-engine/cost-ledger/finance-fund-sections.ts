import { FINANCE_OTHER_SECTION } from "./finance-sections";
import type { FinanceEntitySection } from "./finance-sections";
import type { TripCostSettingsDraft, TripFundDraft } from "./types";

export function primaryMiscFinanceSection(
  _settings?: TripCostSettingsDraft,
): FinanceEntitySection {
  return FINANCE_OTHER_SECTION;
}

export function isOrphanFinanceFund(fund: TripFundDraft): boolean {
  return !fund.allocationRulePayload.financeSection;
}

export function fundBelongsToFinanceSection(
  fund: TripFundDraft,
  section: FinanceEntitySection,
): boolean {
  const fundSection = fund.allocationRulePayload.financeSection;
  if (fundSection === section) return true;
  if (!fundSection && section === FINANCE_OTHER_SECTION) return true;
  return false;
}

export function fundsForFinanceSection(
  funds: TripFundDraft[],
  section: FinanceEntitySection | null,
): TripFundDraft[] {
  if (!section) return funds;
  return funds.filter((fund) => fundBelongsToFinanceSection(fund, section));
}

/** Overall is expense rollups only — payment lines live on section tabs. */
export function fundsForOverallView(_funds: TripFundDraft[]): TripFundDraft[] {
  return [];
}

export function hasEmptyFundForSection(
  funds: TripFundDraft[],
  section: FinanceEntitySection,
): boolean {
  return fundsForFinanceSection(funds, section).some((fund) => fund.amountCents === 0);
}
