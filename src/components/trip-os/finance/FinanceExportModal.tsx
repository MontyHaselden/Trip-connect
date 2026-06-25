"use client";

import { useEffect, useMemo, useState } from "react";

import {
  downloadFinanceExport,
  listFinanceExportScopes,
  type FinanceExportContext,
  type FinanceExportFormat,
  type FinanceExportScope,
} from "@/lib/trip-engine/cost-ledger/export-finance-scoped";

import { TripEyebrow } from "../shared/TripEyebrow";
import { TripPrimaryButton } from "../shared/TripPrimaryButton";

type AudienceMode = "everyone" | "one";

function FieldLabel(props: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
      {props.children}
    </p>
  );
}

function SegmentButton(props: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={[
        "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition",
        props.active
          ? "bg-white text-violet-900 shadow-sm ring-1 ring-violet-200"
          : "text-zinc-600 hover:text-zinc-900",
      ].join(" ")}
    >
      {props.children}
    </button>
  );
}

export function FinanceExportModal(props: {
  open: boolean;
  exportContext: FinanceExportContext;
  onClose: () => void;
}) {
  const { ledger, roster, graph } = props.exportContext;

  const scopeOptions = useMemo(
    () => listFinanceExportScopes(ledger, graph),
    [ledger, graph],
  );

  const participants = useMemo(
    () =>
      roster.participants.filter((p) => p.inCostSplit && p.role !== "host"),
    [roster.participants],
  );

  const defaultScope = useMemo(() => {
    const withLines = scopeOptions.find((option) => option.lineCount > 0);
    return withLines?.id ?? "all";
  }, [scopeOptions]);

  const [scope, setScope] = useState<FinanceExportScope>(defaultScope);
  const [audience, setAudience] = useState<AudienceMode>("everyone");
  const [participantId, setParticipantId] = useState<string>(
    () => participants[0]?.id ?? "",
  );
  const [format, setFormat] = useState<FinanceExportFormat>("html");

  useEffect(() => {
    if (!props.open) return;
    setScope(defaultScope);
    setAudience("everyone");
    setParticipantId(participants[0]?.id ?? "");
    setFormat("html");
  }, [props.open, defaultScope, participants]);

  useEffect(() => {
    if (!props.open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") props.onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [props.open, props.onClose]);

  const selectedScope = scopeOptions.find((option) => option.id === scope);
  const canExport = Boolean(selectedScope && selectedScope.lineCount > 0);
  const needsParticipant = audience === "one";
  const participantReady = !needsParticipant || Boolean(participantId);

  function handleDownload() {
    if (!canExport || !participantReady) return;
    downloadFinanceExport(
      {
        scope,
        participantId: audience === "one" ? participantId : null,
        format,
      },
      props.exportContext,
    );
    props.onClose();
  }

  if (!props.open) return null;

  const formatLabel = format === "html" ? "Printable report" : "Spreadsheet";

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Dismiss"
        className="absolute inset-0 bg-zinc-900/45 backdrop-blur-[2px]"
        onClick={props.onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="finance-export-title"
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-zinc-200/80"
      >
        <div className="border-b border-violet-200 bg-violet-50 px-5 py-4">
          <TripEyebrow accent className="text-violet-700">
            Finance export
          </TripEyebrow>
          <h2
            id="finance-export-title"
            className="mt-1 text-lg font-semibold tracking-tight text-zinc-900"
          >
            Export report
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            Section, audience, and format — then download.
          </p>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <FieldLabel>What to export</FieldLabel>
            <select
              value={scope}
              onChange={(event) => setScope(event.target.value as FinanceExportScope)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-500/20"
            >
              {scopeOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                  {option.lineCount > 0
                    ? ` — ${option.lineCount} row${option.lineCount === 1 ? "" : "s"}`
                    : " — empty"}
                </option>
              ))}
            </select>
            {selectedScope?.description ? (
              <p className="mt-1.5 text-xs leading-snug text-zinc-500">
                {selectedScope.description}
              </p>
            ) : null}
          </div>

          <div>
            <FieldLabel>Who is it for?</FieldLabel>
            <div className="flex rounded-xl bg-zinc-100 p-1">
              <SegmentButton
                active={audience === "everyone"}
                onClick={() => setAudience("everyone")}
              >
                Everyone
              </SegmentButton>
              <SegmentButton
                active={audience === "one"}
                onClick={() => setAudience("one")}
              >
                One person
              </SegmentButton>
            </div>
            {audience === "one" ? (
              <select
                value={participantId}
                onChange={(event) => setParticipantId(event.target.value)}
                className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-500/20"
              >
                {participants.map((participant) => (
                  <option key={participant.id} value={participant.id}>
                    {participant.fullName}
                  </option>
                ))}
              </select>
            ) : (
              <p className="mt-1.5 text-xs text-zinc-500">
                Full group — one column per person in cost split.
              </p>
            )}
          </div>

          <div>
            <FieldLabel>Format</FieldLabel>
            <div className="flex rounded-xl bg-zinc-100 p-1">
              <SegmentButton active={format === "html"} onClick={() => setFormat("html")}>
                Printable report
              </SegmentButton>
              <SegmentButton active={format === "csv"} onClick={() => setFormat("csv")}>
                Spreadsheet
              </SegmentButton>
            </div>
            <p className="mt-1.5 text-xs text-zinc-500">
              {format === "html"
                ? "HTML for browser print → Save as PDF."
                : "CSV for Excel or Google Sheets."}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-100 bg-zinc-50/80 px-5 py-3.5">
          <TripPrimaryButton variant="ghost" onClick={props.onClose}>
            Cancel
          </TripPrimaryButton>
          <TripPrimaryButton
            variant="violet"
            onClick={handleDownload}
            disabled={!canExport || !participantReady}
          >
            {canExport && participantReady ? `Download ${formatLabel}` : "Nothing to export"}
          </TripPrimaryButton>
        </div>
      </div>
    </div>
  );
}
