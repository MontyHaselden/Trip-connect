"use client";

import { participantHeaderFontSize } from "@/lib/trip-engine/cost-ledger/display-utils";

export function FinanceParticipantHeader(props: {
  label: string;
  fullName: string;
  selected?: boolean;
  onToggle?: () => void;
}) {
  const content = (
    <span
      className="block px-0.5 text-center leading-snug"
      style={{ fontSize: `${participantHeaderFontSize(props.label.length)}px` }}
    >
      {props.label}
    </span>
  );

  if (!props.onToggle) {
    return (
      <span title={props.fullName}>
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        props.onToggle?.();
      }}
      title={`${props.fullName} — click to select for bulk fill`}
      className={[
        "w-full rounded px-0.5 py-0.5 transition",
        props.selected
          ? "bg-violet-200 ring-1 ring-violet-500"
          : "hover:bg-violet-100/80",
      ].join(" ")}
    >
      {content}
    </button>
  );
}
