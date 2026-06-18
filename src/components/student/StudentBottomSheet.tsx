"use client";

import type { ReactNode } from "react";

import { useStudentOverlay } from "@/components/student/StudentOverlayContext";
import { studentOverlayRootClass } from "@/lib/student/overlay-classes";

export function StudentBottomSheet(props: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxHeight?: string;
}) {
  const { open, onClose, title, children, maxHeight = "75dvh" } = props;
  const { contained } = useStudentOverlay();
  const sheetMaxHeight = contained ? "72%" : maxHeight;

  if (!open) return null;

  return (
    <div className={studentOverlayRootClass(contained)}>
      <div
        role="presentation"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div className="animate-sheet-up relative mx-auto w-full max-w-md overflow-hidden rounded-t-2xl bg-[var(--student-surface)] shadow-xl">
        <div className="flex justify-center pt-2 pb-1">
          <span className="h-1 w-10 rounded-full bg-[var(--student-line)]" />
        </div>
        <div
          className="overflow-y-auto px-5 pb-[max(env(safe-area-inset-bottom),1rem)] pt-2"
          style={{ maxHeight: sheetMaxHeight }}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-[var(--student-text)]">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-full px-2 py-1 text-sm font-medium text-[var(--student-text-muted)]"
            >
              Done
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
