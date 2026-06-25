"use client";

import { useEffect, useMemo, useState } from "react";

import { TransportLegForm } from "@/components/host/wizard/shared/TransportLegForm";
import { legsForTransportProduct } from "@/lib/host/locations/transport-products";
import { graphToSetupState } from "@/lib/trip-engine/adapters";
import type { TripCommand } from "@/lib/trip-engine/commands";
import {
  defaultPairedLegId,
  flightPackagePairCandidates,
  legRouteLabel,
  findLegPlacement,
} from "@/lib/trip-engine/flight-package-pairs";
import type { TripEntityGraph, RosterSummary } from "@/lib/trip-engine/types";
import { transportProductKindLabel } from "@/lib/trip-engine/transport-product-defaults";
import {
  newId,
  type IntercityLegDraft,
  type TransportLegDraft,
  type TransportProductKind,
} from "@/lib/host/wizard/types";

type LegBucket = "outbound" | "return" | "intercity";
type BillingChoice = "single" | "package" | "existing" | "new";

const chipOn = "bg-violet-600 text-white";
const chipOff = "bg-zinc-100 text-zinc-800 hover:bg-zinc-200";
const fieldClass =
  "h-9 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-sm text-zinc-900";

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
  rosterSummary?: RosterSummary;
  saving?: boolean;
  onClose: () => void;
  onDispatch: (commands: TripCommand[]) => Promise<boolean>;
}) {
  const roster = props.rosterSummary ?? { participants: [], groups: [], rooms: [] };
  const products = props.graph.transportProducts ?? [];
  const isMainGroup = props.groupId === props.graph.mainGroupId;

  const [draft, setDraft] = useState<TransportLegDraft | IntercityLegDraft | null>(null);
  const [flightRole, setFlightRole] = useState<LegBucket>("intercity");
  const [billingChoice, setBillingChoice] = useState<BillingChoice>("single");
  const [productId, setProductId] = useState("");
  const [packageTarget, setPackageTarget] = useState<"new" | string>("new");
  const [pairedLegId, setPairedLegId] = useState("");
  const [newProductName, setNewProductName] = useState("Return flights");

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
    if (!props.open || !props.leg || !props.bucket) return;
    setDraft({ ...props.leg });
    setFlightRole(props.bucket);
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
  }, [props.open, props.leg, props.bucket, props.graph, products, flightPackages]);

  if (!props.open || !draft || !props.bucket) return null;

  const tripLookup = { state: graphToSetupState(props.graph) };
  const routeTitle = legRouteLabel(draft, props.graph);

  function selectFlightPackage() {
    setBillingChoice("package");
    if (!pairedLegId) {
      setPairedLegId(defaultPairedLegId(props.graph, draft!));
    }
    if (packageTarget === "new" && flightPackages.length === 1) {
      setPackageTarget(flightPackages[0]!.id);
    }
  }

  async function save() {
    if (!draft || !props.bucket) return;
    const commands: TripCommand[] = [];
    let nextProductId: string | null = null;
    let billingMode: "single" | "product" = "single";

    if (billingChoice === "package" && isPlane) {
      if (packageTarget === "new") {
        nextProductId = newId();
        commands.push({
          type: "addTransportProduct",
          product: {
            id: nextProductId,
            kind: "flight_package",
            name: newProductName.trim() || "Return flights",
            participantIds: [],
          },
        });
      } else {
        nextProductId = packageTarget;
      }
      billingMode = "product";
    } else if (billingChoice === "new") {
      nextProductId = newId();
      const kind = defaultProductKind(draft);
      commands.push({
        type: "addTransportProduct",
        product: {
          id: nextProductId,
          kind,
          name: newProductName.trim() || transportProductKindLabel(kind),
          participantIds: [],
        },
      });
      billingMode = "product";
    } else if (billingChoice === "existing" && productId) {
      nextProductId = productId;
      billingMode = "product";
    }

    const patch: Partial<TransportLegDraft> = {
      ...draft,
      transportProductId: nextProductId,
      billingMode,
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

    if (billingChoice === "package" && isPlane && nextProductId && pairedLegId) {
      const paired = findLegPlacement(props.graph, pairedLegId);
      if (paired && paired.leg.id !== draft.id) {
        commands.push({
          type: "updateTransportLeg",
          groupId: props.groupId,
          bucket: paired.bucket,
          legId: pairedLegId,
          patch: {
            transportProductId: nextProductId,
            billingMode: "product",
          },
        });
      }
    }

    const ok = await props.onDispatch(commands);
    if (ok) props.onClose();
  }

  const packageNeedsPair = billingChoice === "package" && isPlane && packageTarget === "new";
  const saveDisabled =
    props.saving ||
    (billingChoice === "existing" && !productId) ||
    (packageNeedsPair && !pairedLegId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal
        className="w-full max-w-2xl rounded-2xl bg-white p-5 text-zinc-900 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-100 pb-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-zinc-900">{routeTitle}</h3>
            <p className="text-xs text-zinc-500">Edit transport</p>
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
          {showFlightRole || isPlane ? (
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

          {billingChoice === "package" && isPlane ? (
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

          {billingChoice === "package" && isPlane && flightPackages.length && packageTarget === "new" ? (
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

        <div className="mt-4 flex justify-end gap-2 border-t border-zinc-100 pt-3">
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
  );
}
