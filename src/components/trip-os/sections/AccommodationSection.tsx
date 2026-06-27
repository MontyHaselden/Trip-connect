"use client";

import { useMemo, useState } from "react";

import { homestayPeriodStays, nonHomestayStays } from "@/lib/host/accommodation/homestay-helpers";
import { stayTypeLabel } from "@/lib/host/accommodation/stay-type-labels";
import type { AccommodationStayDraft } from "@/lib/host/wizard/types";
import {
  stayFinanceDisplayStatusForStay,
  stayFinanceAttentionById,
  stayFinanceAttentionReason,
  stayFinanceLineId,
  type EntityFinanceDisplayStatus,
} from "@/lib/trip-engine/cost-ledger/finance-section-readiness";
import type { CostLedgerProjection } from "@/lib/trip-engine/cost-ledger/types";
import type { FinanceBuiltInSection } from "@/lib/trip-engine/cost-ledger/finance-sections";
import { staysListedFromProjection } from "@/lib/trip-admin/list-adapters";
import {
  isScopeEditable,
  scopeEditHint as adminScopeEditHint,
} from "@/lib/trip-admin/edit-affordances";
import type { CalendarEditContext, TripAdminProjection } from "@/lib/trip-admin/types";
import { type TripScopeSection } from "@/lib/trip-engine/section-scope-lists";
import type { TripEntityGraph, RosterSummary } from "@/lib/trip-engine/types";
import type { TripCommand } from "@/lib/trip-engine/commands";

import { AddRoomsModal } from "../accommodation/AddRoomsModal";
import { AddHomestaysModal } from "../homestay/AddHomestaysModal";
import { FinanceLineStatusBadge } from "../shared/FinanceLineStatusBadge";
import { FinanceEntityQuickActions } from "../shared/FinanceEntityQuickActions";
import { TripScopedSectionHeader } from "../shared/TripScopedSectionHeader";
import { HomestaysPanel } from "./HomestaysPanel";
import { TripSectionShell, TripSoftPanel } from "../shared/TripSectionShell";
import type { CostsPatchResult } from "../useTripOsEngine";

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
  scopeHint?: string | null;
  financeStatus: EntityFinanceDisplayStatus;
  financeAttentionReason?: string | null;
  onOpenFinance?: () => void;
  showFinanceActions?: boolean;
  showRoomsButton?: boolean;
  onAddRooms?: () => void;
  saving?: boolean;
  onMarkTbc?: () => void;
}) {
  const { stay } = props;
  return (
    <li className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm">
      <div className="min-w-0">
        <p className="font-medium text-zinc-900">{stay.name || "Unnamed stay"}</p>
        <p className="text-sm text-zinc-500">
          {stayTypeLabel(stay.stayType)} · {stay.cityLabel} · {stay.checkInDate} →{" "}
          {stay.checkOutDate}
        </p>
        {props.scopeHint ? (
          <p className="mt-1 text-xs text-violet-700">{props.scopeHint}</p>
        ) : stay.notes?.trim() ? (
          <p className="mt-1 text-xs text-amber-800">{stay.notes}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {props.showRoomsButton ? (
          <button
            type="button"
            onClick={props.onAddRooms}
            className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            Rooms
          </button>
        ) : null}
        <FinanceEntityQuickActions
          show={Boolean(props.showFinanceActions)}
          saving={props.saving}
          onTbc={props.onMarkTbc}
        />
        <FinanceLineStatusBadge
          status={props.financeStatus}
          attentionReason={props.financeAttentionReason}
          onNeedsAttention={props.onOpenFinance}
        />
      </div>
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
  adminProjection: TripAdminProjection;
  calendarEditContext: CalendarEditContext;
  tripId: string;
  inviteCode: string;
  rosterSummary?: RosterSummary;
  selectedDate?: string | null;
  saving?: boolean;
  onDispatch: (commands: TripCommand[]) => Promise<boolean>;
  onReload?: () => void;
  costLedger?: CostLedgerProjection | null;
  onOpenFinanceSection?: (section: FinanceBuiltInSection, lineId?: string) => void;
  onCostsAction?: (payload: Record<string, unknown>) => Promise<CostsPatchResult>;
}) {
  const editGroupId = props.calendarEditContext.editGroupId;
  const [roomsModalOpen, setRoomsModalOpen] = useState(false);
  const [roomsModalStayId, setRoomsModalStayId] = useState<string | null>(null);
  const [homestaysModalOpen, setHomestaysModalOpen] = useState(false);
  const [actionScopeId, setActionScopeId] = useState<string | null>(null);

  const roster = props.rosterSummary ?? { participants: [], groups: [], rooms: [] };
  const homestayStudents = useMemo(
    () => roster.participants.filter((p) => p.role === "student"),
    [roster.participants],
  );

  const scopedStays = useMemo(
    () => staysListedFromProjection(props.adminProjection),
    [props.adminProjection],
  );

  const stayFinanceAttention = useMemo(
    () => stayFinanceAttentionById(props.costLedger),
    [props.costLedger],
  );

  const allScopes = useMemo(
    () => [scopedStays.wholeGroup, ...scopedStays.otherScopes],
    [scopedStays],
  );

  const actionScope =
    allScopes.find((scope) => scope.groupId === (actionScopeId ?? editGroupId)) ??
    scopedStays.wholeGroup;

  const allHomestayStays = useMemo(
    () =>
      [props.adminProjection.wholeGroup, ...props.adminProjection.personalScopes].flatMap(
        (scope) => scope.stays.filter((s) => s.stayType === "homestay" && s.isHomestayGroup),
      ),
    [props.adminProjection],
  );
  const homestayPeriods = homestayPeriodStays(allHomestayStays);
  const homestayTarget = homestayPeriodForAction(
    homestayPeriodStays(actionScope.items),
    props.selectedDate,
  );
  const hotelStaysForRooms = nonHomestayStays(actionScope.items).filter((s) => s.name?.trim());
  const hasAnyStays = allScopes.some((scope) => scope.items.length > 0);

  function openStayFinance(stayId: string) {
    const lineId =
      stayFinanceAttention.get(stayId) ?? stayFinanceLineId(stayId, props.costLedger);
    props.onOpenFinanceSection?.("accommodation", lineId ?? undefined);
  }

  async function markStayTbc(stayId: string) {
    if (!props.onCostsAction) return;
    const lineId =
      stayFinanceAttention.get(stayId) ?? stayFinanceLineId(stayId, props.costLedger);
    if (!lineId) return;
    await props.onCostsAction({
      action: "updateLine",
      lineId,
      line: { costStatus: "tbc" },
    });
  }

  function openRoomsForStay(scopeGroupId: string, stayId: string) {
    setActionScopeId(scopeGroupId);
    setRoomsModalStayId(stayId);
    setRoomsModalOpen(true);
  }

  function scopeHeaderAction(scope: TripScopeSection<AccommodationStayDraft>) {
    const isActiveScope = isScopeEditable(
      scope.groupId,
      props.calendarEditContext,
      props.graph,
    );
    if (!isActiveScope) return undefined;

    const hasHomestayPeriods = homestayPeriodStays(scope.items).length > 0;
    const hasHotels = nonHomestayStays(scope.items).some((s) => s.name?.trim());

    if (hasHomestayPeriods && !hasHotels) {
      return (
        <PanelActionButton
          onClick={() => {
            setActionScopeId(scope.groupId);
            setHomestaysModalOpen(true);
          }}
          disabled={!homestayPeriodForAction(homestayPeriodStays(scope.items), props.selectedDate)}
          title="Add a homestay period on the calendar first"
        >
          Add homestays
        </PanelActionButton>
      );
    }

    return undefined;
  }

  function renderScope(scope: TripScopeSection<AccommodationStayDraft>) {
    if (!scope.items.length) return null;

    const isWholeGroup = scope.groupId === props.graph.mainGroupId;
    const scopeHint = adminScopeEditHint(
      scope.groupId,
      scope.title,
      props.calendarEditContext,
      props.graph,
    );

    const isActiveScope = isScopeEditable(
      scope.groupId,
      props.calendarEditContext,
      props.graph,
    );

    return (
      <div key={scope.groupId} className={isWholeGroup ? undefined : "mt-8"}>
        <TripScopedSectionHeader
          title={scope.title}
          memberNames={scope.memberNames}
          isWholeGroup={isWholeGroup}
          headerAction={scopeHeaderAction(scope)}
        />
        <ul className="space-y-2">
          {scope.items.map((s) => {
            const financeStatus = stayFinanceDisplayStatusForStay(
              s,
              props.costLedger,
              props.graph,
            );
            return (
            <StayListItem
              key={s.id}
              stay={s}
              scopeHint={scopeHint}
              showRoomsButton={
                isActiveScope &&
                s.stayType !== "homestay" &&
                Boolean(s.name?.trim())
              }
              onAddRooms={() => openRoomsForStay(scope.groupId, s.id)}
              financeStatus={financeStatus}
              financeAttentionReason={stayFinanceAttentionReason(s.id, props.costLedger)}
              onOpenFinance={() => openStayFinance(s.id)}
              showFinanceActions={
                financeStatus === "needs_attention" &&
                Boolean(props.onCostsAction)
              }
              saving={props.saving}
              onMarkTbc={() => void markStayTbc(s.id)}
            />
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <TripSectionShell
      title="Accommodation"
      description="Whole-group stays first, then personal or subgroup stays with who they belong to."
    >
      {!hasAnyStays ? (
        <TripSoftPanel>
          <AccommodationEmptyState />
        </TripSoftPanel>
      ) : (
        <>{allScopes.map((scope) => renderScope(scope))}</>
      )}

      {homestayPeriods.length ? (
        <div className="mt-6">
          <HomestaysPanel
            tripId={props.tripId}
            groupId={editGroupId}
            graph={props.graph}
            stays={allHomestayStays}
            roster={roster}
            selectedDate={props.selectedDate}
            saving={props.saving}
            onDispatch={props.onDispatch}
          />
        </div>
      ) : null}

      <AddRoomsModal
        open={roomsModalOpen}
        onClose={() => {
          setRoomsModalOpen(false);
          setRoomsModalStayId(null);
        }}
        tripId={props.tripId}
        inviteCode={props.inviteCode}
        hotelStays={hotelStaysForRooms}
        roster={roster}
        initialStayId={roomsModalStayId}
        onSaved={() => props.onReload?.()}
      />

      <AddHomestaysModal
        open={homestaysModalOpen}
        onClose={() => setHomestaysModalOpen(false)}
        tripId={props.tripId}
        groupId={actionScope.groupId}
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
