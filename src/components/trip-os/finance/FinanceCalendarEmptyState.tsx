import {
  isFinanceCalendarSection,
  type FinanceEntitySection,
} from "@/lib/trip-engine/cost-ledger/finance-sections";

export function financeCalendarEmptyNote(props: {
  section: FinanceEntitySection;
  hiddenWithAmounts?: boolean;
  manualSection?: boolean;
}): string {
  const builtIn = isFinanceCalendarSection(props.section);

  if (props.hiddenWithAmounts) {
    return "Linked calendar rows are hidden. Turn on Show empty to see and price them.";
  }
  if (props.manualSection || !builtIn) {
    return "Add expense lines with the + button in the header row above.";
  }
  return "Add on the trip calendar — it will appear here automatically.";
}
