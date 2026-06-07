import { addDays } from "./location-stays";
import { arrivalDate, finalReturnLeg, isHomeReturnLeg } from "./transport-day-placement";
import type { TripWizardDraft } from "./types";

type TripBasics = Pick<TripWizardDraft["basics"], "startDate" | "endDate" | "returnCity">;

/** First and last dates shown on the wizard calendar (includes buffer padding). */
export function computeCalendarBounds(
  draft: Pick<TripWizardDraft, "returnLegs">,
  basics: TripBasics,
): { firstDate: string; lastDate: string } | null {
  if (!basics.startDate || !basics.endDate) return null;

  let lastDate = addDays(basics.endDate, 1);
  const returnLeg = finalReturnLeg(draft.returnLegs);
  if (returnLeg?.travelDate.trim()) {
    const arr = arrivalDate(returnLeg);
    if (arr > basics.endDate) lastDate = arr;
    if (isHomeReturnLeg(returnLeg, basics.returnCity)) {
      lastDate = addDays(arr, 1);
    }
  }

  return { firstDate: addDays(basics.startDate, -1), lastDate };
}
