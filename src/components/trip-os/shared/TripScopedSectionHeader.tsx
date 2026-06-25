"use client";

import { scopeMemberSubtitle } from "@/lib/trip-engine/section-scope-lists";

export function TripScopedSectionHeader(props: {
  title: string;
  memberNames: string[];
  isWholeGroup?: boolean;
  headerAction?: React.ReactNode;
}) {
  const members = scopeMemberSubtitle(props.memberNames);

  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900">{props.title}</h3>
        {members && !props.isWholeGroup ? (
          <p className="mt-0.5 text-xs text-zinc-500">{members}</p>
        ) : props.isWholeGroup ? (
          <p className="mt-0.5 text-xs text-zinc-500">Shared by everyone on the trip</p>
        ) : null}
      </div>
      {props.headerAction}
    </div>
  );
}
