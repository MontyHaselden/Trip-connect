"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { TransportLegForm } from "@/components/host/wizard/shared/TransportLegForm";
import { TripConfirmModal } from "@/components/trip-os/shared/TripConfirmModal";
import { legsForTransportProduct } from "@/lib/host/locations/transport-products";
import { graphToSetupState } from "@/lib/trip-engine/adapters";
import type { TripCommand } from "@/lib/trip-engine/commands";
import {
  defaultPairedLegId,
  flightPackagePairCandidates,
  legRouteLabel,
  findLegPlacement,
} from "@/lib/trip-engine/flight-package-pairs";
import { buildGroupedTransportLegCommands } from "@/lib/trip-engine/grouped-transport-leg-commands";
import type { TransportLegGroupedTarget } from "@/lib/trip-engine/group-transport-legs-for-display";
import { personalGroupIdForParticipant } from "@/lib/trip-engine/person-lens";
import type { TripEntityGraph, RosterSummary } from "@/lib/trip-engine/types";
import { transportProductKindLabel } from "@/lib/trip-engine/transport-product-defaults";
import {
  lastTripPersistSucceeded,
  waitForTripPersist,
} from "@/lib/trip-os/persist-queue";
import {
  newId,
  TRANSPORT_TYPES,
  type IntercityLegDraft,
  type TransportLegDraft,
  type TransportProductKind,
  type TransportType,
} from "@/lib/host/wizard/types";

type LegBucket = "outbound" | "return" | "intercity";
type BillingChoice = "single" | "package" | "existing" | "new";

const chipOn = "bg-violet-600 text-white";
const chipOff = "bg-zinc-100 text-zinc-800 hover:bg-zinc-200";
const fieldClass =
  "h-9 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-sm text-zinc-900";

const TRANSPORT_LABELS: Record<TransportType, string> = {
  unsure: "Unsure",
  plane: "Plane",
  train: "Train",
  bus: "Bus",
  coach: "Coach",
  ferry: "Ferry",
  car: "Car",
  taxi: "Taxi / shuttle",
  walking: "Walking",
  other: "Other",
};

function defaultProductKind(leg: TransportLegDraft): TransportProductKind {
  if (leg.transportType === "plane") return "flight_package";
  if (leg.transportType === "bus") return "bus_pass";
  if (leg.transportType === "train") return "train_pass";
  return "ic_card";
}

function shortLegOption(
  leg: TransportLegDraft | IntercityLegDraft,
  graph: TripEntityGraph,
): string {
  const route = legRouteLabel(leg, graph);
  return `${route} · ${leg.travelDate}`;
}

export function EditTransportLegModal(props: {
  open: boolean;
  leg: TransportLegDraft | IntercityLegDraft | null;
  bucket: LegBucket | null;
  graph: TripEntityGraph;
  groupId: string;
  groupedLegTargets?: TransportLegGroupedTarget[];
  rosterSummary?: RosterSummary;
  saving?: boolean;
  onClose: () => void;
  onDispatch: (commands: TripCommand[]) => Promise<boolean>;
}) {
  const roster = props.rosterSummary ?? { participants: [], groups: [], rooms: [] };
  const products = props.graph.transportProducts ?? [];
  const wasOpenRef = useRef(false);
  const groupedLegTargetsRef = useRef<TransportLegGroupedTarget[] | undefined>(undefined);
  const isGroupedEdit = Boolean(
    (groupedLegTargetsRef.current ?? props.groupedLegTargets)?.length,
  );
  const isMainGroup = props.groupId === props.graph.mainGroupId && !isGroupedEdit;

  const [draft, setDraft] = useState<TransportLegDraft | IntercityLegDraft | null>(null);
  const [flightRole, setFlightRole] = useState<LegBucket>("intercity");
  const [billingChoice, setBillingChoice] = useState<BillingChoice>("single");
  const [productId, setProductId] = useState("");
  const [packageTarget, setPackageTarget] = useState<"new" | string>("new");
  const [pairedLegId, setPairedLegId] = useState("");
  const [newProductName, setNewProductName] = useState("Return flights");
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);

  const travellerOptions = useMemo(
    () =>
      roster.participants
        .map((participant) => {
          const groupId = personalGroupIdForParticipant(props.graph, participant.id);
          if (!groupId) return null;
          return { participantId: participant.id, groupId, name: participant.fullName };
        })
        .filter((row): row is { participantId: string; groupId: string; name: string } =>
          Boolean(row),
        ),
    [props.graph, roster.participants],
  );

  const isPlane = draft?.transportType === "plane";
  const showFlightRole = Boolean(isPlane && isMainGroup);

  const passProducts = useMemo(
    () => products.filter((product) => product.kind !== "flight_package"),
    [products],
  );
  const flightPackages = useMemo(
    () => products.filter((product) => product.kind === "flight_package"),
    [products],
  );

  const pairCandidates = useMemo(
    () => (draft ? flightPackagePairCandidates(props.graph, draft) : []),
    [props.graph, draft],
  );

  useEffect(() => {
    if (!props.open) {
      wasOpenRef.current = false;
      groupedLegTargetsRef.current = undefined;
      return;
    }
    if (!props.leg || !props.bucket) return;

    const opening = !wasOpenRef.current;
    wasOpenRef.current = true;
    if (opening) {
      groupedLegTargetsRef.current = props.groupedLegTargets;
    }

    setDraft({ ...props.leg });
    setFlightRole(props.bucket);
    if (opening) {
      setSelectedGroupIds(
        groupedLegTargetsRef.current?.map((target) => target.groupId) ?? [props.groupId],
      );
    }
    const kind = defaultProductKind(props.leg);
    setNewProductName(
      kind === "flight_package" ? "Return flights" : transportProductKindLabel(kind),
    );

    if (props.leg.transportProductId) {
      const product = products.find((row) => row.id === props.leg!.transportProductId);
      if (product?.kind === "flight_package") {
        setBillingChoice("package");
        setPackageTarget(props.leg.transportProductId);
        const siblings = legsForTransportProduct(props.graph, props.leg.transportProductId).filter(
          (id) => id !== props.leg!.id,
        );
        setPairedLegId(siblings[0] ?? defaultPairedLegId(props.graph, props.leg));
      } else {
        setBillingChoice("existing");
        setProductId(props.leg.transportProductId);
        setPackageTarget("new");
        setPairedLegId("");
      }
    } else {
      setBillingChoice("single");
      setProductId("");
      setPackageTarget(flightPackages[0]?.id ?? "new");
      setPairedLegId(defaultPairedLegId(props.graph, props.leg));
    }
  }, [props.open, props.leg, props.bucket, props.graph, products, flightPackages, props.groupId, props.groupedLegTargets]);

  if (!props.open || !draft || !props.bucket) return null;

  const groupedLegTargets = groupedLegTargetsRef.current ?? props.groupedLegTargets;

  const tripLookup = { state: graphToSetupState(props.graph) };
  const routeTitle = legRouteLabel(draft, props.graph);
  const removeTargetCount = props.groupedLegTargets?.length ?? 1;
  const removeConfirmTitle =
    removeTargetCount > 1 ?
      `Remove ${routeTitle} for ${removeTargetCount} travellers?`
    : `Remove ${routeTitle}?`;
  const removeConfirmDescription =
    removeTargetCount > 1 ?
      "These legs will reappear in From your calendar so you can add them again."
    : "It will reappear in From your calendar so you can add it again.";

  function toggleTraveller(groupId: string) {
    setSelectedGroupIds((current) =>
      current.includes(groupId)
        ? current.filter((id) => id !== groupId)
        : [...current, groupId],
    );
  }

  function changeTransportType(transportType: TransportType) {
    setDraft((prev) => {
      if (!prev) return prev;
      const next: TransportLegDraft | IntercityLegDraft = { ...prev, transportType };
      if (transportType === "plane" && prev.transportType !== "plane") {
        next.transportProductId = null;
        next.billingMode = "single";
      } else if (transportType !== "plane" && prev.transportType === "plane") {
        next.transportProductId = null;
        next.billingMode = "single";
        next.flightNumber = null;
        next.arrivalDate = null;
      } else if (
        transportType === "train" &&
        prev.transportType !== "train" &&
        prev.transportProductId
      ) {
        const product = products.find((row) => row.id === prev.transportProductId);
        if (product && product.kind === "flight_package") {
          next.transportProductId = null;
          next.billingMode = "single";
        }
      }
      return next;
    });
    if (transportType === "plane") {
      setBillingChoice("single");
      setProductId("");
    } else if (transportType === "train") {
      setBillingChoice("single");
    }
  }

  async function dispatchAndWait(commands: TripCommand[]): Promise<boolean> {
    const dispatched = await props.onDispatch(commands);
    if (!dispatched) return false;
    await waitForTripPersist(props.graph.tripId);
    if (lastTripPersistSucceeded(props.graph.tripId) === false) {
      window.alert("Could not save that change. Your edits are kept on this device — try again.");
      return false;
    }
    return true;
  }

  function selectFlightPackage() {
    setBillingChoice("package");
    if (!pairedLegId) {
      setPairedLegId(defaultPairedLegId(props.graph, draft!));
    }
    if (packageTarget === "new" && flightPackages.length === 1) {
      setPackageTarget(flightPackages[0]!.id);
    }
  }

  function resolveBillingForSave(): {
    commands: TripCommand[];
    transportProductId: string | null;
    billingMode: "single" | "product";
  } {
    const commands: TripCommand[] = [];
    let transportProductId: string | null = null;
    let billingMode: "single" | "product" = "single";

    if (billingChoice === "package" && isPlane) {
      if (packageTarget === "new") {
        transportProductId = newId();
        commands.push({
          type: "addTransportProduct",
          product: {
            id: transportProductId,
            kind: "flight_package",
            name: newProductName.trim() || "Return flights",
            participantIds: [],
          },
        });
      } else {
        transportProductId = packageTarget;
      }
      billingMode = "product";
    } else if (billingChoice === "new") {
      transportProductId = newId();
      const kind = defaultProductKind(draft!);
      commands.push({
        type: "addTransportProduct",
        product: {
          id: transportProductId,
          kind,
          name: newProductName.trim() || transportProductKindLabel(kind),
          participantIds: [],
        },
      });
      billingMode = "product";
    } else if (billingChoice === "existing" && productId) {
      transportProductId = productId;
      billingMode = "product";
    }

    return { commands, transportProductId, billingMode };
  }

  function draftWithBilling(
    billing: ReturnType<typeof resolveBillingForSave>,
  ): TransportLegDraft | IntercityLegDraft {
    return {
      ...draft!,
      transportProductId: billing.transportProductId,
      billingMode: billing.billingMode,
    };
  }

  async function removeLeg() {
    if (!draft || !props.bucket) return;
    const commands: TripCommand[] = props.groupedLegTargets?.length
      ? props.groupedLegTargets.map((target) => ({
          type: "removeTransportLeg" as const,
          groupId: target.groupId,
          bucket: props.bucket!,
          legId: target.legId,
        }))
      : [
          {
            type: "removeTransportLeg",
            groupId: props.groupId,
            bucket: props.bucket,
            legId: draft.id,
          },
        ];
    const ok = await dispatchAndWait(commands);
    if (ok) {
      setRemoveConfirmOpen(false);
      props.onClose();
    }
  }

  async function save() {
    if (!draft || !props.bucket) return;

    if (isGroupedEdit && groupedLegTargets?.length) {
      if (!selectedGroupIds.length) {
        window.alert("Choose at least one traveller for this leg.");
        return;
      }
      const billing = resolveBillingForSave();
      const ok = await dispatchAndWait([
        ...billing.commands,
        ...buildGroupedTransportLegCommands({
          draft: draftWithBilling(billing),
          bucket: props.bucket,
          groupedLegTargets,
          selectedGroupIds,
        }),
      ]);
      if (ok) props.onClose();
      return;
    }

    const billing = resolveBillingForSave();
    const commands: TripCommand[] = [...billing.commands];
    const patch: Partial<IntercityLegDraft> = {
      ...draftWithBilling(billing),
    };

    if ("intercityFromCity" in draft) {
      const ic = draft as IntercityLegDraft;
      patch.intercityFromCity = ic.intercityFromCity || draft.fromCity;
      patch.intercityToCity = ic.intercityToCity || draft.toCity;
    }

    const targetBucket = showFlightRole ? flightRole : props.bucket;
    commands.push({
      type: "updateTransportLeg",
      groupId: props.groupId,
      bucket: props.bucket,
      legId: draft.id,
      patch,
      targetBucket: targetBucket !== props.bucket ? targetBucket : undefined,
    });

    if (billingChoice === "package" && isPlane && billing.transportProductId && pairedLegId) {
      const paired = findLegPlacement(props.graph, pairedLegId);
      if (paired && paired.leg.id !== draft.id) {
        commands.push({
          type: "updateTransportLeg",
          groupId: props.groupId,
          bucket: paired.bucket,
          legId: pairedLegId,
          patch: {
            transportProductId: billing.transportProductId,
            billingMode: "product",
          },
        });
      }
    }

    const ok = await dispatchAndWait(commands);
    if (ok) props.onClose();
  }

  const showPassBilling = !isPlane;
  const showFlightBilling = !isGroupedEdit && isPlane;
  const packageNeedsPair = billingChoice === "package" && isPlane && packageTarget === "new";
  const saveDisabled =
    props.saving ||
    (isGroupedEdit && !selectedGroupIds.length) ||
    (billingChoice === "existing" && !productId) ||
    (packageNeedsPair && !pairedLegId);

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal
        className="w-full max-w-2xl rounded-2xl bg-white p-5 text-zinc-900 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-100 pb-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-zinc-900">{routeTitle}</h3>
            <p className="text-xs text-zinc-500">
              {isGroupedEdit ? "Edit route, billing, and travellers" : "Edit transport"}
            </p>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className="shrink-0 text-sm text-zinc-500 hover:text-zinc-800"
          >
            Close
          </button>
        </div>

        <div className="mt-3 space-y-3">
          {isGroupedEdit ? (
            <div className="rounded-xl bg-violet-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-800">
                Travellers on this leg
              </p>
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                {travellerOptions.map((traveller) => (
                  <li key={traveller.groupId}>
                    <label className="flex items-center gap-2 text-sm text-zinc-800">
                      <input
                        type="checkbox"
                        checked={selectedGroupIds.includes(traveller.groupId)}
                        onChange={() => toggleTraveller(traveller.groupId)}
                      />
                      {traveller.name}
                    </label>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-violet-900/80">
                Tick everyone who shares this booking. Unticking removes their personal copy of
                the leg.
              </p>
            </div>
          ) : null}

          {showPassBilling || showFlightBilling ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {showFlightRole ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      ["outbound", "Outbound"],
                      ["return", "Return"],
                      ["intercity", "Between cities"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFlightRole(value)}
                      className={[
                        "rounded-full px-2.5 py-1 text-xs font-medium",
                        flightRole === value ? chipOn : chipOff,
                      ].join(" ")}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setBillingChoice("single")}
                  className={[
                    "rounded-full px-2.5 py-1 text-xs font-medium",
                    billingChoice === "single" ? chipOn : chipOff,
                  ].join(" ")}
                >
                  Single
                </button>
                {isPlane ? (
                  <button
                    type="button"
                    onClick={selectFlightPackage}
                    className={[
                      "rounded-full px-2.5 py-1 text-xs font-medium",
                      billingChoice === "package" ? chipOn : chipOff,
                    ].join(" ")}
                  >
                    Return package
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setBillingChoice("existing")}
                      disabled={!passProducts.length}
                      className={[
                        "rounded-full px-2.5 py-1 text-xs font-medium disabled:opacity-40",
                        billingChoice === "existing" ? chipOn : chipOff,
                      ].join(" ")}
                    >
                      Pass
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingChoice("new")}
                      className={[
                        "rounded-full px-2.5 py-1 text-xs font-medium",
                        billingChoice === "new" ? chipOn : chipOff,
                      ].join(" ")}
                    >
                      New pass
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : null}

          {!isGroupedEdit && billingChoice === "package" && isPlane ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block text-xs text-zinc-600">
                <span className="mb-1 block font-medium text-zinc-800">With flight</span>
                <select
                  value={pairedLegId}
                  onChange={(e) => setPairedLegId(e.target.value)}
                  className={fieldClass}
                >
                  <option value="">Choose…</option>
                  {pairCandidates.map(({ leg }) => (
                    <option key={leg.id} value={leg.id}>
                      {shortLegOption(leg, props.graph)}
                    </option>
                  ))}
                </select>
              </label>
              {flightPackages.length ? (
                <label className="block text-xs text-zinc-600">
                  <span className="mb-1 block font-medium text-zinc-800">Package</span>
                  <select
                    value={packageTarget}
                    onChange={(e) => setPackageTarget(e.target.value as "new" | string)}
                    className={fieldClass}
                  >
                    <option value="new">New package</option>
                    {flightPackages.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="block text-xs text-zinc-600">
                  <span className="mb-1 block font-medium text-zinc-800">Finance name</span>
                  <input
                    value={newProductName}
                    onChange={(e) => setNewProductName(e.target.value)}
                    className={fieldClass}
                    placeholder="Return flights"
                  />
                </label>
              )}
            </div>
          ) : null}

          {!isGroupedEdit && billingChoice === "package" && isPlane && flightPackages.length && packageTarget === "new" ? (
            <label className="block text-xs text-zinc-600">
              <span className="mb-1 block font-medium text-zinc-800">Finance name</span>
              <input
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                className={fieldClass}
                placeholder="Return flights"
              />
            </label>
          ) : null}

          {billingChoice === "existing" && !isPlane ? (
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className={fieldClass}
            >
              <option value="">Choose pass…</option>
              {passProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          ) : null}

          {billingChoice === "new" && !isPlane ? (
            <input
              value={newProductName}
              onChange={(e) => setNewProductName(e.target.value)}
              className={fieldClass}
              placeholder="e.g. JR Pass"
            />
          ) : null}

          <label className="block text-xs text-zinc-600">
            <span className="mb-1 block font-medium text-zinc-800">Transport type</span>
            <select
              value={draft.transportType}
              onChange={(e) => changeTransportType(e.target.value as TransportType)}
              className={fieldClass}
            >
              {TRANSPORT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {TRANSPORT_LABELS[type]}
                </option>
              ))}
            </select>
          </label>

          <TransportLegForm
            leg={draft}
            legTitle={routeTitle}
            countryNames={props.graph.basics.destinationCountries}
            roster={roster}
            tripLookup={tripLookup}
            compact
            hideHeader
            onChange={(next) => {
              setDraft((prev) => {
                if (!prev) return next;
                if ("intercityFromCity" in prev) {
                  return {
                    ...next,
                    intercityFromCity: prev.intercityFromCity,
                    intercityToCity: prev.intercityToCity,
                    originGroupId: prev.originGroupId,
                  };
                }
                return next;
              });
            }}
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-zinc-100 pt-3">
          <button
            type="button"
            disabled={props.saving}
            onClick={() => setRemoveConfirmOpen(true)}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Delete
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={props.onClose}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saveDisabled}
              onClick={() => void save()}
              className="rounded-lg bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-300"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>

    <TripConfirmModal
      open={removeConfirmOpen}
      eyebrow="Transport"
      title={removeConfirmTitle}
      description={removeConfirmDescription}
      tone="danger"
      confirmLabel="Remove"
      confirmLoading={props.saving}
      onCancel={() => setRemoveConfirmOpen(false)}
      onConfirm={() => void removeLeg()}
    />
    </>
  );
}
