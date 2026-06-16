import type { SetupReadinessStatus } from "@/lib/host/setup/types";

export const STATUS_ICON: Record<SetupReadinessStatus, string> = {
  complete: "✓",
  flexible: "◐",
  todo: "!",
  decision: "?",
  conflict: "⚠",
  idle: "·",
};

export const STATUS_CLASS: Record<SetupReadinessStatus, string> = {
  complete: "bg-emerald-100 text-emerald-800",
  flexible: "bg-amber-100 text-amber-800",
  todo: "bg-orange-100 text-orange-800",
  decision: "bg-orange-100 text-orange-900",
  conflict: "bg-red-100 text-red-800",
  idle: "bg-zinc-100 text-zinc-500",
};
