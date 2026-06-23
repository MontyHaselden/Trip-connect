"use client";

import { useEffect, useMemo, useState } from "react";

import {
  COST_STATUSES,
  COST_STATUS_LABELS,
  FUNDING_STATUSES,
  FUNDING_STATUS_LABELS,
  LINE_PAYMENT_STATUSES,
  LINE_PAYMENT_STATUS_LABELS,
  TAX_TREATMENTS,
  TAX_TREATMENT_LABELS,
} from "@/lib/trip-engine/cost-ledger/finance-metadata";
import {
  outstandingCentsForLine,
  paidCentsForLine,
} from "@/lib/trip-engine/cost-ledger/finance-summary";
import { formatMoney, parseMoneyInput, centsToInputValue } from "@/lib/trip-engine/cost-ledger/format-money";
import { COST_CATEGORY_LABELS } from "@/lib/trip-engine/cost-ledger/types";
import type { CostLedgerProjection, CostLineItemDraft } from "@/lib/trip-engine/cost-ledger/types";

import {
  financeLinePatch,
  lineToFinanceFormValues,
  type FinanceLineFormValues,
} from "./finance-line-metadata-patch";

const fieldClass =
  "mt-0.5 w-full rounded border border-zinc-300 px-2 py-1 text-[11px] text-zinc-900";
const labelClass = "text-[10px] font-medium text-zinc-600";

export function FinanceRowDetailPanel(props: {
  line: CostLineItemDraft;
  ledger: CostLedgerProjection;
  open: boolean;
  onClose: () => void;
  onSave: (lineId: string, patch: Record<string, unknown>) => Promise<void>;
}) {
  const [values, setValues] = useState<FinanceLineFormValues>(() =>
    lineToFinanceFormValues(props.line),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValues(lineToFinanceFormValues(props.line));
  }, [props.line]);

  const paidCents = useMemo(
    () => paidCentsForLine(props.line.id, props.ledger.supplierPayments, props.ledger.settings),
    [props.line.id, props.ledger.supplierPayments, props.ledger.settings],
  );
  const outstandingCents = useMemo(
    () =>
      outstandingCentsForLine(props.line, props.ledger.supplierPayments, props.ledger.settings),
    [props.line, props.ledger.supplierPayments, props.ledger.settings],
  );

  if (!props.open) return null;

  async function handleSave() {
    setSaving(true);
    try {
      await props.onSave(props.line.id, financeLinePatch(values));
    } finally {
      setSaving(false);
    }
  }

  function set<K extends keyof FinanceLineFormValues>(key: K, value: FinanceLineFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const linkedLabel =
    props.line.linkedStayId != null
      ? "Accommodation stay"
      : props.line.linkedTransportLegId != null
        ? "Transport leg"
        : props.line.linkedActivityId != null
          ? "Activity"
          : "General cost";

  return (
    <>
      <button
        type="button"
        aria-label="Close panel"
        className="fixed inset-0 z-40 bg-black/20"
        onClick={props.onClose}
      />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-zinc-200 bg-white shadow-xl">
        <header className="flex shrink-0 items-start justify-between gap-2 border-b border-zinc-200 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              Cost row
            </p>
            <h2 className="truncate text-sm font-semibold text-zinc-900">{props.line.description}</h2>
            <p className="text-[10px] text-zinc-500">
              {COST_CATEGORY_LABELS[props.line.category]} · {linkedLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className="rounded border border-zinc-300 px-2 py-1 text-[10px] text-zinc-600 hover:bg-zinc-50"
          >
            Close
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
          <Section title="Basic">
            <Field label="Title">
              <input
                value={values.description}
                onChange={(e) => set("description", e.target.value)}
                className={fieldClass}
              />
            </Field>
            <Field label="Supplier">
              <input
                value={values.supplierName}
                onChange={(e) => set("supplierName", e.target.value)}
                className={fieldClass}
                placeholder="Supplier name"
              />
            </Field>
            <Field label="Notes">
              <textarea
                value={values.notes}
                onChange={(e) => set("notes", e.target.value)}
                rows={2}
                className={fieldClass}
              />
            </Field>
          </Section>

          <Section title="Cost">
            <p className="text-[10px] text-zinc-500">
              Line total: {formatMoney(props.line.totalAmountCents, props.line.currency)}
              {props.line.quantity != null ? ` · qty ${props.line.quantity}` : ""}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Estimated">
                <input
                  value={
                    values.estimatedAmountCents != null
                      ? centsToInputValue(values.estimatedAmountCents, props.line.currency)
                      : ""
                  }
                  onChange={(e) =>
                    set(
                      "estimatedAmountCents",
                      e.target.value.trim() ? parseMoneyInput(e.target.value) : null,
                    )
                  }
                  placeholder="0.00"
                  className={fieldClass}
                />
              </Field>
              <Field label="Actual">
                <input
                  value={
                    values.actualAmountCents != null
                      ? centsToInputValue(values.actualAmountCents, props.line.currency)
                      : ""
                  }
                  onChange={(e) =>
                    set(
                      "actualAmountCents",
                      e.target.value.trim() ? parseMoneyInput(e.target.value) : null,
                    )
                  }
                  placeholder="0.00"
                  className={fieldClass}
                />
              </Field>
            </div>
            <p className="text-[10px] text-zinc-500">
              Paid to supplier: {formatMoney(paidCents, props.ledger.settings.baseCurrency)} ·
              Outstanding: {formatMoney(outstandingCents, props.ledger.settings.baseCurrency)}
            </p>
          </Section>

          <Section title="Status">
            <Field label="Cost status">
              <select
                value={values.costStatus}
                onChange={(e) => set("costStatus", e.target.value as FinanceLineFormValues["costStatus"])}
                className={fieldClass}
              >
                {COST_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {COST_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Payment status">
              <select
                value={values.linePaymentStatus}
                onChange={(e) =>
                  set("linePaymentStatus", e.target.value as FinanceLineFormValues["linePaymentStatus"])
                }
                className={fieldClass}
              >
                {LINE_PAYMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {LINE_PAYMENT_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Funding status">
              <select
                value={values.fundingStatus}
                onChange={(e) =>
                  set("fundingStatus", e.target.value as FinanceLineFormValues["fundingStatus"])
                }
                className={fieldClass}
              >
                {FUNDING_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {FUNDING_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex flex-wrap gap-3 pt-1">
              <label className="flex items-center gap-1.5 text-[10px] text-zinc-700">
                <input
                  type="checkbox"
                  checked={values.invoiceRecorded}
                  onChange={(e) => set("invoiceRecorded", e.target.checked)}
                />
                Invoice recorded
              </label>
              <label className="flex items-center gap-1.5 text-[10px] text-zinc-700">
                <input
                  type="checkbox"
                  checked={values.receiptRecorded}
                  onChange={(e) => set("receiptRecorded", e.target.checked)}
                />
                Receipt recorded
              </label>
            </div>
          </Section>

          <Section title="Export / Xero helpers">
            <Field label="Tax treatment">
              <select
                value={values.taxTreatment}
                onChange={(e) =>
                  set("taxTreatment", e.target.value as FinanceLineFormValues["taxTreatment"])
                }
                className={fieldClass}
              >
                {TAX_TREATMENTS.map((s) => (
                  <option key={s} value={s}>
                    {TAX_TREATMENT_LABELS[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Export category label">
              <input
                value={values.exportCategoryLabel}
                onChange={(e) => set("exportCategoryLabel", e.target.value)}
                className={fieldClass}
              />
            </Field>
            <Field label="Export reference">
              <input
                value={values.exportReference}
                onChange={(e) => set("exportReference", e.target.value)}
                className={fieldClass}
              />
            </Field>
            <Field label="Booking reference">
              <input
                value={values.bookingReference}
                onChange={(e) => set("bookingReference", e.target.value)}
                className={fieldClass}
              />
            </Field>
          </Section>
        </div>

        <footer className="shrink-0 border-t border-zinc-200 px-4 py-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="w-full rounded border border-violet-700 bg-violet-600 py-2 text-[11px] font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save details"}
          </button>
        </footer>
      </aside>
    </>
  );
}

function Section(props: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        {props.title}
      </h3>
      <div className="mt-2 space-y-2">{props.children}</div>
    </section>
  );
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={labelClass}>{props.label}</span>
      {props.children}
    </label>
  );
}
