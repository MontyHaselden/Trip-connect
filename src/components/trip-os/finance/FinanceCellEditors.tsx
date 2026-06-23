"use client";

import { useEffect, useState } from "react";

import type { CostAllocationRuleType, CostLineItemDraft } from "@/lib/trip-engine/cost-ledger/types";
import { allocationRuleLabel } from "@/lib/trip-engine/cost-ledger/display-utils";
import { isManualFinanceLine } from "@/lib/trip-engine/cost-ledger/finance-sections";
import type { RosterSummary } from "@/lib/trip-engine/types";

import type { CostLineFormValues } from "../costs/CostLineDrawer";
import { FinanceCellPopover, popoverOptionClass } from "./FinanceCellPopover";
import { FinanceInlineMoneyCell } from "./FinanceInlineMoneyCell";

const RULE_OPTIONS: { value: CostAllocationRuleType; label: string }[] = [
  { value: "equal_cost_participants", label: "Equal split" },
  { value: "equal_group", label: "Equal ÷ group" },
  { value: "assign_one", label: "Assign to one person" },
  { value: "manual", label: "Manual" },
];

type OpenCell = { lineId: string; field: string } | null;

function cellButtonClass(active: boolean): string {
  return [
    "w-full rounded px-1.5 py-1 text-left transition hover:bg-sky-100/80",
    active ? "bg-sky-100 ring-1 ring-sky-300" : "",
  ].join(" ");
}

export function FinanceRuleCell(props: {
  line: CostLineItemDraft;
  roster: RosterSummary;
  openCell: OpenCell;
  setOpenCell: (cell: OpenCell) => void;
  onPatch: (lineId: string, patch: Partial<CostLineFormValues>) => void;
}) {
  const open = props.openCell?.lineId === props.line.id && props.openCell.field === "rule";
  const label = allocationRuleLabel(
    props.line.allocationRuleType,
    props.line.allocationRulePayload,
    props.roster,
  );

  function selectRule(ruleType: CostAllocationRuleType) {
    const patch: Partial<CostLineFormValues> = { allocationRuleType: ruleType };
    if (ruleType === "equal_group" && !props.line.allocationRulePayload.groupId) {
      const firstGroup = props.roster.groups[0]?.id ?? "";
      if (!firstGroup) return;
      patch.groupId = firstGroup;
    }
    if (ruleType === "assign_one" && !props.line.allocationRulePayload.participantId) {
      const first = props.roster.participants.find((p) => p.inCostSplit)?.id ?? "";
      if (!first) return;
      patch.participantId = first;
    }
    props.onPatch(props.line.id, patch);
    if (ruleType !== "equal_group" && ruleType !== "assign_one") {
      props.setOpenCell(null);
    }
  }

  return (
    <FinanceCellPopover
      open={open}
      onClose={() => props.setOpenCell(null)}
      minWidth="12rem"
      trigger={
        <button
          type="button"
          className={cellButtonClass(open)}
          onClick={(e) => {
            e.stopPropagation();
            props.setOpenCell(open ? null : { lineId: props.line.id, field: "rule" });
          }}
        >
          {label}
        </button>
      }
    >
      {RULE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={popoverOptionClass(props.line.allocationRuleType === opt.value)}
          onClick={() => selectRule(opt.value)}
        >
          {opt.label}
        </button>
      ))}
      {props.line.allocationRuleType === "equal_group" ? (
        <div className="border-t border-zinc-100 px-2 py-1.5">
          <p className="mb-1 text-[10px] font-medium text-zinc-500">Group</p>
          {props.roster.groups.map((g) => (
            <button
              key={g.id}
              type="button"
              className={popoverOptionClass(
                props.line.allocationRulePayload.groupId === g.id,
              )}
              onClick={() => {
                props.onPatch(props.line.id, { groupId: g.id, allocationRuleType: "equal_group" });
                props.setOpenCell(null);
              }}
            >
              {g.name}
            </button>
          ))}
        </div>
      ) : null}
      {props.line.allocationRuleType === "assign_one" ? (
        <div className="border-t border-zinc-100 px-2 py-1.5">
          <p className="mb-1 text-[10px] font-medium text-zinc-500">Person</p>
          {props.roster.participants
            .filter((p) => p.inCostSplit)
            .map((p) => (
              <button
                key={p.id}
                type="button"
                className={popoverOptionClass(
                  props.line.allocationRulePayload.participantId === p.id,
                )}
                onClick={() => {
                  props.onPatch(props.line.id, {
                    participantId: p.id,
                    allocationRuleType: "assign_one",
                  });
                  props.setOpenCell(null);
                }}
              >
                {p.fullName}
              </button>
            ))}
        </div>
      ) : null}
    </FinanceCellPopover>
  );
}

export function FinanceAmountCell(props: {
  line: CostLineItemDraft;
  displaySecondary?: string;
  onPatch: (lineId: string, patch: Partial<CostLineFormValues>) => void;
}) {
  return (
    <div>
      <FinanceInlineMoneyCell
        valueCents={props.line.totalAmountCents > 0 ? props.line.totalAmountCents : null}
        currency={props.line.currency}
        showCurrencyCode
        onCommit={(cents) => {
          props.onPatch(props.line.id, {
            totalAmountCents: cents ?? 0,
          });
        }}
        onCurrencyChange={(currency) => {
          props.onPatch(props.line.id, { currency: currency.toUpperCase() });
        }}
      />
      {props.displaySecondary ? (
        <div className="text-[9px] text-zinc-500">{props.displaySecondary}</div>
      ) : null}
    </div>
  );
}

export function FinanceQtyCell(props: {
  line: CostLineItemDraft;
  openCell: OpenCell;
  setOpenCell: (cell: OpenCell) => void;
  onPatch: (lineId: string, patch: Partial<CostLineFormValues>) => void;
}) {
  const open = props.openCell?.lineId === props.line.id && props.openCell.field === "qty";
  const [qtyInput, setQtyInput] = useState("");

  function openEditor() {
    setQtyInput(props.line.quantity != null ? String(props.line.quantity) : "");
    props.setOpenCell({ lineId: props.line.id, field: "qty" });
  }

  function save() {
    const trimmed = qtyInput.trim();
    props.onPatch(props.line.id, {
      quantity: trimmed ? Number.parseFloat(trimmed) : null,
    });
    props.setOpenCell(null);
  }

  return (
    <FinanceCellPopover
      open={open}
      onClose={() => props.setOpenCell(null)}
      minWidth="8rem"
      trigger={
        <button
          type="button"
          className={[cellButtonClass(open), "text-center"].join(" ")}
          onClick={(e) => {
            e.stopPropagation();
            if (open) props.setOpenCell(null);
            else openEditor();
          }}
        >
          {props.line.quantity ?? "—"}
        </button>
      }
    >
      <div className="px-2 py-2">
        <input
          autoFocus
          value={qtyInput}
          onChange={(e) => setQtyInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") props.setOpenCell(null);
          }}
          placeholder="Qty"
          className="w-full rounded border border-zinc-200 px-2 py-1 text-[11px] text-center"
        />
        <button
          type="button"
          onClick={save}
          className="mt-2 w-full rounded bg-violet-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-violet-700"
        >
          Apply
        </button>
      </div>
    </FinanceCellPopover>
  );
}

export function FinanceDescriptionCell(props: {
  line: CostLineItemDraft;
  openCell: OpenCell;
  setOpenCell: (cell: OpenCell) => void;
  onPatch: (lineId: string, patch: Partial<CostLineFormValues>) => void;
}) {
  const open =
    props.openCell?.lineId === props.line.id && props.openCell.field === "description";
  const [text, setText] = useState(props.line.description);

  useEffect(() => {
    if (!open) setText(props.line.description);
  }, [props.line.description, open]);

  function save(nextText?: string) {
    const trimmed = (nextText ?? text).trim();
    if (!trimmed) return;
    if (trimmed === props.line.description) return;
    props.onPatch(props.line.id, { description: trimmed });
    props.setOpenCell(null);
  }

  if (isManualFinanceLine(props.line)) {
    return (
      <input
        type="text"
        value={text}
        placeholder="Name this line…"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => save()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save();
            (e.target as HTMLInputElement).blur();
          }
        }}
        onClick={(e) => e.stopPropagation()}
        className="w-full min-w-[10rem] rounded border border-transparent bg-transparent px-1 py-0.5 text-xs font-medium text-zinc-800 outline-none hover:border-zinc-200 focus:border-sky-300 focus:bg-white"
        data-finance-cell
      />
    );
  }

  function openEditor() {
    setText(props.line.description);
    props.setOpenCell({ lineId: props.line.id, field: "description" });
  }

  return (
    <FinanceCellPopover
      open={open}
      onClose={() => props.setOpenCell(null)}
      minWidth="14rem"
      trigger={
        <button
          type="button"
          className={[cellButtonClass(open), "font-medium"].join(" ")}
          onClick={(e) => {
            e.stopPropagation();
            if (open) props.setOpenCell(null);
            else openEditor();
          }}
        >
          <span className="whitespace-nowrap text-left" title={props.line.description}>
            {props.line.description}
          </span>
        </button>
      }
    >
      <div className="px-2 py-2">
        <textarea
          autoFocus
          value={text}
          rows={2}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              save();
            }
            if (e.key === "Escape") props.setOpenCell(null);
          }}
          className="w-full rounded border border-zinc-200 px-2 py-1 text-[11px]"
        />
        <button
          type="button"
          onClick={() => save()}
          className="mt-2 w-full rounded bg-violet-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-violet-700"
        >
          Apply
        </button>
      </div>
    </FinanceCellPopover>
  );
}

export type { OpenCell };

export function FinanceParticipantAmountCell(props: {
  amountCents: number | null;
  currency: string;
  isPinned: boolean;
  disabled?: boolean;
  onSave: (amountCents: number | null) => void;
}) {
  return (
    <FinanceInlineMoneyCell
      valueCents={props.amountCents}
      currency={props.currency}
      isPinned={props.isPinned}
      disabled={props.disabled}
      allowClear
      onCommit={props.onSave}
    />
  );
}
