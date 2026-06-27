"use client";

import { useEffect, useMemo, useState } from "react";

import type { TripCommand } from "@/lib/trip-engine/commands";
import {
  transportProductKindLabel,
  transportProductSuggestionsForTrip,
  defaultPassProductIdForMode,
} from "@/lib/trip-engine/transport-product-defaults";
import { cityMoveToPlaceholderLeg, type PendingTransportNeed } from "@/lib/trip-engine/pending-city-moves";
import {
  findReturnFlightPairForNeed,
  returnFlightPackageName,
  returnFlightPairSummary,
  type ReturnFlightPair,
} from "@/lib/trip-engine/return-flight-pair";
import { costSplitParticipants } from "@/lib/trip-engine/cost-ledger/allocate";
import type { TripEntityGraph, RosterSummary } from "@/lib/trip-engine/types";
import {
  newId,
  type IntercityLegDraft,
  type TransportProductDraft,
  type TransportProductKind,
} from "@/lib/host/wizard/types";

import { FlightLegQuickForm } from "../shared/FlightLegQuickForm";
import { tripDatePickerContext } from "../shared/trip-date-picker";

type TravelMode = "flight" | "train" | "bus" | "metro";
type BillingMode = "single" | "product";

function modeToTransportType(mode: TravelMode): IntercityLegDraft["transportType"] {
  if (mode === "flight") return "plane";
  if (mode === "train") return "train";
  if (mode === "bus") return "bus";
  return "other";
}

function defaultProductKind(mode: TravelMode, billing: BillingMode): TransportProductKind {
  if (billing === "single" && mode === "flight") return "flight_package";
  if (mode === "metro") return "ic_card";
  if (mode === "bus") return "bus_pass";
  return "train_pass";
}

function submitGroupIds(groupId: string, targetGroupIds?: string[]): string[] {
  if (!targetGroupIds?.length) return [groupId];
  return [...new Set(targetGroupIds)];
}

export function AddTransportModal(props: {
  open: boolean;
  onClose: () => void;
  graph: TripEntityGraph;
  groupId: string;
  targetGroupIds?: string[];
  rosterSummary?: RosterSummary;
  selectedDate?: string | null;
  prefillNeed?: PendingTransportNeed | null;
  pendingNeeds?: PendingTransportNeed[];
  saving?: boolean;
  onDispatch: (commands: TripCommand[]) => Promise<boolean>;
}) {
  const roster = props.rosterSummary ?? { participants: [], groups: [], rooms: [] };
  const pool = useMemo(() => costSplitParticipants(roster), [roster]);
  const datePicker = tripDatePickerContext(props.graph, props.selectedDate);

  const [mode, setMode] = useState<TravelMode>("train");
  const [billing, setBilling] = useState<BillingMode>("single");
  const [productChoice, setProductChoice] = useState<"new" | string>("new");
  const [newProductName, setNewProductName] = useState("JR Pass");
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());
  const [existingPackageId, setExistingPackageId] = useState<string | "new">("new");
  const [newPackageName, setNewPackageName] = useState("Flight package");

  const returnPair = useMemo((): ReturnFlightPair | null => {
    const need = props.prefillNeed;
    if (!need || need.kind === "intercity") return null;
    return findReturnFlightPairForNeed(
      props.graph,
      props.groupId,
      need,
      props.pendingNeeds,
    );
  }, [props.graph, props.groupId, props.prefillNeed, props.pendingNeeds]);

  const canOfferReturnPackage = Boolean(returnPair) && mode === "flight";

  const suggestions = useMemo(
    () => transportProductSuggestionsForTrip(props.graph.basics),
    [props.graph.basics],
  );

  const existingProducts = props.graph.transportProducts ?? [];
  const passProducts = existingProducts.filter(
    (product) => product.kind !== "flight_package",
  );
  const flightPackages = existingProducts.filter(
    (product) => product.kind === "flight_package",
  );

  function applyExistingProductDefaults(nextMode: TravelMode) {
    if (nextMode === "flight") {
      setExistingPackageId(flightPackages[0]?.id ?? "new");
      return;
    }
    setProductChoice(defaultPassProductIdForMode(nextMode, passProducts));
  }

  function selectBilling(nextBilling: BillingMode) {
    setBilling(nextBilling);
    if (nextBilling === "product") {
      applyExistingProductDefaults(mode);
    }
  }

  useEffect(() => {
    if (!props.open) return;
    const need = props.prefillNeed;
    const products = props.graph.transportProducts ?? [];
    const passes = products.filter((product) => product.kind !== "flight_package");
    const packages = products.filter((product) => product.kind === "flight_package");
    const nextMode: TravelMode = !need
      ? "train"
      : need.kind === "intercity"
        ? "train"
        : "flight";
    setMode(nextMode);
    if (!need) {
      setBilling("single");
    } else if (need.kind === "intercity") {
      setBilling("single");
    } else {
      setMode("flight");
      const pair = findReturnFlightPairForNeed(
        props.graph,
        props.groupId,
        need,
        props.pendingNeeds,
      );
      setBilling(pair ? "product" : "single");
    }
    if (nextMode === "flight") {
      setExistingPackageId(packages[0]?.id ?? "new");
    } else {
      setProductChoice(defaultPassProductIdForMode(nextMode, passes));
    }
    const batchParticipantIds =
      props.targetGroupIds
        ?.map((groupId) => props.graph.groups.find((group) => group.id === groupId))
        .map((group) => group?.personalForParticipantId)
        .filter((id): id is string => Boolean(id)) ?? [];
    if (batchParticipantIds.length) {
      setSelectedParticipants(new Set(batchParticipantIds));
    } else {
      setSelectedParticipants(new Set(pool.map((participant) => participant.id)));
    }
  }, [props.open, props.prefillNeed, props.pendingNeeds, pool, props.graph, props.groupId, props.targetGroupIds]);

  useEffect(() => {
    if (billing !== "product") return;
    if (mode === "flight") return;
    const suggestion = suggestions.find((row) =>
      mode === "metro" ? row.kind === "ic_card" : mode === "bus" ? row.kind === "bus_pass" : row.kind === "train_pass",
    );
    if (suggestion && productChoice === "new") {
      setNewProductName(suggestion.name);
    }
  }, [billing, mode, suggestions, productChoice]);

  if (!props.open) return null;

  const need = props.prefillNeed;
  const groupIds = submitGroupIds(props.groupId, props.targetGroupIds);
  const isBatchAdd = groupIds.length > 1;
  const isFlightNeed = need && need.kind !== "intercity";
  const pairSummary = returnPair ? returnFlightPairSummary(returnPair) : null;

  async function submitReturnPackage() {
    if (!returnPair) return;
    const commands: TripCommand[] = [];
    const productId = newId();
    commands.push({
      type: "addTransportProduct",
      product: {
        id: productId,
        kind: "flight_package",
        name: returnFlightPackageName(returnPair),
        participantIds: [],
      },
    });

    const legsToAdd: IntercityLegDraft[] = [];

    if (returnPair.kind === "pending") {
      for (const groupId of groupIds) {
        legsToAdd.push(
          {
            ...cityMoveToPlaceholderLeg(returnPair.outbound, groupId, "outbound_flight"),
            transportType: "plane",
            transportProductId: productId,
            billingMode: "product",
          },
          {
            ...cityMoveToPlaceholderLeg(returnPair.return, groupId, "return_flight"),
            transportType: "plane",
            transportProductId: productId,
            billingMode: "product",
          },
        );
      }
    } else if ("returnLeg" in returnPair) {
      for (const groupId of groupIds) {
        legsToAdd.push({
          ...cityMoveToPlaceholderLeg(returnPair.outbound, groupId, "outbound_flight"),
          transportType: "plane",
          transportProductId: productId,
          billingMode: "product",
        });
      }
      if (groupIds.length === 1) {
        commands.push({
          type: "updateTransportLeg",
          groupId: groupIds[0]!,
          bucket: returnPair.returnLeg.bucket,
          legId: returnPair.returnLeg.leg.id,
          patch: {
            transportProductId: productId,
            billingMode: "product",
          },
        });
      }
    } else {
      for (const groupId of groupIds) {
        legsToAdd.push({
          ...cityMoveToPlaceholderLeg(returnPair.return, groupId, "return_flight"),
          transportType: "plane",
          transportProductId: productId,
          billingMode: "product",
        });
      }
      if (groupIds.length === 1) {
        commands.push({
          type: "updateTransportLeg",
          groupId: groupIds[0]!,
          bucket: returnPair.outboundLeg.bucket,
          legId: returnPair.outboundLeg.leg.id,
          patch: {
            transportProductId: productId,
            billingMode: "product",
          },
        });
      }
    }

    if (legsToAdd.length) {
      for (const groupId of groupIds) {
        const legsForGroup = legsToAdd.filter((leg) => leg.originGroupId === groupId);
        if (!legsForGroup.length) continue;
        commands.push({
          type: "addClassifiedTransportLegs",
          groupId,
          legs: legsForGroup,
        });
      }
    }

    const ok = await props.onDispatch(commands);
    if (ok) props.onClose();
  }

  async function submitPlaceholderLeg() {
    if (!need) return;
    const commands: TripCommand[] = [];
    let productId: string | null = null;

    if (billing === "product") {
      if (productChoice === "new") {
        productId = newId();
        const kind = defaultProductKind(mode, billing);
        const product: TransportProductDraft = {
          id: productId,
          kind,
          name: newProductName.trim() || transportProductKindLabel(kind),
          participantIds: [...selectedParticipants],
        };
        commands.push({ type: "addTransportProduct", product });
      } else {
        productId = productChoice;
      }
    }

    for (const groupId of groupIds) {
      commands.push({
        type: "addClassifiedTransportLegs",
        groupId,
        legs: [
          {
            ...cityMoveToPlaceholderLeg(need, groupId, need.kind),
            transportType: modeToTransportType(mode),
            transportProductId: productId,
            billingMode: productId ? ("product" as const) : ("single" as const),
          },
        ],
      });
      commands.push({
        type: "hidePendingTransportNeed",
        groupId,
        need: {
          kind: need.kind,
          date: need.date,
          fromCity: need.fromCity,
          toCity: need.toCity,
        },
      });
    }

    const ok = await props.onDispatch(commands);
    if (ok) props.onClose();
  }

  async function submitFlightLegs(legs: IntercityLegDraft[]): Promise<boolean> {
    const commands: TripCommand[] = [];
    let productId: string | null = null;

    if (billing === "product") {
      if (existingPackageId === "new") {
        productId = newId();
        commands.push({
          type: "addTransportProduct",
          product: {
            id: productId,
            kind: "flight_package",
            name: newPackageName.trim() || "Flight package",
            participantIds: [],
          },
        });
      } else {
        productId = existingPackageId;
      }
    }

    const tagged = legs.map((leg) => ({
      ...leg,
      transportProductId: productId,
      billingMode: productId ? ("product" as const) : ("single" as const),
    }));

    for (const groupId of groupIds) {
      commands.push({
        type: "addClassifiedTransportLegs",
        groupId,
        legs: tagged.map((leg) => ({
          ...leg,
          id: newId(),
          originGroupId: groupId,
        })),
      });
    }

    const ok = await props.onDispatch(commands);
    if (ok) props.onClose();
    return ok;
  }

  function toggleParticipant(id: string) {
    setSelectedParticipants((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 text-zinc-900 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-zinc-900">
              {canOfferReturnPackage && pairSummary
                ? pairSummary.packageTitle
                : "Add transport"}
            </h3>
            {!canOfferReturnPackage && need ? (
              <p className="mt-1 text-sm text-zinc-500">
                {need.fromCity} → {need.toCity} · {need.date}
                {isBatchAdd ? ` · adding for ${groupIds.length} travellers` : ""}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className="text-sm text-zinc-500 hover:text-zinc-800"
          >
            Close
          </button>
        </div>

        <div className="mt-5 space-y-5">
          {!canOfferReturnPackage && !isFlightNeed ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">How</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  ["flight", "Flight"],
                  ["train", "Train"],
                  ["bus", "Bus"],
                  ["metro", "Metro / IC"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setMode(value);
                    if (billing === "product" && value !== "flight") {
                      setProductChoice(
                        defaultPassProductIdForMode(value, passProducts),
                      );
                    }
                  }}
                  className={[
                    "rounded-full px-3 py-1.5 text-sm font-medium",
                    mode === value
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
                  ].join(" ")}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          ) : null}

          {(isFlightNeed && canOfferReturnPackage) || !isFlightNeed || need?.kind === "intercity" ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Billing</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => selectBilling("single")}
                  className={[
                    "rounded-full px-3 py-1.5 text-sm font-medium",
                    billing === "single"
                      ? "bg-violet-600 text-white"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
                  ].join(" ")}
                >
                  Single ticket
                </button>
                {canOfferReturnPackage ? (
                  <button
                    type="button"
                    onClick={() => selectBilling("product")}
                    className={[
                      "rounded-full px-3 py-1.5 text-sm font-medium",
                      billing === "product"
                        ? "bg-violet-600 text-white"
                        : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
                    ].join(" ")}
                  >
                    Return package
                  </button>
                ) : mode !== "flight" ? (
                  <button
                    type="button"
                    onClick={() => selectBilling("product")}
                    className={[
                      "rounded-full px-3 py-1.5 text-sm font-medium",
                      billing === "product"
                        ? "bg-violet-600 text-white"
                        : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
                    ].join(" ")}
                  >
                    {mode === "metro" ? "IC card" : "Pass"}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {billing === "product" && canOfferReturnPackage && pairSummary ? (
            <div className="space-y-4 rounded-xl bg-violet-50 p-4">
              <div className="space-y-2 font-mono text-sm text-zinc-800">
                <div className="flex items-baseline gap-4">
                  <span className="w-14 shrink-0 text-zinc-500">{pairSummary.outboundDate}</span>
                  <span className="font-semibold tracking-wide">{pairSummary.outboundRoute}</span>
                </div>
                <div className="flex items-baseline gap-4">
                  <span className="w-14 shrink-0 text-zinc-500">{pairSummary.returnDate}</span>
                  <span className="font-semibold tracking-wide">{pairSummary.returnRoute}</span>
                </div>
              </div>
              <button
                type="button"
                disabled={props.saving}
                onClick={() => void submitReturnPackage()}
                className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-300"
              >
                Add return package
              </button>
            </div>
          ) : null}

          {billing === "product" && mode === "flight" && !canOfferReturnPackage && !isFlightNeed ? (
            <div className="space-y-3 rounded-xl bg-zinc-50 p-4">
              <label className="block text-sm font-medium text-zinc-800">Package</label>
              <select
                value={existingPackageId}
                onChange={(e) => setExistingPackageId(e.target.value as string | "new")}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
              >
                {flightPackages.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
                <option value="new">Create new package</option>
              </select>
              {existingPackageId === "new" ? (
                <input
                  value={newPackageName}
                  onChange={(e) => setNewPackageName(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                  placeholder="Flight package name"
                />
              ) : null}
              <p className="text-xs text-zinc-500">
                Only participants on every leg in the package are billed together.
              </p>
            </div>
          ) : null}

          {billing === "product" && mode !== "flight" ? (
            <div className="space-y-3 rounded-xl bg-zinc-50 p-4">
              <label className="block text-sm font-medium text-zinc-800">Pass or card</label>
              <select
                value={productChoice}
                onChange={(e) => setProductChoice(e.target.value as "new" | string)}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
              >
                {passProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
                <option value="new">Create new</option>
              </select>
              {productChoice === "new" ? (
                <>
                  {suggestions.length ? (
                    <div className="flex flex-wrap gap-2">
                      {suggestions.map((suggestion) => (
                        <button
                          key={`${suggestion.kind}:${suggestion.name}`}
                          type="button"
                          onClick={() => setNewProductName(suggestion.name)}
                          className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-900 hover:border-violet-300"
                        >
                          {suggestion.name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <input
                    value={newProductName}
                    onChange={(e) => setNewProductName(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                    placeholder="e.g. JR Pass"
                  />
                </>
              ) : null}
              {productChoice === "new" ? (
                <div>
                  <p className="text-xs font-medium text-zinc-700">Who has this pass?</p>
                  <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                    {pool.map((participant) => (
                      <li key={participant.id}>
                        <label className="flex items-center gap-2 text-sm text-zinc-800">
                          <input
                            type="checkbox"
                            checked={selectedParticipants.has(participant.id)}
                            onChange={() => toggleParticipant(participant.id)}
                          />
                          {participant.fullName}
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {mode === "flight" && billing === "single" && isFlightNeed ? (
            <button
              type="button"
              disabled={props.saving}
              onClick={() => void submitPlaceholderLeg()}
              className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-300"
            >
              Add single flight
            </button>
          ) : mode === "flight" && billing === "single" && !need ? (
            <FlightLegQuickForm
              groupId={props.groupId}
              defaultDate={props.selectedDate ?? undefined}
              anchorDate={datePicker.anchorDate}
              prefillRoute={null}
              saving={props.saving}
              onSubmit={submitFlightLegs}
            />
          ) : need && !(billing === "product" && canOfferReturnPackage) ? (
            <button
              type="button"
              disabled={props.saving}
              onClick={() => void submitPlaceholderLeg()}
              className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-300"
            >
              Add {mode === "train" ? "train" : mode === "bus" ? "bus" : "trip"} leg
            </button>
          ) : !canOfferReturnPackage ? (
            <p className="text-sm text-zinc-500">
              Select a route from the calendar above, or use the flight form when a flight is needed.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
