import type { TripLifecycleStatus } from "@/lib/host/trip-lifecycle";

const STYLES: Record<TripLifecycleStatus, string> = {
  building: "bg-amber-50 text-amber-800 ring-amber-200/80",
  built: "bg-slate-100 text-slate-700 ring-slate-200/80",
  active: "bg-emerald-50 text-emerald-800 ring-emerald-200/80",
  completed: "bg-zinc-100 text-zinc-600 ring-zinc-200/80",
};

export function TripStatusBadge({
  status,
  label,
  className = "",
}: {
  status: TripLifecycleStatus;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ring-1 ring-inset",
        STYLES[status],
        className,
      ].join(" ")}
    >
      {label}
    </span>
  );
}
