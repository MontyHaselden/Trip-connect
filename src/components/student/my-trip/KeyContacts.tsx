"use client";

import { StudentBottomSheet } from "@/components/student/StudentBottomSheet";

function formatTelHref(phone: string) {
  return `tel:${phone}`;
}

function formatSmsHref(phone: string) {
  return `sms:${phone}`;
}

export function KeyContactsSheet(props: {
  open: boolean;
  onClose: () => void;
  contacts: Array<{
    id: string;
    name: string;
    role: string;
    phoneNumber: string;
  }>;
}) {
  const { open, onClose, contacts } = props;

  return (
    <StudentBottomSheet open={open} onClose={onClose} title="Key contacts">
      {!contacts.length ? (
        <p className="pb-2 text-sm text-[var(--student-text-muted)]">No contacts added yet.</p>
      ) : (
        <div className="divide-y divide-[var(--student-line)] pb-2">
          {contacts.map((c) => (
            <div key={c.id} className="flex items-center gap-3 py-3 first:pt-0">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-[var(--student-text)]">{c.name}</div>
                <div className="text-xs text-[var(--student-text-muted)]">{c.role}</div>
                <div className="mt-0.5 text-xs tabular-nums text-[var(--student-text-muted)]">
                  {c.phoneNumber}
                </div>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <a
                  href={formatTelHref(c.phoneNumber)}
                  className="inline-flex h-8 items-center justify-center rounded-full bg-[var(--student-nav)] px-3 text-xs font-semibold text-white"
                >
                  Call
                </a>
                <a
                  href={formatSmsHref(c.phoneNumber)}
                  className="student-btn-secondary inline-flex h-8 items-center justify-center px-3 text-xs"
                >
                  Text
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </StudentBottomSheet>
  );
}
