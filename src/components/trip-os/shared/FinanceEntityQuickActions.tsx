"use client";

export function FinanceEntityQuickActions(props: {
  show: boolean;
  saving?: boolean;
  onTbc?: () => void;
  onNoCost?: () => void;
}) {
  if (!props.show) return null;

  return (
    <div className="flex shrink-0 items-center gap-2">
      {props.onTbc ? (
        <button
          type="button"
          disabled={props.saving}
          onClick={props.onTbc}
          className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
          title="Mark as to be confirmed — stays orange until priced"
        >
          TBC
        </button>
      ) : null}
      {props.onNoCost ? (
        <button
          type="button"
          disabled={props.saving}
          onClick={props.onNoCost}
          className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
          title="Mark as free — no participant charge"
        >
          No cost
        </button>
      ) : null}
    </div>
  );
}
