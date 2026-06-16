"use client";

import type { SetupSectionId, SetupSectionReadiness } from "@/lib/host/setup/types";

import { STATUS_CLASS, STATUS_ICON } from "./setup-status-styles";

export function SetupSectionNav(props: {
  sections: SetupSectionReadiness[];
  active: SetupSectionId;
  onSelect: (id: SetupSectionId) => void;
}) {
  const { sections, active, onSelect } = props;

  return (
    <nav className="space-y-1">
      {sections.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onSelect(s.id)}
          className={[
            "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition",
            active === s.id
              ? "bg-zinc-900 font-medium text-white shadow-sm"
              : "text-zinc-700 hover:bg-white hover:shadow-sm",
          ].join(" ")}
        >
          <span
            className={[
              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
              active === s.id ? "bg-white/20 text-white" : STATUS_CLASS[s.status],
            ].join(" ")}
            title={s.message}
          >
            {STATUS_ICON[s.status]}
          </span>
          <span className="truncate">{s.label}</span>
        </button>
      ))}
    </nav>
  );
}
