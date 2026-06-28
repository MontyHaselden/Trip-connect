"use client";

import {
  formatGroupsSummary,
  formatParticipantRole,
} from "@/lib/student/my-trip-summary";

export function MyTripPassHeader(props: {
  tripName: string;
  fullName: string;
  role: string;
  groups?: Array<{ name: string }>;
}) {
  const { tripName, fullName, role, groups } = props;
  const summary = formatGroupsSummary(groups);
  const roleLabel = formatParticipantRole(role);

  return (
    <header className="shrink-0 pb-1 pt-0.5">
      <h1 className="text-2xl font-bold tracking-tight text-[var(--student-text)]">
        {tripName}
      </h1>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--student-text-muted)]">
        My Trip
      </p>
      <p className="mt-2 text-sm text-[var(--student-text)]">
        {fullName}
        {roleLabel ? (
          <>
            <span className="text-[var(--student-text-muted)]"> · </span>
            {roleLabel}
          </>
        ) : null}
      </p>
      {summary ? (
        <p className="mt-1 text-sm text-[var(--student-text-muted)]">{summary}</p>
      ) : null}
    </header>
  );
}
