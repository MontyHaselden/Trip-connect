"use client";

import { useEffect, useState } from "react";

import type { CostAllocationRuleType, CostLineItemDraft } from "@/lib/trip-engine/cost-ledger/types";
import { allocationRuleLabel } from "@/lib/trip-engine/cost-ledger/display-utils";
import {
  effectiveStayNights,
} from "@/lib/trip-engine/cost-ledger/accommodation-nights";
import {
  effectiveLineQuantity,
  perUnitCents,
  quantityUnitLabel,
  totalFromUnitCents,
} from "@/lib/trip-engine/cost-ledger/line-quantity-rate";
import type { TripEntityGraph } from "@/lib/trip-engine/types";
import type { RosterSummary } from "@/lib/trip-engine/types";

import type { CostLineFormValues } from "../costs/CostLineDrawer";
import { financeLineDisplayDescription } from "@/lib/trip-engine/transport-route-label";
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
  graph?: TripEntityGraph | null;
  displayTotalCents?: number | null;
  displayCurrency?: string;
  baseCurrency?: string;
  ratesFromBase?: Record<string, number>;
  onPatch: (lineId: string, patch: Partial<CostLineFormValues>) => void;
}) {
  const quantity = effectiveLineQuantity(props.line, props.graph);
  const unitLabel = quantityUnitLabel(props.line, props.graph);
  const rowTotalCents =
    props.displayTotalCents != null && props.displayTotalCents > 0
      ? props.displayTotalCents
      : props.line.totalAmountCents;
  const perUnit =
    quantity && rowTotalCents > 0
      ? perUnitCents(rowTotalCents, quantity)
      : null;
  const showUnitRow = quantity != null && quantity > 0;
  const moneyProps = {
    currency: props.line.currency,
    displayCurrency: props.displayCurrency,
    baseCurrency: props.baseCurrency,
    ratesFromBase: props.ratesFromBase,
  };

  return (
    <div className="flex flex-col items-center justify-center gap-0.5">
      <FinanceInlineMoneyCell
        align="center"
        valueCents={rowTotalCents > 0 ? rowTotalCents : null}
        {...moneyProps}
        onCommit={(cents) => {
          props.onPatch(props.line.id, {
            totalAmountCents: cents ?? 0,
          });
        }}
      />
      {showUnitRow && perUnit != null ? (
        <div className="flex items-baseline justify-center gap-0.5 text-[9px] text-zinc-500">
          <FinanceInlineMoneyCell
            compact
            align="center"
            valueCents={perUnit}
            {...moneyProps}
            onCommit={(cents) => {
              if (!quantity || cents == null) return;
              props.onPatch(props.line.id, {
                totalAmountCents: totalFromUnitCents(cents, quantity),
              });
            }}
          />
          <span>/{unitLabel}</span>
        </div>
      ) : null}
    </div>
  );
}

export function FinanceQtyCell(props: {
  line: CostLineItemDraft;
  graph?: TripEntityGraph | null;
  openCell: OpenCell;
  setOpenCell: (cell: OpenCell) => void;
  onPatch: (lineId: string, patch: Partial<CostLineFormValues>) => void;
}) {
  const open = props.openCell?.lineId === props.line.id && props.openCell.field === "qty";
  const [qtyInput, setQtyInput] = useState("");
  const displayQty = effectiveStayNights(props.line, props.graph);
  const isStayLine = Boolean(props.line.linkedStayId);

  function openEditor() {
    setQtyInput(displayQty != null ? String(displayQty) : "");
    props.setOpenCell({ lineId: props.line.id, field: "qty" });
  }

  function save() {
    const trimmed = qtyInput.trim();
    props.onPatch(props.line.id, {
      quantity: trimmed ? Number.parseFloat(trimmed) : null,
    });
    props.setOpenCell(null);
  }

  if (isStayLine && displayQty != null && !open) {
    return (
      <div className="text-center text-xs tabular-nums text-zinc-700" title="Nights at this stay">
        {displayQty}
      </div>
    );
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
          {props.line.quantity ?? displayQty ?? "—"}
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
  graph?: TripEntityGraph | null;
  openCell: OpenCell;
  setOpenCell: (cell: OpenCell) => void;
  onPatch: (lineId: string, patch: Partial<CostLineFormValues>) => void;
}) {
  const calendarLinkedTransport = Boolean(props.line.linkedTransportLegId && props.graph);
  const displayDescription = financeLineDisplayDescription(props.line, props.graph);
  const [text, setText] = useState(displayDescription);

  useEffect(() => {
    setText(displayDescription);
  }, [displayDescription, props.line.id]);

  function save(nextText?: string) {
    if (calendarLinkedTransport) return;
    const trimmed = (nextText ?? text).trim();
    if (!trimmed) return;
    if (trimmed === props.line.description) return;
    props.onPatch(props.line.id, { description: trimmed });
    props.setOpenCell(null);
  }

  return (
    <input
      type="text"
      value={text}
      readOnly={calendarLinkedTransport}
      placeholder="New line"
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
      onFocus={(e) => {
        if (calendarLinkedTransport) return;
        e.currentTarget.select();
      }}
      className={[
        "w-full min-w-[10rem] rounded border border-transparent bg-transparent px-1 py-0.5 text-xs font-medium text-zinc-800 outline-none hover:border-zinc-200 focus:border-sky-300 focus:bg-white",
        calendarLinkedTransport ? "cursor-default text-zinc-700" : "",
      ].join(" ")}
      data-finance-cell
    />
  );
}

export function FinanceFundNameCell(props: {
  fundId: string;
  name: string;
  onSave: (name: string) => void;
}) {
  const [text, setText] = useState(props.name);

  useEffect(() => {
    setText(props.name);
  }, [props.name, props.fundId]);

  function save(nextText?: string) {
    const trimmed = (nextText ?? text).trim();
    if (!trimmed || trimmed === props.name.trim()) return;
    props.onSave(trimmed);
  }

  return (
    <input
      type="text"
      value={text}
      placeholder="New line"
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
      onFocus={(e) => e.currentTarget.select()}
      className="w-full min-w-[10rem] rounded border border-transparent bg-transparent px-1 py-0.5 text-xs font-medium text-zinc-800 outline-none hover:border-zinc-200 focus:border-sky-300 focus:bg-white"
      data-finance-cell
    />
  );
}

export type { OpenCell };

export function FinanceParticipantAmountCell(props: {
  amountCents: number | null;
  currency: string;
  isPinned: boolean;
  nightsLabel?: string | null;
  disabled?: boolean;
  displayCurrency?: string;
  baseCurrency?: string;
  ratesFromBase?: Record<string, number>;
  onSave: (amountCents: number | null) => void;
  onDraftChange?: (amountCents: number | null) => void;
  onDraftEnd?: () => void;
}) {
  return (
    <div className="flex flex-col items-end">
      <FinanceInlineMoneyCell
        valueCents={props.amountCents}
        currency={props.currency}
        displayCurrency={props.displayCurrency}
        baseCurrency={props.baseCurrency}
        ratesFromBase={props.ratesFromBase}
        isPinned={props.isPinned}
        disabled={props.disabled}
        allowClear
        onCommit={props.onSave}
        onDraftChange={props.onDraftChange}
        onDraftEnd={props.onDraftEnd}
      />
      {props.nightsLabel ? (
        <span className="mt-0.5 text-[9px] font-medium text-amber-700">{props.nightsLabel}</span>
      ) : null}
    </div>
  );
}
