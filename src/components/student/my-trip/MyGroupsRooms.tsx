"use client";

import { StudentBottomSheet } from "@/components/student/StudentBottomSheet";
import { formatGroupsSummary } from "@/lib/student/my-trip-summary";

export function GroupsSheet(props: {
  open: boolean;
  onClose: () => void;
  groups: Array<{ id: string; name: string; type: string }>;
}) {
  const { open, onClose, groups } = props;
  const summary = formatGroupsSummary(groups);

  return (
    <StudentBottomSheet open={open} onClose={onClose} title="My groups">
      <div className="space-y-5 pb-2 text-sm">
        {summary ? (
          <p className="text-[var(--student-text-muted)]">{summary}</p>
        ) : null}

        {groups.length ? (
          <ul className="space-y-2">
            {groups.map((g) => (
              <li
                key={g.id}
                className="rounded-xl border border-[var(--student-line)] bg-[var(--student-bg)] px-3 py-2.5"
              >
                <div className="font-semibold text-[var(--student-text)]">{g.name}</div>
                <div className="text-xs text-[var(--student-text-muted)]">{g.type}</div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[var(--student-text-muted)]">No groups assigned yet.</p>
        )}
      </div>
    </StudentBottomSheet>
  );
}
