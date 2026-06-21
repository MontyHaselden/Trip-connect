"use client";

import { useEffect, useState } from "react";

import type {
  CostAllocationRuleType,
  CostLineCategory,
  CostLineItemDraft,
} from "@/lib/trip-engine/cost-ledger/types";
import {
  COST_CATEGORIES,
  COST_CATEGORY_LABELS,
} from "@/lib/trip-engine/cost-ledger/types";
import type { RosterSummary } from "@/lib/trip-engine/types";
import { formatMoney, parseMoneyInput } from "@/lib/trip-engine/cost-ledger/format-money";

export type CostLineFormValues = {
  lineId?: string;
  category: CostLineCategory;
  description: string;
  notes: string;
  totalAmountCents: number;
  currency: string;
  quantity: number | null;
  allocationRuleType: CostAllocationRuleType;
  groupId: string;
  participantId: string;
};

function lineToFormValues(
  line: CostLineItemDraft | undefined,
  baseCurrency: string,
): CostLineFormValues {
  if (!line) {
    return {
      category: "accommodation",
      description: "",
      notes: "",
      totalAmountCents: 0,
      currency: baseCurrency,
      quantity: null,
      allocationRuleType: "equal_cost_participants",
      groupId: "",
      participantId: "",
    };
  }
  return {
    lineId: line.id,
    category: line.category,
    description: line.description,
    notes: line.notes ?? "",
    totalAmountCents: line.totalAmountCents,
    currency: line.currency,
    quantity: line.quantity,
    allocationRuleType: line.allocationRuleType,
    groupId: line.allocationRulePayload.groupId ?? "",
    participantId: line.allocationRulePayload.participantId ?? "",
  };
}

export function CostLineDrawer(props: {
  open: boolean;
  roster: RosterSummary;
  baseCurrency: string;
  editingLine?: CostLineItemDraft | null;
  onClose: () => void;
  onSave: (values: CostLineFormValues) => Promise<void>;
  onDelete?: (lineId: string) => Promise<void>;
}) {
  const editing = Boolean(props.editingLine);
  const [values, setValues] = useState<CostLineFormValues>(() =>
    lineToFormValues(props.editingLine ?? undefined, props.baseCurrency),
  );
  const [amountInput, setAmountInput] = useState("");
  const [quantityInput, setQuantityInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!props.open) return;
    const next = lineToFormValues(props.editingLine ?? undefined, props.baseCurrency);
    setValues(next);
    setAmountInput(
      next.totalAmountCents > 0 ? String(next.totalAmountCents / 100) : "",
    );
    setQuantityInput(next.quantity != null ? String(next.quantity) : "");
  }, [props.open, props.editingLine, props.baseCurrency]);

  if (!props.open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const qty = quantityInput.trim();
      await props.onSave({
        ...values,
        lineId: props.editingLine?.id,
        totalAmountCents: parseMoneyInput(amountInput),
        quantity: qty ? Number.parseFloat(qty) : null,
      });
      props.onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl">
        <h3 className="text-lg font-semibold text-zinc-900">
          {editing ? "Edit cost line" : "Add cost line"}
        </h3>
        {props.editingLine?.linkedStayId ||
        props.editingLine?.linkedTransportLegId ||
        props.editingLine?.linkedActivityId ? (
          <p className="mt-1 text-xs text-violet-700">Linked to trip calendar</p>
        ) : null}
        <form onSubmit={(e) => void submit(e)} className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="text-xs font-medium text-zinc-600">Category</span>
            <select
              value={values.category}
              onChange={(e) =>
                setValues((v) => ({ ...v, category: e.target.value as CostLineCategory }))
              }
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            >
              {COST_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {COST_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-xs font-medium text-zinc-600">Description</span>
            <input
              required
              value={values.description}
              onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            />
          </label>
          <div className="grid grid-cols-3 gap-3">
            <label className="block text-sm col-span-2">
              <span className="text-xs font-medium text-zinc-600">Amount</span>
              <input
                required
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="0.00"
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs font-medium text-zinc-600">Qty</span>
              <input
                value={quantityInput}
                onChange={(e) => setQuantityInput(e.target.value)}
                placeholder="—"
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-xs font-medium text-zinc-600">Currency</span>
            <input
              value={values.currency}
              onChange={(e) =>
                setValues((v) => ({ ...v, currency: e.target.value.toUpperCase() }))
              }
              maxLength={3}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm uppercase"
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs font-medium text-zinc-600">Allocation rule</span>
            <select
              value={values.allocationRuleType}
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  allocationRuleType: e.target.value as CostAllocationRuleType,
                }))
              }
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            >
              <option value="equal_cost_participants">Equal ÷ cost-split participants</option>
              <option value="equal_group">Equal ÷ group</option>
              <option value="assign_one">Assign to one person</option>
              <option value="manual">Manual</option>
            </select>
          </label>
          {values.allocationRuleType === "equal_group" ? (
            <select
              value={values.groupId}
              onChange={(e) => setValues((v) => ({ ...v, groupId: e.target.value }))}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            >
              <option value="">Select group…</option>
              {props.roster.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          ) : null}
          {values.allocationRuleType === "assign_one" ? (
            <select
              value={values.participantId}
              onChange={(e) => setValues((v) => ({ ...v, participantId: e.target.value }))}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            >
              <option value="">Select person…</option>
              {props.roster.participants
                .filter((p) => p.inCostSplit)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName}
                  </option>
                ))}
            </select>
          ) : null}
          <label className="block text-sm">
            <span className="text-xs font-medium text-zinc-600">Notes</span>
            <textarea
              value={values.notes}
              onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
              rows={2}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            />
          </label>
          <div className="flex justify-between gap-2 pt-2">
            {editing && props.onDelete && props.editingLine ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => void props.onDelete!(props.editingLine!.id)}
                className="rounded-xl px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Delete line
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={props.onClose}
                className="rounded-xl px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : editing ? "Save changes" : "Add line"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
