"use client";

import type { SetupStatusItem } from "@/lib/host/setup/section-status-items";
import type { SetupSectionReadiness } from "@/lib/host/setup/types";

import { STATUS_CLASS, STATUS_ICON } from "./setup-status-styles";

export function SetupSectionStatusPanel(props: {
  section?: SetupSectionReadiness;
  items: SetupStatusItem[];
  onItemClick?: (item: SetupStatusItem) => void;
}) {
  const { section, items, onItemClick } = props;

  return (
    <div className="px-5 py-4">
      {section ? (
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Status</p>
          <h2 className="mt-1 text-sm font-semibold text-zinc-900">{section.label}</h2>
          {section.message ? (
            <p className="mt-1 text-sm text-zinc-600">{section.message}</p>
          ) : null}
        </div>
      ) : null}

      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className={[
              "rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-2.5",
              onItemClick && item.kind === "airport-transfer" ? "cursor-pointer hover:bg-zinc-100" : "",
            ].join(" ")}
            onClick={
              onItemClick && item.kind === "airport-transfer"
                ? () => onItemClick(item)
                : undefined
            }
            onKeyDown={
              onItemClick && item.kind === "airport-transfer"
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") onItemClick(item);
                  }
                : undefined
            }
            role={onItemClick && item.kind === "airport-transfer" ? "button" : undefined}
            tabIndex={onItemClick && item.kind === "airport-transfer" ? 0 : undefined}
          >
            <div className="flex items-start gap-3">
              <span
                className={[
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                  STATUS_CLASS[item.status],
                ].join(" ")}
              >
                {STATUS_ICON[item.status]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-900">{item.label}</p>
                {item.prompt ? (
                  <p className="mt-0.5 text-xs text-zinc-500">{item.prompt}</p>
                ) : null}
                {item.value ? (
                  <p className="mt-1 text-sm text-zinc-700">{item.value}</p>
                ) : null}
                {item.message && item.status !== "complete" ? (
                  <p className="mt-1 text-xs font-medium text-amber-800">{item.message}</p>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
