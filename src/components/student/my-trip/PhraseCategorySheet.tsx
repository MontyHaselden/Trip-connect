"use client";

import { StudentBottomSheet } from "@/components/student/StudentBottomSheet";

export function PhraseCategorySheet(props: {
  open: boolean;
  onClose: () => void;
  categoryName: string;
  phrases: Array<{
    id: string;
    englishText: string;
    translatedText: string;
    pronunciation: string | null;
    notes: string | null;
    sortOrder: number;
  }>;
}) {
  const { open, onClose, categoryName, phrases } = props;
  const sorted = [...phrases].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <StudentBottomSheet open={open} onClose={onClose} title={categoryName}>
      <div className="space-y-3 pb-2">
        {sorted.map((p) => (
          <div
            key={p.id}
            className="rounded-xl border border-[var(--student-line)] bg-[var(--student-bg)] px-4 py-3"
          >
            <div className="text-sm font-semibold text-[var(--student-text)]">
              {p.englishText}
            </div>
            <div className="mt-1.5 text-base font-medium text-[var(--student-text)]">
              {p.translatedText}
            </div>
            {p.pronunciation ? (
              <div className="mt-1 text-xs text-[var(--student-text-muted)]">
                {p.pronunciation}
              </div>
            ) : null}
            {p.notes ? (
              <div className="mt-1 text-xs text-[var(--student-text-muted)]">{p.notes}</div>
            ) : null}
          </div>
        ))}
      </div>
    </StudentBottomSheet>
  );
}
