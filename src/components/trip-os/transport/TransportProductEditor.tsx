"use client";

import { useEffect, useState } from "react";

import type { TripCommand } from "@/lib/trip-engine/commands";
import { costSplitParticipants } from "@/lib/trip-engine/cost-ledger/allocate";
import type { RosterSummary } from "@/lib/trip-engine/types";
import type { TransportProductDraft } from "@/lib/host/wizard/types";

export function TransportProductEditor(props: {
  open: boolean;
  product: TransportProductDraft | null;
  rosterSummary?: RosterSummary;
  saving?: boolean;
  onClose: () => void;
  onDispatch: (commands: TripCommand[]) => Promise<boolean>;
}) {
  const roster = props.rosterSummary ?? { participants: [], groups: [], rooms: [] };
  const pool = costSplitParticipants(roster);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!props.product) return;
    setName(props.product.name);
    setSelected(new Set(props.product.participantIds));
  }, [props.product]);

  if (!props.open || !props.product) return null;

  const isPass = props.product.kind !== "flight_package";

  async function save() {
    const ok = await props.onDispatch([
      {
        type: "updateTransportProduct",
        productId: props.product!.id,
        patch: {
          name: name.trim() || props.product!.name,
          participantIds: isPass ? [...selected] : props.product!.participantIds,
        },
      },
    ]);
    if (ok) props.onClose();
  }

  async function removeProduct() {
    const ok = await props.onDispatch([
      { type: "removeTransportProduct", productId: props.product!.id },
    ]);
    if (ok) props.onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 text-zinc-900 shadow-xl">
        <h3 className="text-lg font-semibold text-zinc-900">Edit {props.product.name}</h3>
        <div className="mt-4 space-y-4">
          <label className="block text-sm font-medium text-zinc-800">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
            />
          </label>
          {isPass ? (
            <div>
              <p className="text-sm font-medium text-zinc-800">Participants on this pass</p>
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                {pool.map((participant) => (
                  <li key={participant.id}>
                    <label className="flex items-center gap-2 text-sm text-zinc-900">
                      <input
                        type="checkbox"
                        checked={selected.has(participant.id)}
                        onChange={() =>
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(participant.id)) next.delete(participant.id);
                            else next.add(participant.id);
                            return next;
                          })
                        }
                      />
                      {participant.fullName}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-zinc-500">
              Flight package billing uses participants on every linked leg automatically.
            </p>
          )}
        </div>
        <div className="mt-6 flex flex-wrap justify-between gap-2">
          <button
            type="button"
            onClick={() => void removeProduct()}
            className="text-sm text-red-600 hover:text-red-700"
          >
            Delete product
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={props.onClose}
              className="rounded-lg px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={props.saving}
              onClick={() => void save()}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-300"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
