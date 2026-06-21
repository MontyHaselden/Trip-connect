"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ParticipantPreviewShell,
  type ParticipantPreviewTab,
} from "../participant/ParticipantPreviewShell";
import { TripEyebrow } from "../shared/TripEyebrow";

type RosterParticipant = {
  id: string;
  fullName: string;
  role: string;
  groupIds: string[];
  groupNames: string[];
};

type RosterGroup = {
  id: string;
  name: string;
  type: string;
};

type PreviewPayload = {
  participantId: string;
  payload: unknown;
  version: number;
  publishedAt: string | null;
  source: "draft";
  liveForStudents: boolean;
  staleVsPublished: boolean;
};

type PreviewResponse = {
  inviteCode: string;
  publishedVersion: number;
  defaultParticipantId?: string | null;
  groups: RosterGroup[];
  participants: RosterParticipant[];
  preview?: PreviewPayload;
};

function previewParticipantStorageKey(tripId: string) {
  return `tc_os_preview_participant_${tripId}`;
}

function toolbarButtonClass(disabled?: boolean) {
  return [
    "rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium shadow-sm transition hover:bg-zinc-50",
    disabled ? "opacity-50" : "",
  ].join(" ");
}

function PreviewStatusBanner(props: {
  preview: PreviewPayload | null;
  publishedVersion: number;
}) {
  const { preview, publishedVersion } = props;
  if (!preview) return null;

  if (publishedVersion === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
        Previewing your current trip — students see a not-ready screen until you publish.
      </div>
    );
  }

  if (preview.liveForStudents) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900">
        Matches what students see now.
      </div>
    );
  }

  if (preview.staleVsPublished) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
        Draft has unpublished changes — students still see the last published version.
      </div>
    );
  }

  return null;
}

export function ParticipantViewSection(props: {
  tripId: string;
  refreshKey: number;
}) {
  const { tripId, refreshKey } = props;
  const pickerRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roster, setRoster] = useState<PreviewResponse | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [tab, setTab] = useState<ParticipantPreviewTab>("today");
  const [pickerOpen, setPickerOpen] = useState(false);

  const loadPreview = useCallback(
    async (targetParticipantId: string, opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/trips/${tripId}/participant-preview?participantId=${encodeURIComponent(targetParticipantId)}`,
        );
        const body = (await res.json().catch(() => ({}))) as PreviewResponse & { error?: string };
        if (!res.ok) throw new Error(body.error || "Failed to load preview");
        setRoster(body);
        setParticipantId(targetParticipantId);
        setPreview(body.preview ?? null);
        try {
          sessionStorage.setItem(previewParticipantStorageKey(tripId), targetParticipantId);
        } catch {
          // ignore
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load preview");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [tripId],
  );

  useEffect(() => {
    let cancelled = false;

       

    async function init() {
      setError(null);
      if (refreshKey === 0) setLoading(true);

      try {
        const res = await fetch(`/api/trips/${tripId}/participant-preview`);
        const body = (await res.json().catch(() => ({}))) as PreviewResponse & { error?: string };
        if (!res.ok) throw new Error(body.error || "Failed to load roster");
        if (cancelled) return;

        setRoster(body);

        let stored: string | null = null;
        try {
          stored = sessionStorage.getItem(previewParticipantStorageKey(tripId));
        } catch {
          // ignore
        }

        const target =
          (stored && body.participants.some((p) => p.id === stored) ? stored : null) ??
          body.defaultParticipantId ??
          null;

        if (!target) {
          setParticipantId(null);
          setPreview(null);
          setLoading(false);
          return;
        }

        await loadPreview(target, { silent: refreshKey > 0 });
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load preview");
          setLoading(false);
        }
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [tripId, refreshKey, loadPreview]);

  useEffect(() => {
    if (!pickerOpen) return;

    function closeOnOutside(event: MouseEvent) {
      if (pickerRef.current?.contains(event.target as Node)) return;
      setPickerOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutside);
    return () => document.removeEventListener("mousedown", closeOnOutside);
  }, [pickerOpen]);

  const selectedParticipant = useMemo(
    () => roster?.participants.find((p) => p.id === participantId) ?? null,
    [roster, participantId],
  );

  const groupedOptions = useMemo(() => {
    if (!roster) return [];
    const byGroup = new Map<string, RosterParticipant[]>();
    const ungrouped: RosterParticipant[] = [];

    for (const p of roster.participants) {
      if (!p.groupIds.length) {
        ungrouped.push(p);
        continue;
      }
      for (const gid of p.groupIds) {
        const arr = byGroup.get(gid) ?? [];
        arr.push(p);
        byGroup.set(gid, arr);
      }
    }

    const sections: Array<{ label: string; participants: RosterParticipant[] }> = [];
    for (const g of roster.groups) {
      const members = byGroup.get(g.id);
      if (members?.length) sections.push({ label: g.name, participants: members });
    }
    if (ungrouped.length) {
      sections.push({ label: "No group", participants: ungrouped });
    }
    return sections;
  }, [roster]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <TripEyebrow>Participant view</TripEyebrow>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-zinc-900">
            See what they see
          </h2>
          {selectedParticipant ? (
            <p className="mt-1 text-sm text-zinc-500">
              {selectedParticipant.fullName}
              {" · "}
              {selectedParticipant.groupNames.length
                ? selectedParticipant.groupNames.join(", ")
                : "No group"}
              {" · "}
              {selectedParticipant.role}
            </p>
          ) : (
            <p className="mt-1 text-sm text-zinc-500">
              Preview the student phone experience while you keep working on the trip.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative" ref={pickerRef}>
            <button
              type="button"
              onClick={() => setPickerOpen((o) => !o)}
              className={toolbarButtonClass()}
            >
              Change user
            </button>
            {pickerOpen ? (
              <div className="absolute right-0 top-full z-20 mt-2 w-64 rounded-2xl border border-zinc-200 bg-white p-3 shadow-lg">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Preview as
                </p>
                <div className="max-h-56 space-y-3 overflow-y-auto">
                  {groupedOptions.map((section) => (
                    <div key={section.label}>
                      <p className="mb-1 text-[11px] font-medium text-zinc-500">{section.label}</p>
                      <ul className="space-y-1">
                        {section.participants.map((p) => (
                          <li key={`${section.label}-${p.id}`}>
                            <button
                              type="button"
                              onClick={() => {
                                setPickerOpen(false);
                                void loadPreview(p.id);
                              }}
                              className={[
                                "w-full rounded-lg px-2.5 py-2 text-left text-sm transition",
                                p.id === participantId
                                  ? "bg-violet-100 font-medium text-violet-900"
                                  : "text-zinc-700 hover:bg-zinc-50",
                              ].join(" ")}
                            >
                              {p.fullName}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            disabled={!participantId || refreshing}
            onClick={() => participantId && void loadPreview(participantId, { silent: true })}
            className={toolbarButtonClass(!participantId || refreshing)}
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <PreviewStatusBanner
        preview={preview}
        publishedVersion={roster?.publishedVersion ?? 0}
      />

      {loading && !preview ? (
        <div className="flex h-[min(calc(100dvh-14rem),680px)] items-center justify-center rounded-2xl bg-zinc-50/80">
          <p className="text-sm text-zinc-500">Loading preview…</p>
        </div>
      ) : !roster?.participants.length ? (
        <div className="rounded-2xl bg-zinc-50/80 px-5 py-8 text-center text-sm text-zinc-600">
          Add users first, then preview their experience here.
        </div>
      ) : (
        <div className="flex justify-center py-2">
          <div className="w-[min(100%,390px)]">
            <div className="overflow-hidden rounded-[2rem] border-[10px] border-zinc-900 bg-zinc-900 shadow-2xl">
              <div className="bg-zinc-900 pb-1.5 pt-2">
                <div className="mx-auto h-1.5 w-16 rounded-full bg-zinc-700" />
              </div>
              <div className="relative h-[min(calc(100dvh-14rem),680px)] overflow-hidden bg-[var(--student-bg)]">
                {participantId && preview?.payload ? (
                  <ParticipantPreviewShell
                    tripId={tripId}
                    inviteCode={roster.inviteCode}
                    participantId={participantId}
                    version={preview.version}
                    publishedAt={preview.publishedAt}
                    payload={preview.payload}
                    tab={tab}
                    onTabChange={setTab}
                    onRefresh={() => loadPreview(participantId, { silent: true })}
                    refreshing={refreshing}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-6 text-center text-sm text-zinc-500">
                    Select a participant to preview.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
