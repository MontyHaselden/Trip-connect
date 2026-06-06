"use client";

import { useEffect, useState } from "react";

export function HostMobileLinkCard(props: { tripId: string }) {
  const { tripId } = props;
  const [adminUrl, setAdminUrl] = useState<string | null>(null);
  const [studentUrl, setStudentUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/trips/${tripId}/mobile-links`)
      .then((r) => r.json())
      .then((body) => {
        if (body.admin?.url) setAdminUrl(body.admin.url);
        if (body.studentInvite?.url) setStudentUrl(body.studentInvite.url);
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [tripId]);

  async function copy(label: string, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      // ignore
    }
  }

  if (loading) return null;

  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-4">
      <p className="text-sm font-semibold text-sky-950">Phone apps</p>
      <p className="mt-1 text-xs text-sky-900/80">
        Open in Chrome → Share → Add to Home Screen. Admin and trip apps are separate
        installs.
      </p>
      {adminUrl ? (
        <div className="mt-3">
          <p className="text-xs font-medium text-sky-950">Host admin (roster & rooms)</p>
          <p className="mt-1 break-all text-xs text-sky-900">{adminUrl}</p>
          <button
            type="button"
            onClick={() => copy("admin", adminUrl)}
            className="mt-1 text-xs font-medium text-sky-800 underline"
          >
            {copied === "admin" ? "Copied" : "Copy admin link"}
          </button>
        </div>
      ) : null}
      {studentUrl ? (
        <div className="mt-3">
          <p className="text-xs font-medium text-sky-950">Student invite</p>
          <p className="mt-1 break-all text-xs text-sky-900">{studentUrl}</p>
          <button
            type="button"
            onClick={() => copy("student", studentUrl)}
            className="mt-1 text-xs font-medium text-sky-800 underline"
          >
            {copied === "student" ? "Copied" : "Copy student link"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
