"use client";

import { useMemo, useState } from "react";
import { DateTime } from "luxon";

import type { TripEntityGraph, RosterSummary } from "@/lib/trip-engine/types";
import type { TripCommand } from "@/lib/trip-engine/commands";
import {
  groupedTransportLegFinanceAttentionReason,
  groupedTransportLegFinanceDisplayStatus,
  transportLegFinanceDisplayStatus,
  transportLegFinanceDisplayStatusForLeg,
  transportLegFinanceAttentionById,
  transportLegFinanceAttentionReason,
  transportLegFinanceLineId,
  type EntityFinanceDisplayStatus,
} from "@/lib/trip-engine/cost-ledger/finance-section-readiness";
import type { CostLedgerProjection } from "@/lib/trip-engine/cost-ledger/types";
import type { FinanceBuiltInSection } from "@/lib/trip-engine/cost-ledger/finance-sections";
import {
  hiddenPendingTransportListedFromProjection,
  pendingTransportListedFromProjection,
  transportLegsListedFromProjection,
} from "@/lib/trip-admin/list-adapters";
import {
  isScopeEditable,
  scopeEditHint as adminScopeEditHint,
} from "@/lib/trip-admin/edit-affordances";
import type { CalendarEditContext, TripAdminProjection } from "@/lib/trip-admin/types";
import {
  pendingNeedScopeLabel,
  type ScopedTransportLeg,
  type TripScopeSection,
} from "@/lib/trip-engine/section-scope-lists";
import {
  formatGroupedTravellerLabel,
  listPendingTransportNeedsForDisplay,
  type PendingTransportListItem,
  type PendingTransportScopeRef,
} from "@/lib/trip-engine/group-pending-transport-needs";
import {
  groupPersonalTransportScopesForDisplay,
  transportLegRouteKey,
  type TransportLegDisplayScope,
  type TransportLegGroupedTarget,
} from "@/lib/trip-engine/group-transport-legs-for-display";
import {
  pendingNeedLabel,
  pendingTransportNeedsFromCalendar,
  type PendingTransportNeed,
} from "@/lib/trip-engine/pending-city-moves";
import { pendingTransportNeedKey } from "@/lib/trip-engine/hidden-pending-transport";
import { compareTransportLegsChronologically } from "@/lib/trip-engine/transport-display";
import { transportRouteLabel } from "@/lib/trip-engine/transport-route-label";
import { legRouteLabel } from "@/lib/trip-engine/flight-package-pairs";
import { legScheduleSummary, legTransportTypeLabel } from "@/lib/host/setup/repair-transport-legs";
import { findTransportProduct } from "@/lib/host/locations/transport-products";
import type { IntercityLegDraft, TransportLegDraft, TransportProductDraft } from "@/lib/host/wizard/types";
import { returnFlightPackageSummaryFromLegs } from "@/lib/trip-engine/return-flight-pair";

import { FinanceLineStatusBadge } from "../shared/FinanceLineStatusBadge";
import { FinanceEntityQuickActions } from "../shared/FinanceEntityQuickActions";
import { TripConfirmModal } from "../shared/TripConfirmModal";
import { TripScopedSectionHeader } from "../shared/TripScopedSectionHeader";
import { TripSectionShell, TripSoftPanel } from "../shared/TripSectionShell";
import { AddTransportModal } from "../transport/AddTransportModal";
import type { CostsPatchResult } from "../useTripOsEngine";
import { EditTransportLegModal } from "../transport/EditTransportLegModal";
import { TransportProductEditor } from "../transport/TransportProductEditor";

type LegBucket = "outbound" | "return" | "intercity";

type PendingTransportDelete = {
  targets: Array<{ legId: string; groupId: string; bucket: LegBucket }>;
  route: string;
  schedule: string;
};

function flightRoleBadge(bucket: LegBucket): string | null {
  if (bucket === "outbound") return "Outbound";
  if (bucket === "return") return "Return";
  return null;
}

function dedupeLegsForDisplay(legs: ScopedTransportLeg[]): ScopedTransportLeg[] {
  const seen = new Set<string>();
  const result: ScopedTransportLeg[] = [];
  for (const leg of legs) {
    const key = transportLegRouteKey(leg);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(leg);
  }
  return result;
}

function groupTransportLegs(
  all: ScopedTransportLeg[],
  products: TransportProductDraft[],
) {
  const byProduct = new Map<string, ScopedTransportLeg[]>();
  const singles: ScopedTransportLeg[] = [];
  for (const leg of all) {
    if (leg.transportProductId) {
      const product = findTransportProduct(products, leg.transportProductId);
      if (!product) {
        singles.push(leg);
        continue;
      }
      const list = byProduct.get(leg.transportProductId) ?? [];
      list.push(leg);
      byProduct.set(leg.transportProductId, list);
    } else {
      singles.push(leg);
    }
  }
  const dedupedSingles = dedupeLegsForDisplay(singles);
  dedupedSingles.sort(compareTransportLegsChronologically);
  for (const [productId, productLegs] of byProduct) {
    byProduct.set(productId, dedupeLegsForDisplay([...productLegs]).sort(compareTransportLegsChronologically));
  }
  return { byProduct, singles: dedupedSingles };
}

function orphanTransportProducts(
  products: TransportProductDraft[],
  scopedLegs: ScopedTransportLeg[],
  scopeGroupId: string,
  mainGroupId: string,
): TransportProductDraft[] {
  if (scopeGroupId !== mainGroupId) return [];
  const linked = new Set(
    scopedLegs.map((leg) => leg.transportProductId).filter((id): id is string => Boolean(id)),
  );
  return products.filter((product) => !linked.has(product.id));
}

function isReturnFlightPackage(
  product: TransportProductDraft | null | undefined,
  legs: ScopedTransportLeg[],
): boolean {
  return (
    product?.kind === "flight_package" &&
    legs.length === 2 &&
    legs.every((leg) => leg.transportType === "plane")
  );
}

function FlightReturnPackageRow(props: {
  product: TransportProductDraft;
  legs: ScopedTransportLeg[];
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
  const sorted = [...props.legs].sort(compareTransportLegsChronologically);
  const outbound = sorted[0]!;
  const returnLeg = sorted[1]!;
  const summary = returnFlightPackageSummaryFromLegs(outbound, returnLeg);

  return (
    <li className="rounded-2xl bg-white px-4 py-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800">
              Return package
            </span>
            <p className="font-medium text-zinc-900">{summary.packageTitle}</p>
          </div>
          <div className="mt-2 space-y-1 text-sm">
            <p className="flex flex-wrap items-baseline gap-x-2 text-zinc-800">
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800">
                Outbound
              </span>
              <span className="text-xs text-zinc-500">{summary.outboundDate}</span>
              <span className="font-medium tracking-wide">{summary.outboundRoute}</span>
            </p>
            <p className="flex flex-wrap items-baseline gap-x-2 text-zinc-800">
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800">
                Return
              </span>
              <span className="text-xs text-zinc-500">{summary.returnDate}</span>
              <span className="font-medium tracking-wide">{summary.returnRoute}</span>
            </p>
          </div>
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
            ) : props.leg.transportProductId ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                Pass link needs save
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
  adminProjection: TripAdminProjection;
  calendarEditContext: CalendarEditContext;
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
  const editGroupId = props.calendarEditContext.editGroupId;
  const financeScope = useMemo(
    () => ({ scopedGroupId: editGroupId, roster }),
    [editGroupId, roster],
  );

  function legFinanceStatus(leg: { id: string; transportProductId?: string | null }) {
    return transportLegFinanceDisplayStatusForLeg(
      leg,
      props.costLedger,
      props.graph,
      financeScope,
    );
  }

  const [addOpen, setAddOpen] = useState(false);
  const [prefillNeed, setPrefillNeed] = useState<PendingTransportNeed | null>(null);
  const [addGroupId, setAddGroupId] = useState(editGroupId);
  const [addTargetGroupIds, setAddTargetGroupIds] = useState<string[] | null>(null);
  const [separatedRouteKeys, setSeparatedRouteKeys] = useState<Set<string>>(() => new Set());
  const [editingLeg, setEditingLeg] = useState<{
    leg: TransportLegDraft | IntercityLegDraft;
    bucket: LegBucket;
    groupedLegTargets?: TransportLegGroupedTarget[];
  } | null>(null);
  const [editingProduct, setEditingProduct] = useState<TransportProductDraft | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingTransportDelete | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const pendingScopes = useMemo(
    () => pendingTransportListedFromProjection(props.adminProjection),
    [props.adminProjection],
  );

  const hiddenScopes = useMemo(
    () => hiddenPendingTransportListedFromProjection(props.adminProjection),
    [props.adminProjection],
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

  const calendarPendingSections = useMemo(() => {
    const byGroupId = new Map<string, TripScopeSection<PendingTransportNeed>>();

    for (const section of [...pendingScopeSections, ...hiddenScopeSections]) {
      const existing = byGroupId.get(section.groupId);
      if (!existing) {
        byGroupId.set(section.groupId, { ...section, items: [...section.items] });
        continue;
      }
      const seen = new Set(
        existing.items.map((need) => pendingTransportNeedKey(section.groupId, need)),
      );
      for (const need of section.items) {
        const key = pendingTransportNeedKey(section.groupId, need);
        if (seen.has(key)) continue;
        existing.items.push(need);
        seen.add(key);
      }
    }

    return [...byGroupId.values()];
  }, [pendingScopeSections, hiddenScopeSections]);

  const pendingListItems = useMemo(
    () =>
      listPendingTransportNeedsForDisplay(
        calendarPendingSections,
        separatedRouteKeys,
        props.graph.mainGroupId,
      ),
    [calendarPendingSections, separatedRouteKeys, props.graph.mainGroupId],
  );

  const scopedLegs = useMemo(
    () => transportLegsListedFromProjection(props.adminProjection),
    [props.adminProjection],
  );

  const allScopes = useMemo((): TransportLegDisplayScope[] => {
    const groupedPersonal = groupPersonalTransportScopesForDisplay(scopedLegs.otherScopes);
    return [scopedLegs.wholeGroup, ...groupedPersonal];
  }, [scopedLegs]);

  const transportFinanceAttention = useMemo(
    () => transportLegFinanceAttentionById(props.costLedger, props.graph),
    [props.costLedger, props.graph],
  );

  const hasAnyLegs = allScopes.some((scope) => scope.items.length > 0);

  function openLegFinance(leg: TransportLegDraft | IntercityLegDraft) {
    const lineId =
      transportFinanceAttention.get(leg.id) ??
      transportLegFinanceLineId(leg, props.costLedger, props.graph);
    props.onOpenFinanceSection?.("transport", lineId ?? undefined);
  }

  async function markLegTbc(leg: TransportLegDraft | IntercityLegDraft) {
    if (!props.onCostsAction) return;
    const lineId =
      transportFinanceAttention.get(leg.id) ??
      transportLegFinanceLineId(leg, props.costLedger, props.graph);
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

  function requestDeleteLeg(
    leg: TransportLegDraft | IntercityLegDraft,
    bucket: LegBucket,
    groupId: string,
    groupedTargets?: Array<{ legId: string; groupId: string }>,
  ) {
    const route = legRouteLabel(leg, props.graph);
    const schedule = legScheduleSummary(leg);
    const targets =
      groupedTargets?.length ?
        groupedTargets.map((target) => ({ ...target, bucket }))
      : [{ legId: leg.id, groupId, bucket }];
    const scopedTargets =
      editGroupId === props.graph.mainGroupId
        ? targets
        : targets.filter((target) => target.groupId === editGroupId);
    if (!scopedTargets.length) return;
    setPendingDelete({ targets: scopedTargets, route, schedule });
  }

  async function confirmDeleteLeg() {
    if (!pendingDelete) return;
    setDeleteBusy(true);
    try {
      await props.onDispatch(
        pendingDelete.targets.map((target) => ({
          type: "removeTransportLeg" as const,
          groupId: target.groupId,
          bucket: target.bucket,
          legId: target.legId,
        })),
      );
      setPendingDelete(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  function requestDeleteProductLegs(
    legs: TransportLegDraft[],
    scopeGroupId: string,
    route: string,
  ) {
    setPendingDelete({
      route,
      schedule: "",
      targets: legs.map((leg) => ({
        legId: leg.id,
        groupId: scopeGroupId,
        bucket: legBucket(leg.id),
      })),
    });
  }

  function openAdd(need: PendingTransportNeed, groupId: string, targetGroupIds?: string[]) {
    if (!isScopeEditable(groupId, props.calendarEditContext, props.graph)) {
      props.onSwitchGroup?.(groupId);
    }
    setPrefillNeed(need);
    setAddGroupId(groupId);
    setAddTargetGroupIds(targetGroupIds?.length ? targetGroupIds : null);
    setAddOpen(true);
  }

  function separateFlights(routeKey: string) {
    setSeparatedRouteKeys((prev) => new Set([...prev, routeKey]));
  }

  function scopeSectionFromRef(
    scope: PendingTransportScopeRef,
  ): TripScopeSection<PendingTransportNeed> {
    return {
      groupId: scope.groupId,
      title: scope.title,
      memberNames: scope.memberNames,
      items: [scope.need],
    };
  }

  function renderPendingListItem(item: PendingTransportListItem) {
    if (item.type === "grouped") {
      return renderGroupedPendingNeed(item);
    }
    return renderPendingNeed(item.need, scopeSectionFromRef(item.scope));
  }

  function renderGroupedPendingNeed(
    item: Extract<PendingTransportListItem, { type: "grouped" }>,
  ) {
    const { need, scopes, routeKey } = item;
    const travellerLabel = formatGroupedTravellerLabel(scopes);
    const primaryGroupId = scopes[0]!.groupId;
    const groupIds = scopes.map((scope) => scope.groupId);
    const isActiveScope = scopes.some((scope) =>
      isScopeEditable(scope.groupId, props.calendarEditContext, props.graph),
    );

    return (
      <li
        key={`grouped:${routeKey}`}
        className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5"
      >
        <div className="min-w-0 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800">
              {pendingNeedLabel(need)}
            </p>
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-900">
              {travellerLabel}
            </span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-900">
              Same for all
            </span>
          </div>
          <p className="font-medium text-amber-950">
            {transportRouteLabel({
              from: need.fromCity,
              to: need.toCity,
              date: need.date,
              graph: props.graph,
            })}
          </p>
          <p className="text-xs text-amber-800">
            {DateTime.fromISO(need.date).toFormat("d MMM yyyy")}
          </p>
          <p className="mt-1 text-xs text-zinc-600">
            One booking can cover everyone on this route. Use separate flights if numbers or times
            differ.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => separateFlights(routeKey)}
            className="rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-100"
          >
            Separate flights
          </button>
          <button
            type="button"
            onClick={() => openAdd(need, primaryGroupId, groupIds)}
            title={
              isActiveScope
                ? `Add transport for ${travellerLabel}`
                : `Switch calendar and add transport for ${travellerLabel}`
            }
            className="rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-950"
          >
            Add for all
          </button>
        </div>
      </li>
    );
  }

  function renderPendingNeed(
    need: PendingTransportNeed,
    scope: TripScopeSection<PendingTransportNeed>,
  ) {
    const scopeLabel = pendingNeedScopeLabel(props.graph, scope);
    const isActiveScope = isScopeEditable(
      scope.groupId,
      props.calendarEditContext,
      props.graph,
    );

    return (
      <li
        key={`${scope.groupId}:${need.kind}:${need.date}:${need.fromCity}:${need.toCity}`}
        className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5"
      >
        <div className="min-w-0 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800">
              {pendingNeedLabel(need)}
            </p>
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-900">
              {scopeLabel}
            </span>
          </div>
          <p className="font-medium text-amber-950">
            {transportRouteLabel({
              from: need.fromCity,
              to: need.toCity,
              date: need.date,
              graph: props.graph,
            })}
          </p>
          <p className="text-xs text-amber-800">
            {DateTime.fromISO(need.date).toFormat("d MMM yyyy")}
          </p>
          {!isActiveScope ? (
            <p className="mt-1 text-xs text-violet-700">
              Edit on {scope.title}&apos;s calendar
            </p>
          ) : null}
        </div>
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
      </li>
    );
  }

  function renderScopeLegs(scope: TransportLegDisplayScope) {
    if (!scope.items.length) return null;

    const isWholeGroup = scope.groupId === props.graph.mainGroupId;
    const isGroupedPersonal = Boolean(scope.groupedLegTargets?.length);
    const isActiveScope =
      isScopeEditable(scope.groupId, props.calendarEditContext, props.graph) ||
      (isGroupedPersonal &&
        scope.groupedLegTargets?.some((target) =>
          isScopeEditable(target.groupId, props.calendarEditContext, props.graph),
        ));
    const scopeHint = isGroupedPersonal
      ? null
      : adminScopeEditHint(
          scope.groupId,
          scope.title,
          props.calendarEditContext,
          props.graph,
        );
    const groupedLegs = isGroupedPersonal
      ? (scope.groupedLegTargets ?? [])
          .map((target) => props.graph.intercityLegs.find((leg) => leg.id === target.legId))
          .filter((leg): leg is (typeof props.graph.intercityLegs)[number] => Boolean(leg))
      : [];
    const grouped = groupTransportLegs(scope.items, products);
    const orphanProducts = orphanTransportProducts(
      products,
      scope.items,
      scope.groupId,
      props.graph.mainGroupId,
    );
    const productSections = [...grouped.byProduct.entries()].sort(([, legsA], [, legsB]) => {
      const firstA = legsA[0];
      const firstB = legsB[0];
      if (!firstA || !firstB) return 0;
      return compareTransportLegsChronologically(firstA, firstB);
    });

    const canEditLeg =
      isActiveScope ||
      isGroupedPersonal ||
      Boolean(scope.groupedLegTargets?.length);

    function openLegEditor(leg: ScopedTransportLeg) {
      setEditingLeg({
        leg,
        bucket: legBucket(leg.id),
        groupedLegTargets: scope.groupedLegTargets,
      });
    }

    function legFinanceActions(leg: ScopedTransportLeg) {
      const financeStatus = isGroupedPersonal
        ? groupedTransportLegFinanceDisplayStatus(groupedLegs, props.costLedger, props.graph, financeScope)
        : transportLegFinanceDisplayStatusForLeg(leg, props.costLedger, props.graph, financeScope);
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
          {orphanProducts.map((product) => (
            <div key={product.id}>
              <div className="mb-2 flex items-baseline gap-2">
                <h4 className="text-sm font-semibold text-zinc-800">{product.name}</h4>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                  No legs linked yet
                </span>
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
            </div>
          ))}
          {productSections.map(([productId, productLegs]) => {
            const product = findTransportProduct(products, productId);
            if (!product) return null;
            const showAsReturnPackage = isReturnFlightPackage(product, productLegs);
            const packageFinanceStatus = (() => {
              if (!showAsReturnPackage) return "complete" as EntityFinanceDisplayStatus;
              const statuses = productLegs.map((leg) =>
                transportLegFinanceDisplayStatusForLeg(leg, props.costLedger, props.graph, financeScope),
              );
              if (statuses.some((s) => s === "needs_attention")) return "needs_attention";
              if (statuses.some((s) => s === "tbc")) return "tbc";
              return statuses[0] ?? "complete";
            })();
            const packageFinanceReason = showAsReturnPackage
              ? productLegs
                  .map((leg) => transportLegFinanceAttentionReason(leg, props.costLedger, props.graph))
                  .find(Boolean) ?? null
              : null;

            return (
              <div key={productId}>
                {!showAsReturnPackage ? (
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
                ) : null}
                <ul className="space-y-2">
                  {showAsReturnPackage ? (
                    <FlightReturnPackageRow
                      product={product}
                      legs={productLegs}
                      scopeHint={scopeHint}
                      financeStatus={packageFinanceStatus}
                      financeAttentionReason={packageFinanceReason}
                      onOpenFinance={() => {
                        const leg = productLegs.find(
                          (row) =>
                            transportLegFinanceDisplayStatusForLeg(row, props.costLedger, props.graph) ===
                            "needs_attention",
                        );
                        if (leg) openLegFinance(leg);
                      }}
                      onEdit={isActiveScope ? () => setEditingProduct(product) : undefined}
                      onDelete={() => {
                        const sorted = [...productLegs].sort(compareTransportLegsChronologically);
                        const route = returnFlightPackageSummaryFromLegs(
                          sorted[0]!,
                          sorted[1]!,
                        ).packageTitle;
                        requestDeleteProductLegs(productLegs, scope.groupId, route);
                      }}
                      saving={props.saving}
                      showFinanceActions={
                        packageFinanceStatus === "needs_attention" &&
                        Boolean(props.onCostsAction)
                      }
                      onMarkTbc={() => {
                        const leg = productLegs.find(
                          (row) =>
                            transportLegFinanceDisplayStatusForLeg(row, props.costLedger, props.graph) ===
                            "needs_attention",
                        );
                        if (leg) void markLegTbc(leg);
                      }}
                    />
                  ) : (
                    productLegs.map((leg) => (
                      <LegRow
                        key={leg.id}
                        leg={leg}
                        graph={props.graph}
                        bucket={legBucket(leg.id)}
                        productLabel={product.name}
                        scopeHint={scopeHint}
                        financeStatus={transportLegFinanceDisplayStatusForLeg(leg, props.costLedger, props.graph, financeScope)}
                        financeAttentionReason={transportLegFinanceAttentionReason(
                          leg,
                          props.costLedger,
                          props.graph,
                        )}
                        onOpenFinance={() => openLegFinance(leg)}
                        onEdit={canEditLeg ? () => openLegEditor(leg) : undefined}
                        onDelete={() =>
                          requestDeleteLeg(
                            leg,
                            legBucket(leg.id),
                            scope.groupId,
                            scope.groupedLegTargets,
                          )
                        }
                        saving={props.saving}
                        {...legFinanceActions(leg)}
                      />
                    ))
                  )}
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
                    financeStatus={
                      isGroupedPersonal
                        ? groupedTransportLegFinanceDisplayStatus(groupedLegs, props.costLedger, props.graph, financeScope)
                        : transportLegFinanceDisplayStatusForLeg(leg, props.costLedger, props.graph, financeScope)
                    }
                    financeAttentionReason={
                      isGroupedPersonal
                        ? groupedTransportLegFinanceAttentionReason(groupedLegs, props.costLedger, props.graph, financeScope)
                        : transportLegFinanceAttentionReason(leg, props.costLedger, props.graph)
                    }
                    onOpenFinance={() => openLegFinance(leg)}
                    onEdit={canEditLeg ? () => openLegEditor(leg) : undefined}
                    onDelete={() =>
                      requestDeleteLeg(
                        leg,
                        legBucket(leg.id),
                        scope.groupId,
                        scope.groupedLegTargets,
                      )
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
      {pendingListItems.length ? (
        <TripSoftPanel title="From your calendar" className="mb-6">
          <p className="text-xs text-zinc-500">
            These routes are on the calendar but don&apos;t have transport yet. Identical routes
            for multiple travellers are grouped — add once for everyone, or separate flights if
            times or flight numbers differ.
          </p>
          <ul className="mt-3 space-y-2">
            {pendingListItems.map((item) => renderPendingListItem(item))}
          </ul>
        </TripSoftPanel>
      ) : null}

      {hasAnyLegs ? (
        <>{allScopes.map((scope) => renderScopeLegs(scope))}</>
      ) : !pendingListItems.length ? (
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
          setAddGroupId(editGroupId);
          setAddTargetGroupIds(null);
        }}
        graph={props.graph}
        groupId={addGroupId}
        targetGroupIds={addTargetGroupIds ?? undefined}
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
        groupId={editGroupId}
        groupedLegTargets={editingLeg?.groupedLegTargets}
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

      <TripConfirmModal
        open={Boolean(pendingDelete)}
        eyebrow="Transport"
        title={
          pendingDelete ?
            pendingDelete.targets.length > 1 ?
              `Remove ${pendingDelete.route}${pendingDelete.schedule ? ` (${pendingDelete.schedule})` : ""} for ${pendingDelete.targets.length} travellers?`
            : `Remove ${pendingDelete.route}${pendingDelete.schedule ? ` (${pendingDelete.schedule})` : ""}?`
          : "Remove transport?"
        }
        description={
          pendingDelete ?
            pendingDelete.targets.length > 1 ?
              "These legs will reappear in From your calendar so you can add them again."
            : pendingDelete.targets.length === 2 && !pendingDelete.schedule ?
              "Both flights will reappear in From your calendar so you can add them again."
            : "It will reappear in From your calendar so you can add it again."
          : undefined
        }
        tone="danger"
        confirmLabel="Remove"
        confirmLoading={deleteBusy || props.saving}
        onCancel={() => {
          if (deleteBusy) return;
          setPendingDelete(null);
        }}
        onConfirm={() => void confirmDeleteLeg()}
      />
    </TripSectionShell>
  );
}
