import { detectGroupCityMoves, intercityPromptForMove } from "@/lib/groups/detect-group-city-moves";
import {
  coalesceAdjacentNamedStays,
  stayCityLabel,
} from "@/lib/host/setup/accommodation-calendar";
import {
  groupAccommodationStays,
  groupIntercityLegs,
  mainAccommodationStays,
  mainIntercityLegs,
} from "@/lib/host/setup/entity-scope";
import { airportTransferStatusItems } from "@/lib/host/setup/airport-transfer-todos";
import {
  effectiveTripBoundsFromState,
  uncoveredTripDays,
} from "@/lib/host/setup/sync-trip-bounds";
import type { SetupReadinessStatus, SetupSectionId, TripSetupState } from "@/lib/host/setup/types";

export type SetupStatusItem = {
  id: string;
  label: string;
  prompt?: string;
  status: SetupReadinessStatus;
  message?: string;
  value?: string;
  kind?: "airport-transfer";
  anchorLegId?: string;
  transferFrom?: string;
  transferTo?: string;
  transferDate?: string;
  transferLegKind?: "airport_arrival" | "airport_departure";
};

function legBookingStatus(status: string | null | undefined): SetupReadinessStatus {
  if (status === "booked") return "complete";
  if (status === "flexible" || status === "placeholder") return "flexible";
  return "todo";
}

function legSummary(from: string, to: string, date: string): string {
  const route = [from.trim(), to.trim()].filter(Boolean).join(" → ") || "Route TBC";
  return `${route} · ${date || "Date TBC"}`;
}

export function locationsStatusItems(
  state: TripSetupState,
  activeGroupId: string,
): SetupStatusItem[] {
  const days = state.dayPlacesByGroupId[activeGroupId] ?? [];
  const tripBounds = effectiveTripBoundsFromState(state);
  const uncovered = uncoveredTripDays(
    days,
    tripBounds.startDate,
    tripBounds.endDate,
  );
  const painted = days.filter((d) => d.primaryCity.trim() || d.secondaryCity?.trim());

  if (!painted.length) {
    return [
      {
        id: "locations",
        label: "Daily locations",
        status: "todo",
        message: "Select days on the calendar and assign where the group stays.",
      },
    ];
  }

  const items: SetupStatusItem[] = painted.slice(0, 6).map((day) => {
    const primary = day.primaryCity.trim();
    const secondary = day.secondaryCity?.trim() ?? "";
    const label =
      primary && secondary && primary !== secondary
        ? `${primary} → ${secondary}`
        : primary || secondary;
    return {
      id: `day-${day.date}`,
      label: day.date,
      value: label,
      status: "complete" as SetupReadinessStatus,
    };
  });

  if (uncovered.length) {
    items.unshift({
      id: "gaps",
      label: "Uncovered days",
      status: "todo",
      message: `${uncovered.length} day${uncovered.length === 1 ? "" : "s"} still need a location`,
    });
  }

  return items;
}

export function accommodationStatusItems(
  state: TripSetupState,
  activeGroupId: string,
): SetupStatusItem[] {
  const isMain = activeGroupId === state.mainGroupId;
  const stays = coalesceAdjacentNamedStays(
    isMain
      ? mainAccommodationStays(state)
      : groupAccommodationStays(state, activeGroupId),
  );

  if (!stays.length) {
    return [
      {
        id: "stays",
        label: "Accommodation",
        prompt: "Where is the group staying?",
        status: "todo",
        message: "Add at least one stay",
      },
    ];
  }

  return stays.map((stay) => {
    const complete = Boolean(stay.name?.trim()) && stay.stayType !== "not_booked";
    return {
      id: stay.id,
      label: stay.name?.trim() || stayCityLabel(stay) || "Stay",
      prompt: "Where is the group staying?",
      status: complete ? "complete" : "todo",
      value: `${stayCityLabel(stay)} · ${stay.checkInDate} – ${stay.checkOutDate}`,
      message: !stay.name?.trim()
        ? "Confirm property name"
        : stay.stayType === "not_booked"
          ? "Mark stay type"
          : undefined,
    };
  });
}

export function transportStatusItems(
  state: TripSetupState,
  activeGroupId: string,
): SetupStatusItem[] {
  const isMain = activeGroupId === state.mainGroupId;
  const items: SetupStatusItem[] = [];

  if (isMain) {
    if (!state.outboundLegs.length) {
      items.push({
        id: "outbound",
        label: "Outbound",
        prompt: "How are you getting to the destination?",
        status: "todo",
        message: "Add outbound transport",
      });
    } else {
      state.outboundLegs.forEach((leg, i) => {
        items.push({
          id: leg.id,
          label: i === 0 ? "Outbound" : `Outbound connection ${i}`,
          prompt: "How are you getting to the destination?",
          status: legBookingStatus(leg.bookingStatus),
          value: legSummary(leg.fromCity, leg.toCity, leg.travelDate),
          message:
            leg.bookingStatus === "not_booked" ? "Confirm booking status" : undefined,
        });
      });
    }

    if (!state.returnLegs.length) {
      items.push({
        id: "return",
        label: "Return",
        prompt: "How are you getting home?",
        status: "todo",
        message: "Add return transport",
      });
    } else {
      state.returnLegs.forEach((leg, i) => {
        items.push({
          id: leg.id,
          label: i === 0 ? "Return" : `Return connection ${i}`,
          prompt: "How are you getting home?",
          status: legBookingStatus(leg.bookingStatus),
          value: legSummary(leg.fromCity, leg.toCity, leg.travelDate),
          message:
            leg.bookingStatus === "not_booked" ? "Confirm booking status" : undefined,
        });
      });
    }
  } else {
    items.push({
      id: "inherited-flights",
      label: "Outbound & return",
      prompt: "How are you getting there and back?",
      status: "complete",
      value: "Inherited from Main Group",
    });
  }

  const intercity = isMain
    ? mainIntercityLegs(state)
    : groupIntercityLegs(state, activeGroupId);

  if (!intercity.length) {
    items.push({
      id: "intercity",
      label: isMain ? "Between cities" : "Group travel legs",
      prompt: "How do you move between cities?",
      status: "todo",
      message: "Add intercity legs if needed",
    });
  } else {
    intercity.forEach((leg) => {
      items.push({
        id: leg.id,
        label: `${leg.intercityFromCity} → ${leg.intercityToCity}`,
        prompt: "How do you move between cities?",
        status: legBookingStatus(leg.bookingStatus),
        value: legSummary(leg.intercityFromCity, leg.intercityToCity, leg.travelDate),
        message:
          leg.bookingStatus === "not_booked" ? "Confirm booking status" : undefined,
      });
    });
  }

  if (!isMain) {
    const mainDays = state.dayPlacesByGroupId[state.mainGroupId] ?? [];
    const groupDays = state.dayPlacesByGroupId[activeGroupId] ?? [];
    const moves = detectGroupCityMoves(mainDays, groupDays, false);
    for (const move of moves) {
      items.push({
        id: `move-${move.date}-${move.toCity}`,
        label: "Group city change",
        prompt: "How does this group travel on this day?",
        status: "todo",
        value: intercityPromptForMove(move),
        message: "Add a travel leg for this group",
      });
    }
  }

  if (isMain) {
    items.push(...airportTransferStatusItems(state));
  }

  return items;
}

export function activitiesStatusItems(state: TripSetupState): SetupStatusItem[] {
  if (!state.activities.length) {
    return [
      {
        id: "activities",
        label: "Activities",
        prompt: "What is planned each day?",
        status: "todo",
        message: "Select days on the calendar or add activities here",
      },
    ];
  }

  return state.activities.map((act) => ({
    id: act.id,
    label: act.title,
    prompt: "What is planned each day?",
    status: act.startTime ? "complete" : "flexible",
    value: `${act.date}${act.startTime ? ` · ${act.startTime}` : ""}`,
    message: !act.startTime ? "Time not set yet" : undefined,
  }));
}

export function groupsStatusItems(state: TripSetupState): SetupStatusItem[] {
  const main = state.groups.find((g) => g.isMain);
  const others = state.groups.filter((g) => !g.isMain);

  const items: SetupStatusItem[] = [
    {
      id: main?.id ?? "main",
      label: main?.name ?? "Main Group",
      prompt: "Who follows the base itinerary?",
      status: "complete",
      value: "Base plan for everyone",
    },
  ];

  if (!others.length) {
    items.push({
      id: "groups",
      label: "Additional groups",
      prompt: "Do any sub-groups need their own plan?",
      status: "todo",
      message: "Add a group if some travellers diverge",
    });
    return items;
  }

  for (const group of others) {
    items.push({
      id: group.id,
      label: group.name,
      prompt: "Do any sub-groups need their own plan?",
      status: "flexible",
      value: group.type.replace(/_/g, " "),
      message: "Review overlays on the calendar",
    });
  }

  return items;
}

export function participantsStatusItems(): SetupStatusItem[] {
  return [
    {
      id: "invite",
      label: "Invitations",
      prompt: "Who is coming on this trip?",
      status: "todo",
      message: "Share the invite link and add participants",
    },
    {
      id: "assignments",
      label: "Group assignments",
      prompt: "Which group is each person in?",
      status: "todo",
      message: "Assign participants to groups after they join",
    },
  ];
}

export function bookingsStatusItems(state: TripSetupState): SetupStatusItem[] {
  const rows: Array<{
    id: string;
    label: string;
    status: SetupReadinessStatus;
    value: string;
  }> = [
    ...state.outboundLegs.map((l) => ({
      id: l.id,
      label: `Outbound: ${l.fromCity} → ${l.toCity}`,
      status: legBookingStatus(l.bookingStatus),
      value: l.bookingStatus.replace(/_/g, " "),
    })),
    ...state.returnLegs.map((l) => ({
      id: l.id,
      label: `Return: ${l.fromCity} → ${l.toCity}`,
      status: legBookingStatus(l.bookingStatus),
      value: l.bookingStatus.replace(/_/g, " "),
    })),
    ...state.intercityLegs.map((l) => ({
      id: l.id,
      label: `Intercity: ${l.intercityFromCity} → ${l.intercityToCity}`,
      status: legBookingStatus(l.bookingStatus),
      value: l.bookingStatus.replace(/_/g, " "),
    })),
    ...state.accommodationStays.map((s) => ({
      id: s.id,
      label: `${s.cityLabel}: ${s.name ?? "TBC"}`,
      status: (s.stayType === "not_booked" || !s.name?.trim()
        ? "todo"
        : "complete") as SetupReadinessStatus,
      value: s.stayType === "not_booked" ? "not booked" : "booked",
    })),
  ];

  if (!rows.length) {
    return [
      {
        id: "bookings",
        label: "Booking references",
        prompt: "What is booked and confirmed?",
        status: "todo",
        message: "Add transport and accommodation first",
      },
    ];
  }

  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    prompt: "What is booked and confirmed?",
    status: row.status,
    value: row.value,
    message: row.status === "todo" ? "Add booking reference below" : undefined,
  }));
}

export function emergencyStatusItems(): SetupStatusItem[] {
  return [
    {
      id: "contacts",
      label: "Emergency contacts",
      prompt: "Who do travellers call in an emergency?",
      status: "todo",
      message: "Add local and home-country contacts",
    },
    {
      id: "accommodation-emergency",
      label: "Stay emergency info",
      prompt: "Front desk, host family, or on-call numbers",
      status: "todo",
      message: "Add per-stay emergency details",
    },
  ];
}

export function photosViewersStatusItems(): SetupStatusItem[] {
  return [
    {
      id: "photos",
      label: "Photo sharing",
      prompt: "Can students upload trip photos?",
      status: "todo",
      message: "Configure photo permissions",
    },
    {
      id: "viewers",
      label: "Viewer access",
      prompt: "Who can view without joining the trip?",
      status: "todo",
      message: "Set up parent or viewer links",
    },
  ];
}

export function publishStatusItems(
  sectionMessage?: string,
  status: SetupReadinessStatus = "todo",
): SetupStatusItem[] {
  return [
    {
      id: "readiness",
      label: "Setup readiness",
      prompt: "Is everything ready for students?",
      status,
      message: sectionMessage,
    },
    {
      id: "publish-action",
      label: "Publish trip",
      prompt: "When should students see the itinerary?",
      status: status === "complete" ? "complete" : "todo",
      message:
        status === "complete"
          ? "Ready to publish from the Builder"
          : "Finish other sections first",
    },
  ];
}

export function sectionStatusItems(
  sectionId: SetupSectionId,
  state: TripSetupState,
  activeGroupId: string,
  sectionReadiness?: { status: SetupReadinessStatus; message?: string },
): SetupStatusItem[] {
  switch (sectionId) {
    case "overview":
      return [];
    case "locations":
      return locationsStatusItems(state, activeGroupId);
    case "accommodation":
      return accommodationStatusItems(state, activeGroupId);
    case "transport":
      return transportStatusItems(state, activeGroupId);
    case "activities":
      return activitiesStatusItems(state);
    case "groups":
      return groupsStatusItems(state);
    case "participants":
      return participantsStatusItems();
    case "bookings":
      return bookingsStatusItems(state);
    case "emergency":
      return emergencyStatusItems();
    case "photos_viewers":
      return photosViewersStatusItems();
    case "publish":
      return publishStatusItems(sectionReadiness?.message, sectionReadiness?.status);
    default:
      return [];
  }
}
