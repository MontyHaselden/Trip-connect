"use client";

import { useMemo, useState } from "react";

import {
  homestayPeriodStays,
  nonHomestayStays,
} from "@/lib/host/accommodation/homestay-helpers";
import { stayTypeLabel } from "@/lib/host/accommodation/stay-type-labels";
import type { AccommodationStayDraft } from "@/lib/host/wizard/types";
import {
  stayInheritsFromMainGroup,
  staysForCalendarView,
} from "@/lib/trip-engine/person-lens";
import type { TripEntityGraph, RosterSummary } from "@/lib/trip-engine/types";
import type { TripCommand } from "@/lib/trip-engine/commands";

import { AddRoomsModal } from "../accommodation/AddRoomsModal";
import { AddHomestaysModal } from "../homestay/AddHomestaysModal";
import { HomestaysPanel } from "./HomestaysPanel";
import { TripSectionShell, TripSoftPanel } from "../shared/TripSectionShell";

function PanelActionButton(props: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      title={props.title}
      className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
    >
      {props.children}
    </button>
  );
}

function StayListItem(props: {
  stay: AccommodationStayDraft;
  inherited: boolean;
  onRemove?: () => void;
}) {
  const { stay, inherited } = props;
  return (
    <li className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm">
      <div className="min-w-0">
        <p className="font-medium text-zinc-900">{stay.name || "Unnamed stay"}</p>
        <p className="text-sm text-zinc-500">
          {stayTypeLabel(stay.stayType)} · {stay.cityLabel} · {stay.checkInDate} →{" "}
          {stay.checkOutDate}
        </p>
        {inherited ? (
          <p className="mt-1 text-xs text-violet-700">From main group — edit on Whole group calendar</p>
        ) : stay.notes?.trim() ? (
          <p className="mt-1 text-xs text-amber-800">{stay.notes}</p>
        ) : null}
      </div>
      {props.onRemove ? (
        <button
          type="button"
          onClick={props.onRemove}
          className="shrink-0 text-sm text-red-600 hover:text-red-700"
        >
          Delete
        </button>
      ) : null}
    </li>
  );
}

function AccommodationEmptyState() {
  return (
    <p className="py-8 text-center text-sm leading-relaxed text-zinc-500">
      No accommodation on the calendar yet. Select days on the trip calendar and use{" "}
      <span className="font-medium text-zinc-700">Accommodation → Add</span> there.
    </p>
  );
}

function homestayPeriodForAction(
  periods: AccommodationStayDraft[],
  selectedDate?: string | null,
): AccommodationStayDraft | null {
  if (!periods.length) return null;
  if (selectedDate) {
    const match = periods.find(
      (p) => selectedDate >= p.checkInDate && selectedDate < p.checkOutDate,
    );
    if (match) return match;
  }
  return periods[0] ?? null;
}

export function AccommodationSection(props: {
  graph: TripEntityGraph;
  groupId: string;
  tripId: string;
  inviteCode: string;
  rosterSummary?: RosterSummary;
  selectedDate?: string | null;
  saving?: boolean;
  onDispatch: (commands: TripCommand[]) => Promise<boolean>;
  onReload?: () => void;
}) {
  const [roomsModalOpen, setRoomsModalOpen] = useState(false);
  const [homestaysModalOpen, setHomestaysModalOpen] = useState(false);

  const calendarStays = staysForCalendarView(props.graph, props.groupId);
  const hotelStays = nonHomestayStays(calendarStays).filter((s) => s.name?.trim());
  const homestayPeriods = homestayPeriodStays(calendarStays);
  const roster = props.rosterSummary ?? { participants: [], groups: [], rooms: [] };
  const homestayStudents = useMemo(
    () => roster.participants.filter((p) => p.role === "student"),
    [roster.participants],
  );

  const homestayTarget = homestayPeriodForAction(homestayPeriods, props.selectedDate);
  const editingOwnGroup = props.groupId === props.graph.mainGroupId;
  const hasAnyStays = hotelStays.length > 0 || homestayPeriods.length > 0;

  function removeStay(stayId: string) {
    void props.onDispatch([{ type: "removeStay", groupId: props.groupId, stayId }]);
  }

  function inherited(stay: AccommodationStayDraft) {
    return stayInheritsFromMainGroup(props.graph, props.groupId, stay);
  }

  return (
    <TripSectionShell
      title="Accommodation"
      description="Stays as shown on the trip calendar. Add or change them by selecting days on the calendar."
    >
      {!hasAnyStays ? (
        <TripSoftPanel>
          <AccommodationEmptyState />
        </TripSoftPanel>
      ) : (
        <>
          {hotelStays.length ? (
            <TripSoftPanel
              title="Hotels & group stays"
              headerAction={
                <PanelActionButton onClick={() => setRoomsModalOpen(true)}>
                  Add rooms
                </PanelActionButton>
              }
            >
              <ul className="space-y-2">
                {hotelStays.map((s) => (
                  <StayListItem
                    key={s.id}
                    stay={s}
                    inherited={inherited(s)}
                    onRemove={inherited(s) ? undefined : () => removeStay(s.id)}
                  />
                ))}
              </ul>
            </TripSoftPanel>
          ) : null}

          {homestayPeriods.length ? (
            <TripSoftPanel
              title="Homestay periods"
              className={hotelStays.length ? "mt-6" : undefined}
              headerAction={
                <PanelActionButton
                  onClick={() => setHomestaysModalOpen(true)}
                  disabled={!homestayTarget || !editingOwnGroup}
                  title={
                    !homestayTarget
                      ? "Add a homestay period on the calendar first"
                      : !editingOwnGroup
                        ? "Switch to this group’s calendar to add host families"
                        : "Add host families and assign students"
                  }
                >
                  Add homestays
                </PanelActionButton>
              }
            >
              <ul className="space-y-2">
                {homestayPeriods.map((s) => (
                  <StayListItem
                    key={s.id}
                    stay={s}
                    inherited={inherited(s)}
                    onRemove={inherited(s) ? undefined : () => removeStay(s.id)}
                  />
                ))}
              </ul>
            </TripSoftPanel>
          ) : null}
        </>
      )}

      {homestayPeriods.length ? (
        <div className="mt-6">
          <HomestaysPanel
            tripId={props.tripId}
            groupId={props.groupId}
            graph={props.graph}
            stays={calendarStays}
            roster={roster}
            selectedDate={props.selectedDate}
            saving={props.saving}
            onDispatch={props.onDispatch}
          />
        </div>
      ) : null}

      <AddRoomsModal
        open={roomsModalOpen}
        onClose={() => setRoomsModalOpen(false)}
        tripId={props.tripId}
        inviteCode={props.inviteCode}
        hotelStays={hotelStays}
        roster={roster}
        onSaved={() => props.onReload?.()}
      />

      <AddHomestaysModal
        open={homestaysModalOpen}
        onClose={() => setHomestaysModalOpen(false)}
        tripId={props.tripId}
        groupId={props.groupId}
        cityLabel={homestayTarget?.cityLabel ?? ""}
        checkIn={homestayTarget?.checkInDate ?? ""}
        checkOut={homestayTarget?.checkOutDate ?? ""}
        students={homestayStudents}
        onDispatch={props.onDispatch}
        onSaved={() => props.onReload?.()}
      />
    </TripSectionShell>
  );
}
