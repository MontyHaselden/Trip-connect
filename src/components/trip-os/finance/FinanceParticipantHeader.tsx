"use client";

import { participantHeaderFontSize } from "@/lib/trip-engine/cost-ledger/display-utils";

export function FinanceParticipantHeader(props: { label: string; fullName: string }) {
  return (
    <span
      className="block px-0.5 text-center leading-snug"
      style={{ fontSize: `${participantHeaderFontSize(props.label.length)}px` }}
      title={props.fullName}
    >
      {props.label}
    </span>
  );
}
