"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { hostJson } from "@/components/host/shared/host-fetch";

import { CategoryEditor } from "./CategoryEditor";
import { CategoryList } from "./CategoryList";
import { PhraseList } from "./PhraseList";
import { SeedDefaultsButton } from "./SeedDefaultsButton";
import type { PhraseTree } from "./types";

type TripMeta = {
  destinationLanguage: string | null;
  needsPublishConfirm: boolean;
};

export function PhrasesClient({ inviteCode }: { inviteCode: string }) {
  const api = `/api/host/${encodeURIComponent(inviteCode)}`;
  const settingsHref = `/host/${encodeURIComponent(inviteCode)}/settings`;

  const [tree, setTree] = useState<PhraseTree | null>(null);
  const [tripMeta, setTripMeta] = useState<TripMeta | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );
  const [editingPhraseId, setEditingPhraseId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bulkSummary, setBulkSummary] = useState<string | null>(null);

  const canUseAi = Boolean(tripMeta?.destinationLanguage?.trim());

  const load = useCallback(async () => {
    const [data, trip] = await Promise.all([
      hostJson<PhraseTree>(`${api}/phrases`),
      hostJson<TripMeta>(`${api}/trip`),
    ]);
    setTree(data);
    setTripMeta(trip);
    setSelectedCategoryId((prev) => {
      if (prev && data.categories.some((c) => c.id === prev)) return prev;
      return data.categories[0]?.id ?? null;
    });
  }, [api]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const selectedCategory = useMemo(
    () => tree?.categories.find((c) => c.id === selectedCategoryId) ?? null,
    [tree, selectedCategoryId],
  );

  async function reload() {
    setBusy(true);
    setError(null);
    try {
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reload failed");
    } finally {
      setBusy(false);
    }
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const created = await hostJson<{ id: string }>(
        `${api}/phrase-categories`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: newCategoryName.trim() }),
        },
      );
      setNewCategoryName("");
      await load();
      setSelectedCategoryId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Add category failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-600">Loading phrases…</p>;
  }

  if (!tree) {
    return (
      <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
        {error ?? "Failed to load"}
      </p>
    );
  }

  const isEmpty = tree.categories.length === 0;

  return (
    <main className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Emergency phrases</h1>
        <p className="text-sm text-zinc-600">
          Phrases students can show locals on My Trip.
        </p>
      </header>

      {error ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}

      {bulkSummary ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
          {bulkSummary}
        </p>
      ) : null}

      {!canUseAi ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Set a destination language in{" "}
          <Link href={settingsHref} className="font-medium underline">
            Settings
          </Link>{" "}
          to use AI translation.
        </section>
      ) : null}

      {tripMeta?.needsPublishConfirm ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Students will see phrase changes after you confirm publish on the Publish
          tab.
        </section>
      ) : (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          Phrase changes go live automatically while no students have joined yet.
        </section>
      )}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold">Categories</h2>
        <div className="mt-3">
          <CategoryList
            categories={tree.categories}
            selectedId={selectedCategoryId}
            onSelect={(id) => {
              setSelectedCategoryId(id);
              setEditingPhraseId(null);
            }}
          />
        </div>
        {isEmpty ? (
          <div className="mt-4">
            <SeedDefaultsButton
              inviteCode={inviteCode}
              busy={busy}
              onDone={reload}
              onError={setError}
            />
          </div>
        ) : null}
        <form onSubmit={addCategory} className="mt-4 flex gap-2">
          <input
            placeholder="New category name"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            className="h-10 min-w-0 flex-1 rounded-xl border border-zinc-200 px-3 text-sm"
          />
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50"
          >
            Add category
          </button>
        </form>
      </section>

      {selectedCategory ? (
        <>
          <CategoryEditor
            inviteCode={inviteCode}
            category={selectedCategory}
            canUseAi={canUseAi}
            onUpdated={reload}
            onDeleted={() => {
              setSelectedCategoryId(null);
              reload();
            }}
            onError={setError}
            onBulkTranslated={({ updated, skipped }) => {
              setBulkSummary(
                `Updated ${updated} phrase${updated === 1 ? "" : "s"}${skipped ? ` (${skipped} skipped)` : ""}.`,
              );
            }}
          />
          <PhraseList
            inviteCode={inviteCode}
            category={selectedCategory}
            canUseAi={canUseAi}
            editingId={editingPhraseId}
            onEdit={setEditingPhraseId}
            onReload={reload}
            onError={setError}
          />
        </>
      ) : null}
    </main>
  );
}
