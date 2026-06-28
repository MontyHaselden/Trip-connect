"use client";

import { useMemo, useState } from "react";

import { VenueNamePicker, type VenueSelection } from "@/components/geo/VenueNamePicker";
import type { ActivityDraft } from "@/lib/host/wizard/types";
import {
  activityFinanceAttentionById,
  activityFinanceAttentionReason,
  activityFinanceDisplayStatus,
  activityFinanceLineId,
  activityIsMarkedNoCost,
} from "@/lib/trip-engine/cost-ledger/finance-section-readiness";
import type { CostLedgerProjection } from "@/lib/trip-engine/cost-ledger/types";
import type { FinanceBuiltInSection } from "@/lib/trip-engine/cost-ledger/finance-sections";
import { activitiesListedFromProjection } from "@/lib/trip-admin/list-adapters";
import {
  isScopeEditable,
  scopeEditHint as adminScopeEditHint,
} from "@/lib/trip-admin/edit-affordances";
import type { CalendarEditContext, TripAdminProjection } from "@/lib/trip-admin/types";
import { type TripScopeSection } from "@/lib/trip-engine/section-scope-lists";
import type { TripEntityGraph, RosterSummary } from "@/lib/trip-engine/types";
import type { TripCommand } from "@/lib/trip-engine/commands";

import { FinanceLineStatusBadge } from "../shared/FinanceLineStatusBadge";
import { FinanceEntityQuickActions } from "../shared/FinanceEntityQuickActions";
import { TripScopedSectionHeader } from "../shared/TripScopedSectionHeader";
import { TripSectionShell, TripSoftPanel } from "../shared/TripSectionShell";
import { tripFieldClass } from "../shared/TripInput";
import type { CostsPatchResult } from "../useTripOsEngine";

function activityCityHint(graph: TripEntityGraph, groupId: string, date: string): string | undefined {
  const places = graph.dayPlacesByGroupId[groupId] ?? [];
  return places.find((place) => place.date === date)?.primaryCity?.trim() || undefined;
}

function activityLocationLabel(a: ActivityDraft): string | null {
  if (a.locationName?.trim()) return a.locationName.trim();
  if (a.address?.trim()) return a.address.trim();
  return null;
}

function hasMapCoords(a: ActivityDraft): boolean {
  return (
    typeof a.latitude === "number" &&
    typeof a.longitude === "number" &&
    Number.isFinite(a.latitude) &&
    Number.isFinite(a.longitude)
  );
}

function activitySortKey(a: ActivityDraft): string {
  return `${a.date}\0${a.isTimeTbc || !a.startTime?.trim() ? "99:99" : a.startTime.slice(0, 5)}`;
}

function formatActivityLine(a: ActivityDraft): string {
  const parts = [a.date];
  if (!a.isTimeTbc && a.startTime?.trim()) {
    const start = a.startTime.slice(0, 5);
    const end = a.endTime?.trim()?.slice(0, 5);
    parts.push(end ? `${start}–${end}` : start);
  }
  if (a.locationName?.trim()) parts.push(a.locationName.trim());
  else if (a.address?.trim()) parts.push(a.address.trim());
  if (hasMapCoords(a)) parts.push("On map");
  return parts.join(" · ");
}

export function ActivitiesSection(props: {
  graph: TripEntityGraph;
  adminProjection: TripAdminProjection;
  calendarEditContext: CalendarEditContext;
  rosterSummary?: RosterSummary;
  saving?: boolean;
  onDispatch: (commands: TripCommand[]) => Promise<boolean>;
  costLedger?: CostLedgerProjection | null;
  onOpenFinanceSection?: (section: FinanceBuiltInSection, lineId?: string) => void;
  onCostsAction?: (payload: Record<string, unknown>) => Promise<CostsPatchResult>;
}) {
  const roster = props.rosterSummary ?? { participants: [], groups: [], rooms: [] };

  const scopedActivities = useMemo(
    () => activitiesListedFromProjection(props.adminProjection),
    [props.adminProjection],
  );

  const allScopes = useMemo(() => {
    const scopes = [scopedActivities.wholeGroup, ...scopedActivities.otherScopes];
    return scopes.map((scope) => ({
      ...scope,
      items: [...scope.items].sort((a, b) =>
        activitySortKey(a).localeCompare(activitySortKey(b)),
      ),
    }));
  }, [scopedActivities]);

  const hasAnyActivities = allScopes.some((scope) => scope.items.length > 0);

  const activityFinanceAttention = useMemo(
    () => activityFinanceAttentionById(props.costLedger),
    [props.costLedger],
  );

  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [locationDraft, setLocationDraft] = useState("");

  const countryNames = props.graph.basics.destinationCountries ?? [];

  function startEditingLocation(activity: ActivityDraft) {
    setEditingLocationId(activity.id);
    setLocationDraft(activity.locationName ?? activity.title);
  }

  async function saveActivityLocation(
    activity: ActivityDraft,
    groupId: string,
    selection: VenueSelection,
  ) {
    const ok = await props.onDispatch([
      {
        type: "updateActivity",
        groupId,
        activityId: activity.id,
        patch: {
          locationName: selection.name,
          address: selection.address,
          googlePlaceId: selection.placeId ?? null,
          latitude: selection.lat ?? null,
          longitude: selection.lng ?? null,
          isLocationTbc: false,
        },
      },
    ]);
    if (ok) {
      setEditingLocationId(null);
      setLocationDraft("");
    }
  }

  function openActivityFinance(activityId: string) {
    const lineId =
      activityFinanceAttention.get(activityId) ??
      activityFinanceLineId(activityId, props.costLedger);
    props.onOpenFinanceSection?.("activities", lineId ?? undefined);
  }

  async function markActivityNoCost(activityId: string) {
    if (!props.onCostsAction) return;
    const lineId =
      activityFinanceAttention.get(activityId) ??
      activityFinanceLineId(activityId, props.costLedger);
    if (!lineId) return;
    await props.onCostsAction({
      action: "updateLine",
      lineId,
      line: {
        costStatus: "no_cost",
        totalAmountCents: 0,
        overrides: [],
      },
    });
  }

  async function markActivityTbc(activityId: string) {
    if (!props.onCostsAction) return;
    const lineId =
      activityFinanceAttention.get(activityId) ??
      activityFinanceLineId(activityId, props.costLedger);
    if (!lineId) return;
    await props.onCostsAction({
      action: "updateLine",
      lineId,
      line: {
        costStatus: "tbc",
      },
    });
  }

  return (
    <TripSectionShell
      title="Activities"
      description="Whole-group activities first, then personal or subgroup activities with who they belong to."
    >
      <TripSoftPanel>
        {hasAnyActivities ? (
          <div className="space-y-8">
            {allScopes.map((scope) => {
              if (!scope.items.length) return null;
              const isWholeGroup = scope.groupId === props.graph.mainGroupId;
              const scopeHint = adminScopeEditHint(
                scope.groupId,
                scope.title,
                props.calendarEditContext,
                props.graph,
              );

              return (
                <div key={scope.groupId}>
                  <TripScopedSectionHeader
                    title={scope.title}
                    memberNames={scope.memberNames}
                    isWholeGroup={isWholeGroup}
                  />
                  <ul className="mt-2 space-y-2">
                    {scope.items.map((a) => {
                      const financeStatus = activityFinanceDisplayStatus(
                        a.id,
                        props.costLedger,
                      );
                      const showFinanceActions =
                        financeStatus === "needs_attention" && Boolean(props.onCostsAction);
                      const canEdit = isScopeEditable(
                        scope.groupId,
                        props.calendarEditContext,
                        props.graph,
                      );
                      const location = activityLocationLabel(a);

                      return (
                      <li
                        key={a.id}
                        className="rounded-2xl bg-white px-4 py-3 shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-zinc-900">{a.title}</p>
                          <p className="text-sm text-zinc-500">{formatActivityLine(a)}</p>
                          {scopeHint ? (
                            <p className="mt-1 text-xs text-violet-700">{scopeHint}</p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <FinanceEntityQuickActions
                            show={showFinanceActions}
                            saving={props.saving}
                            onTbc={() => void markActivityTbc(a.id)}
                            onNoCost={() => void markActivityNoCost(a.id)}
                          />
                          <FinanceLineStatusBadge
                            status={financeStatus}
                            attentionReason={activityFinanceAttentionReason(
                              a.id,
                              props.costLedger,
                            )}
                            completeTitle={
                              activityIsMarkedNoCost(a.id, props.costLedger)
                                ? "No cost to participants"
                                : undefined
                            }
                            onNeedsAttention={() => openActivityFinance(a.id)}
                          />
                        </div>
                        </div>
                        {canEdit ? (
                          editingLocationId === a.id ? (
                            <div className="mt-3 space-y-2 border-t border-zinc-100 pt-3">
                              <p className="text-xs font-medium text-zinc-600">Venue location</p>
                              <VenueNamePicker
                                value={locationDraft}
                                onChange={setLocationDraft}
                                onSelectVenue={(selection) => {
                                  void saveActivityLocation(a, scope.groupId, selection);
                                }}
                                countryNames={countryNames}
                                cityHint={activityCityHint(props.graph, scope.groupId, a.date)}
                                placeholder="Search venue (e.g. teamLab Planets Tokyo)…"
                                inputClassName={tripFieldClass}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingLocationId(null);
                                  setLocationDraft("");
                                }}
                                className="text-xs font-medium text-zinc-500 hover:text-zinc-700"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="mt-2 border-t border-zinc-100 pt-2">
                              {location ? (
                                <button
                                  type="button"
                                  onClick={() => startEditingLocation(a)}
                                  className="text-left text-xs text-zinc-500 hover:text-zinc-700"
                                >
                                  {hasMapCoords(a) ? "📍 " : ""}
                                  {location}
                                  <span className="ml-2 text-violet-600">Edit location</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => startEditingLocation(a)}
                                  className="text-xs font-medium text-violet-600 hover:text-violet-700"
                                >
                                  + Add location for map
                                </button>
                              )}
                            </div>
                          )
                        ) : null}
                      </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="py-8 text-center text-sm leading-relaxed text-zinc-500">
            No activities on the calendar yet. Select days on the trip calendar and use{" "}
            <span className="font-medium text-zinc-700">Activities → Add</span> there.
          </p>
        )}
      </TripSoftPanel>
    </TripSectionShell>
  );
}
