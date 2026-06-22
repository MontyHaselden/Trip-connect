import type { AccommodationStayDraft } from "@/lib/host/wizard/types";

/** Trip-wide homestay block on the calendar (students stay with different families). */
export function isHomestayPeriodStay(stay: AccommodationStayDraft): boolean {
  return stay.stayType === "homestay" && stay.isHomestayGroup;
}

/** One host family — assigned to specific students, not painted as its own calendar band. */
export function isHomestayFamilyStay(stay: AccommodationStayDraft): boolean {
  return stay.stayType === "homestay" && !stay.isHomestayGroup;
}

export function homestayPeriodStays(stays: AccommodationStayDraft[]): AccommodationStayDraft[] {
  return stays.filter(isHomestayPeriodStay);
}

export function homestayFamilyStays(stays: AccommodationStayDraft[]): AccommodationStayDraft[] {
  return stays.filter(isHomestayFamilyStay);
}

export function nonHomestayStays(stays: AccommodationStayDraft[]): AccommodationStayDraft[] {
  return stays.filter((s) => s.stayType !== "homestay");
}

export function defaultHomestayFamilyDates(
  periods: AccommodationStayDraft[],
): { checkInDate: string; checkOutDate: string } | null {
  const period = periods[0];
  if (!period) return null;
  return { checkInDate: period.checkInDate, checkOutDate: period.checkOutDate };
}
