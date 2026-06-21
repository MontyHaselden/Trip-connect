"use client";

import { useCallback, useEffect, useState } from "react";

import { TripConfirmModal } from "./shared/TripConfirmModal";

type UpdatePreview = {
  publishedVersion: number;
  lastPublishedAt: string | null;
  hasChanges: boolean;
  changeCount?: number;
};

function countDiffChanges(summary: Record<string, { added: number; removed: number; changed: number }>) {
  return Object.values(summary).reduce(
    (total, section) => total + section.added + section.removed + section.changed,
    0,
  );
}

export function TripOsParticipantUpdate(props: {
  tripId: string;
  inviteCode: string;
  saving?: boolean;
  onUpdated?: () => void;
  refreshKey?: number;
}) {
  const { tripId, inviteCode, saving, onUpdated, refreshKey = 0 } = props;

  const [preview, setPreview] = useState<UpdatePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justUpdated, setJustUpdated] = useState(false);

  const loadPreview = useCallback(async () => {
    if (!inviteCode) return;
    setLoadingPreview(true);
    try {
      const res = await fetch(
        `/api/host/${encodeURIComponent(inviteCode)}/publish/preview`,
      );
      const body = (await res.json().catch(() => ({}))) as UpdatePreview & {
        error?: string;
        summary?: Record<string, { added: number; removed: number; changed: number }>;
      };
      if (!res.ok) throw new Error(body.error || "Could not load update status");
      setPreview({
        publishedVersion: body.publishedVersion,
        lastPublishedAt: body.lastPublishedAt,
        hasChanges: body.hasChanges,
        changeCount: body.summary ? countDiffChanges(body.summary) : undefined,
      });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load update status");
    } finally {
      setLoadingPreview(false);
    }
  }, [inviteCode]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview, refreshKey]);

  useEffect(() => {
    if (saving) return;
    void loadPreview();
  }, [saving, loadPreview]);

  const neverShared = (preview?.publishedVersion ?? 0) === 0;
  const hasPendingChanges = neverShared || Boolean(preview?.hasChanges);
  const canUpdate = hasPendingChanges && !updating && !loadingPreview;

  async function confirmUpdate() {
    setUpdating(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/publish`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Update failed");
      setModalOpen(false);
      setJustUpdated(true);
      window.setTimeout(() => setJustUpdated(false), 4000);
      await loadPreview();
      onUpdated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setUpdating(false);
    }
  }

  const modalDescription = neverShared
    ? "Nobody can see trip details on their phones yet. This will share your current trip with everyone who has joined."
    : "Participants are viewing an older version. This will update all joined screens to match what you have saved now.";

  return (
    <>
      <div className="mb-2 space-y-1.5">
        <button
          type="button"
          disabled={!canUpdate}
          onClick={() => setModalOpen(true)}
          className={[
            "relative flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition",
            canUpdate
              ? "bg-violet-500 text-white shadow-sm hover:bg-violet-400"
              : "cursor-default bg-indigo-400/10 text-indigo-200/40",
          ].join(" ")}
        >
          {hasPendingChanges && canUpdate ? (
            <span className="absolute left-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-amber-300" />
          ) : null}
          <span className={hasPendingChanges && canUpdate ? "pl-3" : undefined}>
            {justUpdated ? "Updated" : "Update participants"}
          </span>
        </button>
        {loadingPreview ? (
          <p className="px-1 text-[11px] text-indigo-300/40">Checking for changes…</p>
        ) : neverShared ? (
          <p className="px-1 text-[11px] leading-snug text-indigo-300/50">
            Students can join now, but won&apos;t see the trip until you update here.
          </p>
        ) : hasPendingChanges ? (
          <p className="px-1 text-[11px] leading-snug text-amber-200/70">
            Unsaved for participants — tap update to push your latest changes.
          </p>
        ) : (
          <p className="px-1 text-[11px] leading-snug text-emerald-300/60">
            Participants are up to date.
          </p>
        )}
        {error ? (
          <p className="px-1 text-[11px] leading-snug text-red-300/80">{error}</p>
        ) : null}
      </div>

      <TripConfirmModal
        open={modalOpen}
        eyebrow="Participant screens"
        title="Update all participant screens?"
        description={modalDescription}
        tone={neverShared ? "default" : "warning"}
        confirmLabel="Update now"
        confirmLoading={updating}
        onCancel={() => {
          if (!updating) setModalOpen(false);
        }}
        onConfirm={() => void confirmUpdate()}
      >
        {preview?.changeCount ? (
          <p className="text-sm text-zinc-600">
            {preview.changeCount} change
            {preview.changeCount === 1 ? "" : "s"} since the last update.
          </p>
        ) : null}
        <p className="mt-3 text-sm text-zinc-600">
          Everyone who has joined will see the latest itinerary, contacts, and trip
          details the next time they open the app.
        </p>
      </TripConfirmModal>
    </>
  );
}
