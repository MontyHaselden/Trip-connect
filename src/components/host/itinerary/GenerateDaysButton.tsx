"use client";

export function GenerateDaysButton(props: {
  inviteCode: string;
  busy: boolean;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const { inviteCode, busy, onDone, onError } = props;

  async function generate() {
    try {
      const res = await fetch(
        `/api/host/${encodeURIComponent(inviteCode)}/days/generate`,
        { method: "POST" },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Generate failed");
      onDone();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Generate failed");
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={generate}
      className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium disabled:opacity-50"
    >
      Generate days from trip dates
    </button>
  );
}
