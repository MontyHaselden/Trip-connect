"use client";

import type { ReactNode } from "react";

function ChevronRight() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-4 w-4 shrink-0 text-[var(--student-text-muted)]"
      aria-hidden
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export function MyTripMenuRow(props: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  onClick: () => void;
}) {
  const { title, subtitle, icon, onClick } = props;

  return (
    <button type="button" onClick={onClick} className="student-menu-row">
      {icon ? (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center text-[var(--student-text-muted)]">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-[var(--student-text)]">{title}</span>
        {subtitle ? (
          <span className="mt-0.5 block truncate text-xs text-[var(--student-text-muted)]">
            {subtitle}
          </span>
        ) : null}
      </span>
      <ChevronRight />
    </button>
  );
}
