"use client";

import { useMemo, useState } from "react";

import {
  buildAllocationByLine,
  lineAllocationResult,
  lineIsVisibleInFinanceBreakdown,
  participantAllocationCentsWithPending,
  type PendingAllocationRows,
} from "@/lib/trip-engine/cost-ledger/finance-participant-display";
import {
  financeSectionLabel,
  financeSectionList,
  groupLinesByFinanceSection,
} from "@/lib/trip-engine/cost-ledger/finance-sections";
import { formatMoney } from "@/lib/trip-engine/cost-ledger/format-money";
import type { CostLedgerProjection, FinanceViewGroup } from "@/lib/trip-engine/cost-ledger/types";
import type { RosterSummary, TripEntityGraph } from "@/lib/trip-engine/types";

import { TripConfirmModal } from "../shared/TripConfirmModal";

export function FinanceByGroupView(props: {
  costLedger: CostLedgerProjection;
  roster: RosterSummary;
  graph?: TripEntityGraph | null;
  selectedGroupId: string | null;
  onSelectGroup: (groupId: string) => void;
  onSaveGroups: (groups: FinanceViewGroup[]) => Promise<void>;
  saving?: boolean;
  pendingAllocations?: PendingAllocationRows;
}) {
  const settings = props.costLedger.settings;
  const pendingAllocations = props.pendingAllocations ?? {};
  const pool = useMemo(
    () => props.roster.participants.filter((p) => p.inCostSplit && p.role !== "host"),
    [props.roster.participants],
  );
  const groups = settings.financeViewGroups;
  const [editorOpen, setEditorOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftParticipantIds, setDraftParticipantIds] = useState<Set<string>>(new Set());

  const allocationByLine = useMemo(
    () => buildAllocationByLine(props.costLedger.lineAllocations),
    [props.costLedger.lineAllocations],
  );

  const linesBySection = useMemo(
    () => groupLinesByFinanceSection(props.costLedger.lineItems, props.graph, settings),
    [props.costLedger.lineItems, props.graph, settings],
  );

  const sections = financeSectionList(settings);
  const groupId = props.selectedGroupId ?? groups[0]?.id ?? null;
  const group = groups.find((g) => g.id === groupId);

  const rows = useMemo(() => {
    if (!group?.participantIds.length) return [];
    const out: { section: string; description: string; amountCents: number }[] = [];
    for (const section of sections) {
      for (const line of linesBySection.get(section) ?? []) {
        const lineAlloc = lineAllocationResult(props.costLedger, line.id);
        const pendingRow = pendingAllocations[line.id];
        if (!lineIsVisibleInFinanceBreakdown(line, lineAlloc, pendingRow)) continue;
        let lineTotal = 0;
        for (const participantId of group.participantIds) {
          lineTotal += participantAllocationCentsWithPending(
            line,
            participantId,
            allocationByLine,
            settings,
            pendingRow,
          );
        }
        if (lineTotal <= 0) continue;
        out.push({
          section: financeSectionLabel(section, settings),
          description: line.description,
          amountCents: lineTotal,
        });
      }
    }
    return out;
  }, [
    group,
    sections,
    linesBySection,
    allocationByLine,
    settings,
    pendingAllocations,
    props.costLedger,
  ]);

  const total = rows.reduce((sum, row) => sum + row.amountCents, 0);

  function openNewGroupEditor() {
    setDraftName("");
    setDraftParticipantIds(new Set());
    setEditorOpen(true);
  }

  async function saveNewGroup() {
    const name = draftName.trim();
    if (!name || draftParticipantIds.size === 0) return;
    const next: FinanceViewGroup[] = [
      ...groups,
      {
        id: crypto.randomUUID(),
        name,
        participantIds: [...draftParticipantIds],
      },
    ];
    await props.onSaveGroups(next);
    setEditorOpen(false);
    props.onSelectGroup(next[next.length - 1]!.id);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="block text-[11px]">
          <span className="font-medium text-zinc-700">Group</span>
          <select
            value={groupId ?? ""}
            onChange={(e) => props.onSelectGroup(e.target.value)}
            className="mt-1 block min-w-[12rem] rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-sm text-zinc-900"
          >
            {groups.length === 0 ? (
              <option value="">No groups yet</option>
            ) : (
              groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.participantIds.length})
                </option>
              ))
            )}
          </select>
        </label>
        <button
          type="button"
          onClick={openNewGroupEditor}
          className="rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-[11px] font-semibold text-violet-800 hover:bg-violet-100"
        >
          + New group
        </button>
        {group ? (
          <p className="text-sm text-zinc-600">
            Combined costs for{" "}
            <span className="font-semibold text-zinc-900">{group.name}</span> (
            {group.participantIds.length} people)
          </p>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="bg-zinc-100 text-zinc-700">
              <th className="border-b border-zinc-200 px-3 py-2 font-semibold">Section</th>
              <th className="border-b border-zinc-200 px-3 py-2 font-semibold">Line</th>
              <th className="border-b border-zinc-200 px-3 py-2 text-right font-semibold">
                Group total
              </th>
            </tr>
          </thead>
          <tbody>
            {!group ? (
              <tr>
                <td colSpan={3} className="px-3 py-8 text-center text-zinc-500">
                  Create a group to see a combined breakdown (e.g. visiting students from another
                  school).
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-8 text-center text-zinc-500">
                  No allocated costs for this group yet.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={`${row.section}-${row.description}-${index}`} className="hover:bg-zinc-50">
                  <td className="border-b border-zinc-100 px-3 py-2 text-zinc-600">{row.section}</td>
                  <td className="border-b border-zinc-100 px-3 py-2 text-zinc-900">
                    {row.description}
                  </td>
                  <td className="border-b border-zinc-100 px-3 py-2 text-right tabular-nums text-zinc-900">
                    {formatMoney(row.amountCents, settings.baseCurrency)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {group && rows.length > 0 ? (
            <tfoot>
              <tr className="bg-violet-50 font-semibold text-zinc-900">
                <td className="px-3 py-2" colSpan={2}>
                  Total for {group.name}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatMoney(total, settings.baseCurrency)}
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      <TripConfirmModal
        open={editorOpen}
        eyebrow="Finance group"
        title="New view group"
        description="Pick who belongs in this group. Their line totals are summed in the By group view."
        confirmLabel="Save group"
        confirmDisabled={!draftName.trim() || draftParticipantIds.size === 0}
        confirmLoading={props.saving}
        onCancel={() => setEditorOpen(false)}
        onConfirm={() => void saveNewGroup()}
      >
        <label className="block">
          <span className="text-xs font-medium text-zinc-900">Group name</span>
          <input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="e.g. Visiting school"
            className="mt-1.5 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm text-zinc-900"
            autoFocus
          />
        </label>
        <ul className="mt-4 max-h-48 space-y-1 overflow-y-auto">
          {pool.map((participant) => {
            const checked = draftParticipantIds.has(participant.id);
            return (
              <li key={participant.id}>
                <button
                  type="button"
                  onClick={() =>
                    setDraftParticipantIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(participant.id)) next.delete(participant.id);
                      else next.add(participant.id);
                      return next;
                    })
                  }
                  className="flex w-full items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-left text-sm font-medium text-zinc-900 hover:bg-zinc-50"
                >
                  <input type="checkbox" checked={checked} readOnly className="rounded" />
                  {participant.fullName}
                </button>
              </li>
            );
          })}
        </ul>
      </TripConfirmModal>
    </div>
  );
}
