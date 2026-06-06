"use client";

import { useState } from "react";

type PublishLinks = {
  hostTrip: { url: string; path: string };
  studentInvite: { url: string; path: string };
};

export function PublishSuccessModal(props: {
  version: number;
  links: PublishLinks;
  tripName: string;
  onClose: () => void;
}) {
  const { version, links, tripName, onClose } = props;
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(label: string, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  function qrUrl(url: string) {
    return `https://quickchart.io/qr?text=${encodeURIComponent(url)}&size=160&margin=1`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Published v{version}</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Share these links. Open in Chrome on a phone, add to home screen, then
              continue.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-zinc-500"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <section className="mt-6 space-y-4">
          <div className="rounded-xl border border-zinc-200 p-4">
            <p className="text-sm font-semibold">Host trip app</p>
            <p className="mt-1 text-xs text-zinc-500">
              For you on the trip — same Today / My Trip view as students.
            </p>
            <div className="mt-3 flex items-start gap-4">
              <img
                src={qrUrl(links.hostTrip.url)}
                alt=""
                width={96}
                height={96}
                className="rounded-lg border border-zinc-100"
              />
              <div className="min-w-0 flex-1">
                <p className="break-all text-xs text-zinc-700">{links.hostTrip.url}</p>
                <button
                  type="button"
                  onClick={() => copy("hostTrip", links.hostTrip.url)}
                  className="mt-2 text-xs font-medium text-sky-700"
                >
                  {copied === "hostTrip" ? "Copied" : "Copy link"}
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 p-4">
            <p className="text-sm font-semibold">Student invite</p>
            <p className="mt-1 text-xs text-zinc-500">
              Students join with name, phone, and a password for re-login.
            </p>
            <div className="mt-3 flex items-start gap-4">
              <img
                src={qrUrl(links.studentInvite.url)}
                alt=""
                width={96}
                height={96}
                className="rounded-lg border border-zinc-100"
              />
              <div className="min-w-0 flex-1">
                <p className="break-all text-xs text-zinc-700">
                  {links.studentInvite.url}
                </p>
                <button
                  type="button"
                  onClick={() => copy("student", links.studentInvite.url)}
                  className="mt-2 text-xs font-medium text-sky-700"
                >
                  {copied === "student" ? "Copied" : "Copy link"}
                </button>
              </div>
            </div>
          </div>
        </section>

        <p className="mt-4 text-xs text-zinc-500">
          Host <strong>admin</strong> app (roster & accommodation on phone) is a separate
          link — find it under trip settings or the dashboard sidebar.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 h-10 w-full rounded-xl bg-zinc-900 text-sm font-medium text-white"
        >
          Done
        </button>
      </div>
    </div>
  );
}
