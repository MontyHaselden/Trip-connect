"use client";

export function SeedDefaultsButton(props: {
  inviteCode: string;
  busy: boolean;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const { inviteCode, busy, onDone, onError } = props;

  async function seed() {
    try {
      const res = await fetch(
        `/api/host/${encodeURIComponent(inviteCode)}/phrases/seed-defaults`,
        { method: "POST" },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Import failed");
      onDone();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Import failed");
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={seed}
      className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium disabled:opacity-50"
    >
      Import default Japan phrases
    </button>
  );
}
