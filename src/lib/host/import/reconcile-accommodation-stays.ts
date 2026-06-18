import { locationsMatch } from "@/lib/host/wizard/location-stays";
import type {
  AccommodationStayDraft,
  IntercityLegDraft,
  TransportLegDraft,
} from "@/lib/host/wizard/types";
import { normalizeStoredTime } from "@/lib/utils/ai-time";

type TransportLike = Pick<
  TransportLegDraft | IntercityLegDraft,
  "travelDate" | "departureTime" | "fromCity" | "fromStation"
>;

function addDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function legDepartsFromStayCity(leg: TransportLike, stay: AccommodationStayDraft): boolean {
  const fromCity = leg.fromCity?.trim() ?? "";
  const fromStation = leg.fromStation?.trim() ?? "";
  if (fromCity && locationsMatch(fromCity, stay.cityLabel)) return true;
  if (fromStation && locationsMatch(fromStation, stay.cityLabel)) return true;
  return false;
}

function departureMinutes(leg: TransportLike): number | null {
  if (!leg.departureTime?.trim()) return null;
  try {
    const normalized = normalizeStoredTime(leg.departureTime);
    const [h, m] = normalized.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  } catch {
    return null;
  }
}

function minutesToStoredTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

/** Align stay checkout with the day the group departs that city (not the day after). */
export function reconcileImportedAccommodationStays(
  stays: AccommodationStayDraft[],
  legs: TransportLike[],
): AccommodationStayDraft[] {
  return stays.map((stay) => {
    const departures = legs
      .filter((leg) => legDepartsFromStayCity(leg, stay))
      .sort((a, b) => a.travelDate.localeCompare(b.travelDate));

    if (!departures.length) return stay;

    const lastDepartureDate = departures[departures.length - 1]!.travelDate;

    if (stay.checkOutDate > lastDepartureDate) {
      return { ...stay, checkOutDate: lastDepartureDate };
    }

    if (stay.checkOutDate < lastDepartureDate) {
      const dayAfterCheckout = addDays(stay.checkOutDate, 1);
      if (dayAfterCheckout === lastDepartureDate) {
        return { ...stay, checkOutDate: lastDepartureDate };
      }
    }

    return stay;
  });
}

/** Morning checkout before same-day departure flights — never use the flight time as checkout. */
export function resolveCheckoutActivityTime(
  stay: Pick<AccommodationStayDraft, "cityLabel">,
  checkOutDate: string,
  legs: TransportLike[],
): string {
  const dayDepartures = legs.filter(
    (leg) => leg.travelDate === checkOutDate && legDepartsFromStayCity(leg, stay),
  );

  if (!dayDepartures.length) return "10:00:00";

  let earliest: number | null = null;
  for (const leg of dayDepartures) {
    const mins = departureMinutes(leg);
    if (mins === null) continue;
    earliest = earliest === null ? mins : Math.min(earliest, mins);
  }

  if (earliest === null) return "10:00:00";
  if (earliest >= 12 * 60) return "10:00:00";
  if (earliest >= 9 * 60) return "08:00:00";
  return minutesToStoredTime(Math.max(6 * 60, earliest - 120));
}

export function isAccommodationCheckItemTitle(title: string): boolean {
  return /^\s*check\s*(?:-|\s)?(?:in|out)\s*:/i.test(title);
}
