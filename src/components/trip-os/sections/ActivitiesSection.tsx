"use client";

import { useMemo } from "react";

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
import {
  activitiesListedByScope,
  type TripScopeSection,
} from "@/lib/trip-engine/section-scope-lists";
import type { TripEntityGraph, RosterSummary } from "@/lib/trip-engine/types";
import type { TripCommand } from "@/lib/trip-engine/commands";

import { FinanceLineStatusBadge } from "../shared/FinanceLineStatusBadge";
import { TripScopedSectionHeader } from "../shared/TripScopedSectionHeader";
import { TripSectionShell, TripSoftPanel } from "../shared/TripSectionShell";
import type { CostsPatchResult } from "../useTripOsEngine";

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
  return parts.join(" · ");
}

function scopeEditHint(
  graph: TripEntityGraph,
  viewGroupId: string,
  scope: TripScopeSection<ActivityDraft>,
): string | null {
  if (scope.groupId === graph.mainGroupId) return null;
  if (viewGroupId === scope.groupId) return null;
  return `Edit on ${scope.title}'s calendar`;
}

export function ActivitiesSection(props: {
  graph: TripEntityGraph;
  groupId: string;
  rosterSummary?: RosterSummary;
  saving?: boolean;
  onDispatch: (commands: TripCommand[]) => Promise<boolean>;
  costLedger?: CostLedgerProjection | null;
  onOpenFinanceSection?: (section: FinanceBuiltInSection, lineId?: string) => void;
  onCostsAction?: (payload: Record<string, unknown>) => Promise<CostsPatchResult>;
}) {
  const roster = props.rosterSummary ?? { participants: [], groups: [], rooms: [] };

  const scopedActivities = useMemo(
    () => activitiesListedByScope(props.graph, roster, props.groupId),
    [props.graph, roster, props.groupId],
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

  function openActivityFinance(activityId: string) {
    props.onOpenFinanceSection?.("activities", activityFinanceAttention.get(activityId));
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
              const scopeHint = scopeEditHint(props.graph, props.groupId, scope);

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
                      const showNoCostAction =
                        financeStatus === "needs_attention" && Boolean(props.onCostsAction);

                      return (
                      <li
                        key={a.id}
                        className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-zinc-900">{a.title}</p>
                          <p className="text-sm text-zinc-500">{formatActivityLine(a)}</p>
                          {scopeHint ? (
                            <p className="mt-1 text-xs text-violet-700">{scopeHint}</p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {showNoCostAction ? (
                            <button
                              type="button"
                              disabled={props.saving}
                              onClick={() => void markActivityNoCost(a.id)}
                              className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
                              title="Mark as free — no participant charge"
                            >
                              No cost
                            </button>
                          ) : null}
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
