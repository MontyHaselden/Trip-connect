"use client";

import { useMemo, useState } from "react";
import { DateTime } from "luxon";

import type { TripEntityGraph, RosterSummary } from "@/lib/trip-engine/types";
import type { TripCommand } from "@/lib/trip-engine/commands";
import {
  transportLegFinanceDisplayStatus,
  transportLegFinanceAttentionById,
  transportLegFinanceAttentionReason,
  transportLegFinanceLineId,
  type EntityFinanceDisplayStatus,
} from "@/lib/trip-engine/cost-ledger/finance-section-readiness";
import type { CostLedgerProjection } from "@/lib/trip-engine/cost-ledger/types";
import type { FinanceBuiltInSection } from "@/lib/trip-engine/cost-ledger/finance-sections";
import {
  transportLegsListedByScope,
  pendingTransportNeedsListedByScope,
  hiddenPendingTransportNeedsListedByScope,
  pendingNeedScopeLabel,
  type ScopedTransportLeg,
  type TripScopeSection,
} from "@/lib/trip-engine/section-scope-lists";
import {
  pendingNeedLabel,
  pendingTransportNeedsFromCalendar,
  type PendingTransportNeed,
} from "@/lib/trip-engine/pending-city-moves";
import { compareTransportLegsChronologically } from "@/lib/trip-engine/transport-display";
import { transportRouteLabel } from "@/lib/trip-engine/transport-route-label";
import { legRouteLabel } from "@/lib/trip-engine/flight-package-pairs";
import { legScheduleSummary, legTransportTypeLabel } from "@/lib/host/setup/repair-transport-legs";
import { findTransportProduct } from "@/lib/host/locations/transport-products";
import type { IntercityLegDraft, TransportLegDraft, TransportProductDraft } from "@/lib/host/wizard/types";

import { FinanceLineStatusBadge } from "../shared/FinanceLineStatusBadge";
import { FinanceEntityQuickActions } from "../shared/FinanceEntityQuickActions";
import { TripScopedSectionHeader } from "../shared/TripScopedSectionHeader";
import { TripSectionShell, TripSoftPanel } from "../shared/TripSectionShell";
import { AddTransportModal } from "../transport/AddTransportModal";
import type { CostsPatchResult } from "../useTripOsEngine";
import { EditTransportLegModal } from "../transport/EditTransportLegModal";
import { TransportProductEditor } from "../transport/TransportProductEditor";

type LegBucket = "outbound" | "return" | "intercity";

function flightRoleBadge(bucket: LegBucket): string | null {
  if (bucket === "outbound") return "Outbound";
  if (bucket === "return") return "Return";
  return null;
}

function groupTransportLegs(all: ScopedTransportLeg[]) {
  const byProduct = new Map<string, ScopedTransportLeg[]>();
  const singles: ScopedTransportLeg[] = [];
  for (const leg of all) {
    if (leg.transportProductId) {
      const list = byProduct.get(leg.transportProductId) ?? [];
      list.push(leg);
      byProduct.set(leg.transportProductId, list);
    } else {
      singles.push(leg);
    }
  }
  singles.sort(compareTransportLegsChronologically);
  for (const [productId, productLegs] of byProduct) {
    byProduct.set(productId, [...productLegs].sort(compareTransportLegsChronologically));
  }
  return { byProduct, singles };
}

function scopeEditHint(
  graph: TripEntityGraph,
  viewGroupId: string,
  scope: TripScopeSection<ScopedTransportLeg>,
): string | null {
  if (scope.groupId === graph.mainGroupId) return null;
  if (viewGroupId === scope.groupId) return null;
  return `Edit on ${scope.title}'s calendar`;
}

function LegRow(props: {
  leg: TransportLegDraft | IntercityLegDraft;
  bucket: LegBucket;
  graph: TripEntityGraph;
  productLabel?: string | null;
  scopeHint?: string | null;
  financeStatus: EntityFinanceDisplayStatus;
  financeAttentionReason?: string | null;
  onOpenFinance?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  showFinanceActions?: boolean;
  saving?: boolean;
  onMarkTbc?: () => void;
}) {
  const roleBadge = props.leg.transportType === "plane" ? flightRoleBadge(props.bucket) : null;
  return (
    <li className="rounded-2xl bg-white px-4 py-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
              {legTransportTypeLabel(props.leg)}
            </span>
            {roleBadge ? (
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800">
                {roleBadge}
              </span>
            ) : null}
            {props.productLabel ? (
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800">
                {props.productLabel}
              </span>
            ) : (
              <span className="rounded-full bg-zinc-50 px-2 py-0.5 text-xs text-zinc-500">
                Single ticket
              </span>
            )}
            <p className="font-medium text-zinc-900">{legRouteLabel(props.leg, props.graph)}</p>
          </div>
          <p className="mt-0.5 text-sm text-zinc-500">{legScheduleSummary(props.leg)}</p>
          {props.scopeHint ? (
            <p className="mt-1 text-xs text-violet-700">{props.scopeHint}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-3">
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
          {props.onEdit ? (
            <button
              type="button"
              onClick={props.onEdit}
              className="text-sm font-medium text-violet-700 hover:text-violet-900"
            >
              Edit
            </button>
          ) : null}
          {props.onDelete ? (
            <button
              type="button"
              onClick={props.onDelete}
              disabled={props.saving}
              className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              Delete
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function TransportSection(props: {
  graph: TripEntityGraph;
  groupId: string;
  selectedDate?: string | null;
  saving?: boolean;
  rosterSummary?: RosterSummary;
  onDispatch: (commands: TripCommand[]) => Promise<boolean>;
  onSwitchGroup?: (groupId: string) => void;
  costLedger?: CostLedgerProjection | null;
  onOpenFinanceSection?: (section: FinanceBuiltInSection, lineId?: string) => void;
  onCostsAction?: (payload: Record<string, unknown>) => Promise<CostsPatchResult>;
}) {
  const roster = props.rosterSummary ?? { participants: [], groups: [], rooms: [] };
  const products = props.graph.transportProducts ?? [];

  const [addOpen, setAddOpen] = useState(false);
  const [prefillNeed, setPrefillNeed] = useState<PendingTransportNeed | null>(null);
  const [addGroupId, setAddGroupId] = useState(props.groupId);
  const [editingLeg, setEditingLeg] = useState<{
    leg: TransportLegDraft | IntercityLegDraft;
    bucket: LegBucket;
  } | null>(null);
  const [editingProduct, setEditingProduct] = useState<TransportProductDraft | null>(null);
  const [hiddenOpen, setHiddenOpen] = useState(false);

  const pendingScopes = useMemo(
    () => pendingTransportNeedsListedByScope(props.graph, roster, props.groupId),
    [props.graph, roster, props.groupId],
  );

  const hiddenScopes = useMemo(
    () => hiddenPendingTransportNeedsListedByScope(props.graph, roster, props.groupId),
    [props.graph, roster, props.groupId],
  );

  const pendingScopeSections = useMemo(
    () =>
      [pendingScopes.wholeGroup, ...pendingScopes.otherScopes].filter(
        (scope) => scope.items.length > 0,
      ),
    [pendingScopes],
  );

  const hiddenScopeSections = useMemo(
    () =>
      [hiddenScopes.wholeGroup, ...hiddenScopes.otherScopes].filter(
        (scope) => scope.items.length > 0,
      ),
    [hiddenScopes],
  );

  const hiddenCount = useMemo(
    () => hiddenScopeSections.reduce((total, scope) => total + scope.items.length, 0),
    [hiddenScopeSections],
  );

  const scopedLegs = useMemo(
    () => transportLegsListedByScope(props.graph, roster, props.groupId),
    [props.graph, roster, props.groupId],
  );

  const allScopes = useMemo(
    () => [scopedLegs.wholeGroup, ...scopedLegs.otherScopes],
    [scopedLegs],
  );

  const transportFinanceAttention = useMemo(
    () => transportLegFinanceAttentionById(props.costLedger, props.graph),
    [props.costLedger, props.graph],
  );

  const hasAnyLegs = allScopes.some((scope) => scope.items.length > 0);

  function openLegFinance(leg: TransportLegDraft | IntercityLegDraft) {
    const lineId =
      transportFinanceAttention.get(leg.id) ??
      transportLegFinanceLineId(leg, props.costLedger);
    props.onOpenFinanceSection?.("transport", lineId ?? undefined);
  }

  async function markLegTbc(leg: TransportLegDraft | IntercityLegDraft) {
    if (!props.onCostsAction) return;
    const lineId =
      transportFinanceAttention.get(leg.id) ??
      transportLegFinanceLineId(leg, props.costLedger);
    if (!lineId) return;
    await props.onCostsAction({
      action: "updateLine",
      lineId,
      line: { costStatus: "tbc" },
    });
  }

  function legBucket(legId: string): LegBucket {
    if (props.graph.intercityLegs.some((x) => x.id === legId)) return "intercity";
    if (props.graph.outboundLegs.some((x) => x.id === legId)) return "outbound";
    return "return";
  }

  async function deleteLeg(
    leg: TransportLegDraft | IntercityLegDraft,
    bucket: LegBucket,
    groupId: string,
  ) {
    const route = legRouteLabel(leg, props.graph);
    const schedule = legScheduleSummary(leg);
    if (
      !window.confirm(
        `Remove ${route}${schedule ? ` (${schedule})` : ""}? It will reappear in "From your calendar" so you can add it again.`,
      )
    ) {
      return;
    }
    await props.onDispatch([
      {
        type: "removeTransportLeg",
        groupId,
        bucket,
        legId: leg.id,
      },
    ]);
  }

  function openAdd(need: PendingTransportNeed, groupId: string) {
    if (groupId !== props.groupId) {
      props.onSwitchGroup?.(groupId);
    }
    setPrefillNeed(need);
    setAddGroupId(groupId);
    setAddOpen(true);
  }

  async function hideNeed(need: PendingTransportNeed, groupId: string) {
    await props.onDispatch([
      {
        type: "hidePendingTransportNeed",
        groupId,
        need: {
          kind: need.kind,
          date: need.date,
          fromCity: need.fromCity,
          toCity: need.toCity,
        },
      },
    ]);
  }

  async function unhideNeed(need: PendingTransportNeed, groupId: string) {
    await props.onDispatch([
      {
        type: "unhidePendingTransportNeed",
        groupId,
        need: {
          kind: need.kind,
          date: need.date,
          fromCity: need.fromCity,
          toCity: need.toCity,
        },
      },
    ]);
  }

  function renderPendingNeed(
    need: PendingTransportNeed,
    scope: TripScopeSection<PendingTransportNeed>,
    mode: "visible" | "hidden",
  ) {
    const scopeLabel = pendingNeedScopeLabel(props.graph, scope);
    const isActiveScope = scope.groupId === props.groupId;

    return (
      <li
        key={`${scope.groupId}:${need.kind}:${need.date}:${need.fromCity}:${need.toCity}`}
        className={[
          "flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5",
          mode === "hidden"
            ? "border-zinc-200 bg-zinc-50"
            : "border-amber-200 bg-amber-50",
        ].join(" ")}
      >
        <div className="min-w-0 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <p
              className={[
                "text-[10px] font-semibold uppercase tracking-wide",
                mode === "hidden" ? "text-zinc-500" : "text-amber-800",
              ].join(" ")}
            >
              {pendingNeedLabel(need)}
            </p>
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-900">
              {scopeLabel}
            </span>
          </div>
          <p className={mode === "hidden" ? "font-medium text-zinc-700" : "font-medium text-amber-950"}>
            {transportRouteLabel({
              from: need.fromCity,
              to: need.toCity,
              date: need.date,
              graph: props.graph,
            })}
          </p>
          <p className={mode === "hidden" ? "text-xs text-zinc-500" : "text-xs text-amber-800"}>
            {DateTime.fromISO(need.date).toFormat("d MMM yyyy")}
          </p>
          {!isActiveScope && mode === "visible" ? (
            <p className="mt-1 text-xs text-violet-700">
              Edit on {scope.title}&apos;s calendar
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {mode === "hidden" ? (
            <button
              type="button"
              onClick={() => void unhideNeed(need, scope.groupId)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Show
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void hideNeed(need, scope.groupId)}
                className="rounded-lg px-2 py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-800"
              >
                Hide
              </button>
              <button
                type="button"
                onClick={() => openAdd(need, scope.groupId)}
                title={
                  isActiveScope
                    ? undefined
                    : `Switch to ${scope.title}'s calendar and add this transport`
                }
                className="rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-950"
              >
                Add
              </button>
            </>
          )}
        </div>
      </li>
    );
  }

  function renderScopeLegs(scope: TripScopeSection<ScopedTransportLeg>) {
    if (!scope.items.length) return null;

    const isWholeGroup = scope.groupId === props.graph.mainGroupId;
    const isActiveScope = scope.groupId === props.groupId;
    const scopeHint = scopeEditHint(props.graph, props.groupId, scope);
    const grouped = groupTransportLegs(scope.items);
    const productSections = [...grouped.byProduct.entries()].sort(([, legsA], [, legsB]) => {
      const firstA = legsA[0];
      const firstB = legsB[0];
      if (!firstA || !firstB) return 0;
      return compareTransportLegsChronologically(firstA, firstB);
    });

    function legFinanceActions(leg: ScopedTransportLeg) {
      const financeStatus = transportLegFinanceDisplayStatus(leg, props.costLedger);
      return {
        showFinanceActions:
          financeStatus === "needs_attention" && Boolean(props.onCostsAction),
        onMarkTbc: () => void markLegTbc(leg),
      };
    }

    return (
      <div key={scope.groupId} className={isWholeGroup ? undefined : "mt-8"}>
        <TripScopedSectionHeader
          title={scope.title}
          memberNames={scope.memberNames}
          isWholeGroup={isWholeGroup}
        />

        <div className="mt-2 space-y-4">
          {productSections.map(([productId, productLegs]) => {
            const product = findTransportProduct(products, productId);
            if (!product) return null;
            return (
              <div key={productId}>
                <div className="mb-2 flex items-baseline gap-2">
                  <h4 className="text-sm font-semibold text-zinc-800">{product.name}</h4>
                  {isActiveScope ? (
                    <button
                      type="button"
                      onClick={() => setEditingProduct(product)}
                      className="text-xs font-medium text-violet-700 hover:text-violet-900"
                    >
                      Edit
                    </button>
                  ) : null}
                </div>
                <ul className="space-y-2">
                  {productLegs.map((leg) => (
                    <LegRow
                      key={leg.id}
                      leg={leg}
                      graph={props.graph}
                      bucket={legBucket(leg.id)}
                      productLabel={product.name}
                      scopeHint={scopeHint}
                      financeStatus={transportLegFinanceDisplayStatus(leg, props.costLedger)}
                      financeAttentionReason={transportLegFinanceAttentionReason(
                        leg,
                        props.costLedger,
                      )}
                      onOpenFinance={() => openLegFinance(leg)}
                      onEdit={
                        isActiveScope
                          ? () => setEditingLeg({ leg, bucket: legBucket(leg.id) })
                          : undefined
                      }
                      onDelete={
                        isActiveScope
                          ? () => void deleteLeg(leg, legBucket(leg.id), scope.groupId)
                          : undefined
                      }
                      saving={props.saving}
                      {...legFinanceActions(leg)}
                    />
                  ))}
                </ul>
              </div>
            );
          })}

          {grouped.singles.length ? (
            <div>
              {grouped.byProduct.size ? (
                <h4 className="mb-2 text-sm font-semibold text-zinc-800">Single tickets</h4>
              ) : null}
              <ul className="space-y-2">
                {grouped.singles.map((leg) => (
                  <LegRow
                    key={leg.id}
                    leg={leg}
                    graph={props.graph}
                    bucket={legBucket(leg.id)}
                    scopeHint={scopeHint}
                    financeStatus={transportLegFinanceDisplayStatus(leg, props.costLedger)}
                    financeAttentionReason={transportLegFinanceAttentionReason(
                      leg,
                      props.costLedger,
                    )}
                    onOpenFinance={() => openLegFinance(leg)}
                    onEdit={
                      isActiveScope
                        ? () => setEditingLeg({ leg, bucket: legBucket(leg.id) })
                        : undefined
                    }
                    onDelete={
                      isActiveScope
                        ? () => void deleteLeg(leg, legBucket(leg.id), scope.groupId)
                        : undefined
                    }
                    saving={props.saving}
                    {...legFinanceActions(leg)}
                  />
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <TripSectionShell
      eyebrow="Advanced"
      title="Transport"
      description="Whole-group transport first, then personal or subgroup legs with who they belong to."
    >
      {pendingScopeSections.length ? (
        <TripSoftPanel title="From your calendar" className="mb-6">
          <p className="text-xs text-zinc-500">
            These routes are on the calendar but don&apos;t have transport yet. Each row shows
            who it applies to — whole group or a specific participant. Choose how you are
            travelling and whether it is a single ticket or a pass/package.
          </p>
          <div className="mt-3 space-y-4">
            {pendingScopeSections.map((scope) => (
              <div key={scope.groupId}>
                {pendingScopeSections.length > 1 ? (
                  <p className="mb-2 text-xs font-semibold text-zinc-700">
                    {pendingNeedScopeLabel(props.graph, scope)}
                  </p>
                ) : null}
                <ul className="space-y-2">
                  {scope.items.map((need) => renderPendingNeed(need, scope, "visible"))}
                </ul>
              </div>
            ))}
          </div>
        </TripSoftPanel>
      ) : null}

      {hiddenCount > 0 ? (
        <TripSoftPanel title={`Hidden (${hiddenCount})`} className="mb-6">
          <button
            type="button"
            onClick={() => setHiddenOpen((open) => !open)}
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
          >
            {hiddenOpen ? "Collapse hidden routes" : "Show hidden calendar routes"}
          </button>
          {hiddenOpen ? (
            <div className="mt-3 space-y-4">
              <p className="text-xs text-zinc-500">
                These moves are still on the calendar but won&apos;t appear in the main list.
                Show one again if you want to add transport for it.
              </p>
              {hiddenScopeSections.map((scope) => (
                <div key={scope.groupId}>
                  {hiddenScopeSections.length > 1 ? (
                    <p className="mb-2 text-xs font-semibold text-zinc-700">
                      {pendingNeedScopeLabel(props.graph, scope)}
                    </p>
                  ) : null}
                  <ul className="space-y-2">
                    {scope.items.map((need) => renderPendingNeed(need, scope, "hidden"))}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}
        </TripSoftPanel>
      ) : null}

      {hasAnyLegs ? (
        <>{allScopes.map((scope) => renderScopeLegs(scope))}</>
      ) : !pendingScopeSections.length ? (
        <div className="rounded-2xl bg-zinc-50/80 px-4 py-6 text-center text-sm text-zinc-500">
          No transport yet. When the calendar shows a move between cities, it will appear above to
          assign.
        </div>
      ) : null}

      <AddTransportModal
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          setPrefillNeed(null);
          setAddGroupId(props.groupId);
        }}
        graph={props.graph}
        groupId={addGroupId}
        rosterSummary={props.rosterSummary}
        selectedDate={props.selectedDate}
        prefillNeed={prefillNeed}
        pendingNeeds={pendingTransportNeedsFromCalendar(props.graph, addGroupId)}
        saving={props.saving}
        onDispatch={props.onDispatch}
      />

      <EditTransportLegModal
        open={Boolean(editingLeg)}
        leg={editingLeg?.leg ?? null}
        bucket={editingLeg?.bucket ?? null}
        graph={props.graph}
        groupId={props.groupId}
        rosterSummary={props.rosterSummary}
        saving={props.saving}
        onClose={() => setEditingLeg(null)}
        onDispatch={props.onDispatch}
      />

      <TransportProductEditor
        open={Boolean(editingProduct)}
        product={editingProduct}
        rosterSummary={props.rosterSummary}
        saving={props.saving}
        onClose={() => setEditingProduct(null)}
        onDispatch={props.onDispatch}
      />
    </TripSectionShell>
  );
}
