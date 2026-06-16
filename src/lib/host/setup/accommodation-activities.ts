import type { AccommodationStayDraft, ActivityDraft } from "@/lib/host/wizard/types";

export function activityOverlapsStay(
  activity: ActivityDraft,
  stay: Pick<AccommodationStayDraft, "checkInDate" | "checkOutDate">,
): boolean {
  const actEnd = activity.endDate || activity.date;
  return activity.date < stay.checkOutDate && actEnd >= stay.checkInDate;
}

export function activitiesAttachedToStay(
  activities: ActivityDraft[],
  stay: Pick<AccommodationStayDraft, "checkInDate" | "checkOutDate">,
): ActivityDraft[] {
  return activities.filter((a) => activityOverlapsStay(a, stay));
}
