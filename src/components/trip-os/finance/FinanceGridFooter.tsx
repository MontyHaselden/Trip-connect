"use client";

import type { ReactNode } from "react";

import {
  effectiveStayNights,
  participantNightsForLine,
  perNightCents,
} from "@/lib/trip-engine/cost-ledger/accommodation-nights";
import {
  fundsForFinanceSection,
  fundsForOverallView,
} from "@/lib/trip-engine/cost-ledger/finance-fund-sections";
import { financeSectionFundingLabel } from "@/lib/trip-engine/cost-ledger/finance-sections";
import {
  supplierPaidCentsForLines,
  supplierPaidCentsForParticipantOnLines,
} from "@/lib/trip-engine/cost-ledger/finance-grid-totals";
import { convertToBaseCents } from "@/lib/trip-engine/cost-ledger/format-money";
import type { FinanceEntitySection } from "@/lib/trip-engine/cost-ledger/finance-sections";
import type {
  CostLedgerProjection,
  CostLineItemDraft,
  TripFundDraft,
} from "@/lib/trip-engine/cost-ledger/types";
import type { RosterSummary, TripEntityGraph } from "@/lib/trip-engine/types";
import type { buildParticipantPresenceMap } from "@/lib/trip-engine/cost-ledger/presence";

import { FinanceFundNameCell, FinanceParticipantAmountCell } from "./FinanceCellEditors";
import { FinanceInlineMoneyCell } from "./FinanceInlineMoneyCell";
import { financeSectionRailLabelClass, financeSectionSummaryBg, financeSectionSummaryLabelClass } from "./finance-grid-rail";

type FooterStyle = {
  tdClass: string;
  tdMoneyClass: string;
  tdTextClass: string;
  tdParticipantClass: string;
  moneyCol: string;
  participantCol: string;
  stickyColLeft: string;
  stickyColDesc: string;
  formatDisplayFromBase: (cents: number) => string;
};

export type FinanceGridIncomeMode = "none" | "placeholder" | "full";

type FooterProps = {
  lines: CostLineItemDraft[];
  ledger: CostLedgerProjection;
  roster: RosterSummary;
  pool: RosterSummary["participants"];
  allocationByLine: Map<string, Record<string, number>>;
  participantTotalCents: (lines: CostLineItemDraft[], participantId: string) => number;
  sectionSubtotalCents: (lines: CostLineItemDraft[]) => number;
  incomeMode: FinanceGridIncomeMode;
  /** When set, income rows are limited to this finance tab. */
  incomeSection: FinanceEntitySection | null;
  totalColCount: number;
  styles: FooterStyle;
  moneyCellProps: {
    displayCurrency: string;
    baseCurrency: string;
    ratesFromBase: Record<string, number>;
  };
  onAddIncomeLine?: (section: FinanceEntitySection | null) => void;
  onUpdateFund?: (
    fundId: string,
    patch: { name?: string; amountCents?: number },
  ) => void;
  onPatchFundParticipant?: (
    fundId: string,
    participantId: string,
    amountCents: number | null,
  ) => void;
  onDeleteFund?: (fundId: string) => void;
  onDeletePayment?: (paymentId: string) => void;
  selectedFundIds?: Set<string>;
  onToggleFundSelection?: (fundId: string) => void;
  showAvgPerNight?: boolean;
  paymentLeadingAction?: ReactNode;
  onOpenFundPricing?: (fundId: string) => void;
  fundHasPinnedPrices?: (fund: TripFundDraft) => boolean;
  /** Overall tab: trip-wide payments only, no section placeholders or add row. */
  overallView?: boolean;
  graph?: TripEntityGraph | null;
  presence?: ReturnType<typeof buildParticipantPresenceMap>;
};

const footerBg = "bg-zinc-50";

function fundParticipantBase(
  fund: TripFundDraft,
  participantId: string,
  ledger: CostLedgerProjection,
): number {
  const raw = ledger.fundAllocations[fund.id]?.[participantId] ?? 0;
  if (raw <= 0) return 0;
  return convertToBaseCents(raw, fund.currency, ledger.settings);
}

function renderSectionSummaryRow(
  label: string,
  totalCents: number,
  participantCents: (participantId: string) => number,
  props: FooterProps,
  leadingAction?: ReactNode,
) {
  const s = props.styles;
  return (
    <FinanceSectionSummaryRow
      key={label}
      label={label}
      totalCents={totalCents}
      pool={props.pool}
      participantCents={participantCents}
      styles={s}
      formatDisplayFromBase={s.formatDisplayFromBase}
      leadingAction={leadingAction}
    />
  );
}

export function FinanceSectionSummaryRow(props: {
  label: string;
  subtitle?: string;
  totalCents: number;
  pool: RosterSummary["participants"];
  participantCents: (participantId: string) => number;
  styles: FooterStyle;
  formatDisplayFromBase: (cents: number) => string;
  leadingAction?: ReactNode;
}) {
  const s = props.styles;
  return (
    <tr className={`${financeSectionSummaryBg} font-semibold text-zinc-900`}>
      <td
        className={`${s.tdClass} ${s.stickyColLeft} ${financeSectionSummaryBg} border-zinc-400 align-middle`}
      >
        {props.leadingAction ? (
          <div className="flex items-center justify-center">{props.leadingAction}</div>
        ) : null}
      </td>
      <td
        className={`${s.tdTextClass} ${s.stickyColDesc} ${financeSectionSummaryBg} border-zinc-400 py-2.5`}
      >
        <span className={financeSectionSummaryLabelClass}>{props.label}</span>
        {props.subtitle ? (
          <p className="mt-1 text-[10px] font-medium normal-case leading-snug tracking-normal text-zinc-700">
            {props.subtitle}
          </p>
        ) : null}
      </td>
      <td className={`${s.tdClass} ${financeSectionSummaryBg} w-12 border-zinc-400`} />
      <td
        className={`${s.tdMoneyClass} ${s.moneyCol} ${financeSectionSummaryBg} border-zinc-400 text-center`}
      >
        {props.totalCents > 0 ? props.formatDisplayFromBase(props.totalCents) : ""}
      </td>
      {props.pool.map((participant) => {
        const cents = props.participantCents(participant.id);
        return (
          <td
            key={participant.id}
            className={`${s.tdParticipantClass} ${s.participantCol} ${financeSectionSummaryBg} border-zinc-400 text-right`}
          >
            {cents > 0 ? props.formatDisplayFromBase(cents) : ""}
          </td>
        );
      })}
      <td className={`${s.tdClass} ${financeSectionSummaryBg} border-zinc-400`} />
    </tr>
  );
}

/** @deprecated section labels now sit on summary rows below each block */
export function FinanceSectionRailRow(props: {
  label: string;
  colSpan: number;
  stickyColLeft: string;
  tdClass: string;
}) {
  return (
    <tr>
      <td
        className={`${props.tdClass} ${props.stickyColLeft} border-zinc-300 bg-zinc-100 px-1 py-3 text-center align-middle`}
      >
        <span className={`block ${financeSectionRailLabelClass}`}>{props.label}</span>
      </td>
      <td
        colSpan={props.colSpan - 1}
        className="border border-zinc-300 bg-zinc-50"
      />
    </tr>
  );
}

/** @deprecated use FinanceSectionRailRow */
export function FinanceSectionDivider(props: { label: string; colSpan: number }) {
  return (
    <tr>
      <td
        colSpan={props.colSpan}
        className="border border-zinc-300 bg-zinc-100 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500"
      >
        {props.label}
      </td>
    </tr>
  );
}

function renderAmountRow(
  label: string,
  totalCents: number,
  participantCents: (participantId: string) => number,
  props: FooterProps,
) {
  const s = props.styles;
  return (
    <tr className={`${footerBg} font-semibold text-zinc-800`}>
      <td className={`${s.tdClass} ${s.stickyColLeft} ${footerBg} border-zinc-300`} />
      <td className={`${s.tdTextClass} ${s.stickyColDesc} ${footerBg} border-zinc-300`}>
        {label}
      </td>
      <td className={`${s.tdClass} ${footerBg} w-12 border-zinc-300`} />
      <td className={`${s.tdMoneyClass} ${s.moneyCol} ${footerBg} border-zinc-300 text-center`}>
        {totalCents > 0 ? s.formatDisplayFromBase(totalCents) : ""}
      </td>
      {props.pool.map((participant) => {
        const cents = participantCents(participant.id);
        return (
          <td
            key={participant.id}
            className={`${s.tdParticipantClass} ${s.participantCol} ${footerBg} border-zinc-300 text-right`}
          >
            {cents > 0 ? s.formatDisplayFromBase(cents) : ""}
          </td>
        );
      })}
      <td className={`${s.tdClass} ${footerBg} border-zinc-300`} />
    </tr>
  );
}

function renderAvgPerNightRow(props: FooterProps) {
  const { lines, graph, presence, ledger } = props;
  const s = props.styles;
  const settings = ledger.settings;

  const linePerNights = lines
    .map((line) => {
      const nights = effectiveStayNights(line, graph);
      if (!nights || line.totalAmountCents <= 0) return null;
      const baseTotal = convertToBaseCents(line.totalAmountCents, line.currency, settings);
      return perNightCents(baseTotal, nights);
    })
    .filter((value): value is number => value != null && value > 0);
  const avgLinePerNight =
    linePerNights.length > 0
      ? Math.round(linePerNights.reduce((sum, value) => sum + value, 0) / linePerNights.length)
      : null;

  return (
    <tr className={`${footerBg} text-xs font-medium text-zinc-700`}>
      <td className={`${s.tdClass} ${s.stickyColLeft} ${footerBg} border-zinc-300`} />
      <td className={`${s.tdTextClass} ${s.stickyColDesc} ${footerBg} border-zinc-300`}>
        Avg / night
      </td>
      <td className={`${s.tdClass} ${footerBg} w-12 border-zinc-300`} />
      <td className={`${s.tdMoneyClass} ${s.moneyCol} ${footerBg} border-zinc-300 text-center`}>
        {avgLinePerNight != null ? s.formatDisplayFromBase(avgLinePerNight) : ""}
      </td>
      {props.pool.map((participant) => {
        const perNights: number[] = [];
        for (const line of lines) {
          const alloc = props.allocationByLine.get(line.id)?.[participant.id];
          if (!alloc || alloc <= 0) continue;
          const nights =
            graph && presence
              ? participantNightsForLine(line, participant.id, graph, presence) ??
                effectiveStayNights(line, graph)
              : effectiveStayNights(line, graph);
          if (!nights || nights <= 0) continue;
          const baseAlloc = convertToBaseCents(alloc, line.currency, settings);
          const perNight = perNightCents(baseAlloc, nights);
          if (perNight != null && perNight > 0) perNights.push(perNight);
        }
        const avg =
          perNights.length > 0
            ? Math.round(perNights.reduce((sum, value) => sum + value, 0) / perNights.length)
            : null;
        return (
          <td
            key={participant.id}
            className={`${s.tdParticipantClass} ${s.participantCol} ${footerBg} border-zinc-300 text-right`}
          >
            {avg != null ? s.formatDisplayFromBase(avg) : ""}
          </td>
        );
      })}
      <td className={`${s.tdClass} ${footerBg} border-zinc-300`} />
    </tr>
  );
}

function renderFundRow(fund: TripFundDraft, props: FooterProps) {
  const s = props.styles;
  const { pool, ledger } = props;
  const displayName = fund.name.trim() || "New line";
  const selected = props.selectedFundIds?.has(fund.id) ?? false;
  const rowBg = selected ? "bg-violet-50" : "bg-white group-hover:bg-zinc-50";

  return (
    <tr key={fund.id} className={`group ${rowBg}`}>
      <td
        className={`${s.tdClass} ${s.stickyColLeft} border-zinc-300 text-center ${rowBg}`}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={() => props.onToggleFundSelection?.(fund.id)}
          className="rounded border-zinc-400"
          aria-label={`Select payment row ${displayName}`}
        />
      </td>
      <td className={`${s.tdTextClass} ${s.stickyColDesc} border-zinc-300 ${rowBg}`}>
        <div className="min-w-0 flex-1">
          <FinanceFundNameCell
            fundId={fund.id}
            name={fund.name}
            onSave={(name) => props.onUpdateFund?.(fund.id, { name })}
          />
          {props.onOpenFundPricing ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                props.onOpenFundPricing?.(fund.id);
              }}
              className="mt-1 rounded border border-violet-300 bg-violet-50 px-1.5 py-0.5 text-[9px] font-semibold text-violet-800 hover:bg-violet-100"
            >
              {props.fundHasPinnedPrices?.(fund)
                ? "Edit per-person prices"
                : "Set per-person prices"}
            </button>
          ) : null}
        </div>
      </td>
      <td className={`${s.tdClass} w-12 border-zinc-300 ${rowBg}`} />
      <td className={`${s.tdMoneyClass} ${s.moneyCol} border-zinc-300 text-center ${rowBg}`}>
        <FinanceInlineMoneyCell
          align="center"
          valueCents={fund.amountCents > 0 ? fund.amountCents : null}
          currency={fund.currency}
          {...props.moneyCellProps}
          onCommit={(cents) => {
            props.onUpdateFund?.(fund.id, { amountCents: cents ?? 0 });
          }}
        />
      </td>
      {pool.map((participant) => {
        const rawCents = ledger.fundAllocations[fund.id]?.[participant.id] ?? 0;
        const amountCents = rawCents > 0 ? rawCents : null;
        const isPinned = Boolean(
          fund.allocationRulePayload.pinnedAllocations?.[participant.id],
        );
        return (
          <td
            key={participant.id}
            className={`${s.tdParticipantClass} ${s.participantCol} border-zinc-300 text-right ${rowBg}`}
          >
            <FinanceParticipantAmountCell
              amountCents={amountCents}
              currency={fund.currency}
              isPinned={isPinned}
              {...props.moneyCellProps}
              onSave={(cents) => {
                props.onPatchFundParticipant?.(fund.id, participant.id, cents);
              }}
            />
          </td>
        );
      })}
      <td className={`${s.tdClass} border-zinc-300 ${rowBg}`} />
    </tr>
  );
}

export function FinanceGridFooter(props: FooterProps) {
  const { lines, ledger, pool, incomeMode, incomeSection } = props;

  const costTotal = props.sectionSubtotalCents(lines);
  const paidTotal = supplierPaidCentsForLines(lines, ledger);
  const toBePaidTotal = Math.max(0, costTotal - paidTotal);

  const participantCost = (participantId: string) =>
    props.participantTotalCents(lines, participantId);
  const participantPaid = (participantId: string) =>
    supplierPaidCentsForParticipantOnLines(
      lines,
      participantId,
      ledger,
      props.allocationByLine,
    );
  const participantToBePaid = (participantId: string) =>
    Math.max(0, participantCost(participantId) - participantPaid(participantId));

  const scopedFunds = props.overallView
    ? fundsForOverallView(ledger.funds)
    : fundsForFinanceSection(ledger.funds, incomeSection, ledger.settings);

  const showPaymentsSection =
    incomeMode !== "none" &&
    (incomeMode === "placeholder"
      ? Boolean(incomeSection)
      : props.overallView
        ? false
        : incomeMode === "full" && !incomeSection);

  const paymentsTotalCents = scopedFunds.reduce(
    (sum, fund) => sum + convertToBaseCents(fund.amountCents, fund.currency, ledger.settings),
    0,
  );
  const paymentsParticipantCents = (participantId: string) =>
    scopedFunds.reduce(
      (sum, fund) => sum + fundParticipantBase(fund, participantId, ledger),
      0,
    );

  return (
    <>
      {showPaymentsSection ? (
        <>
          {renderSectionSummaryRow(
            incomeSection
              ? financeSectionFundingLabel(incomeSection, ledger.settings)
              : "Payments",
            paymentsTotalCents,
            paymentsParticipantCents,
            props,
            props.paymentLeadingAction,
          )}

          {incomeMode === "placeholder" && incomeSection ? (
            <>{scopedFunds.map((fund) => renderFundRow(fund, props))}</>
          ) : null}

          {incomeMode === "full" && !incomeSection ? (
            <>
              {scopedFunds.map((fund) => renderFundRow(fund, props))}
              {ledger.payments.map((payment) => {
                const person = props.roster.participants.find(
                  (p) => p.id === payment.participantId,
                );
                const base = convertToBaseCents(
                  payment.amountCents,
                  payment.currency,
                  ledger.settings,
                );
                const s = props.styles;
                return (
                  <tr key={payment.id} className="group bg-white hover:bg-zinc-50">
                    <td
                      className={`${s.tdClass} ${s.stickyColLeft} border-zinc-300 text-center`}
                    >
                      <button
                        type="button"
                        onClick={() => props.onDeletePayment?.(payment.id)}
                        className="text-[10px] text-red-600 opacity-0 hover:underline group-hover:opacity-100"
                      >
                        ×
                      </button>
                    </td>
                    <td className={`${s.tdTextClass} ${s.stickyColDesc} border-zinc-300`}>
                      <span className="font-medium">{payment.label}</span>
                      <span className="ml-1 text-zinc-500">· family payment</span>
                    </td>
                    <td className={`${s.tdClass} w-12 border-zinc-300`} />
                    <td className={`${s.tdMoneyClass} ${s.moneyCol} border-zinc-300 text-center`}>
                      {s.formatDisplayFromBase(base)}
                    </td>
                    {pool.map((participant) => (
                      <td
                        key={participant.id}
                        className={`${s.tdParticipantClass} ${s.participantCol} border-zinc-300 text-right`}
                      >
                        {participant.id === payment.participantId
                          ? s.formatDisplayFromBase(base)
                          : ""}
                      </td>
                    ))}
                    <td className={`${s.tdClass} border-zinc-300`} title={person?.fullName}>
                      ✓
                    </td>
                  </tr>
                );
              })}
            </>
          ) : null}
        </>
      ) : null}

      {renderSectionSummaryRow("Totals", costTotal, participantCost, props)}
      {renderAmountRow("Total expense", costTotal, participantCost, props)}
      {renderAmountRow("Total remaining to pay", toBePaidTotal, participantToBePaid, props)}
      {renderAmountRow("Total paid", paidTotal, participantPaid, props)}
      {props.showAvgPerNight ? renderAvgPerNightRow(props) : null}
    </>
  );
}
