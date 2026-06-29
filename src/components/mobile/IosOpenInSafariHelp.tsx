"use client";

import { useState } from "react";

export function IosOpenInSafariHelp() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      try {
        const input = document.createElement("textarea");
        input.value = url;
        input.setAttribute("readonly", "");
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2500);
      } catch {
        setCopied(false);
      }
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="text-xs font-medium text-[var(--student-nav,#0284c7)] hover:underline"
      >
        {open ? "Hide Safari help" : "Don't have Safari?"}
      </button>

      {open ? (
        <div className="mt-3 rounded-xl border border-[var(--student-line,#e4e4e7)] bg-[var(--student-surface,#fafafa)] px-4 py-3 text-sm text-[var(--student-text,#18181b)]">
          <p className="font-medium">If you&apos;re on an iPhone, you have Safari.</p>
          <p className="mt-2 text-[var(--student-text-muted,#71717a)]">
            Apple doesn&apos;t let anyone fully delete Safari from an iPhone — even if you
            don&apos;t use it or can&apos;t see it on your home screen.
          </p>

          <button
            type="button"
            onClick={() => void copyLink()}
            className="student-btn-primary mt-4 h-10 w-full text-sm"
          >
            {copied ? "Link copied!" : "Copy this link"}
          </button>

          <ol className="mt-4 space-y-2.5 text-sm">
            <li>
              <span className="font-medium">1.</span> Tap <strong>Copy this link</strong> above.
            </li>
            <li>
              <span className="font-medium">2.</span> Swipe down from the top of your screen, type{" "}
              <strong>Safari</strong> in Search, and open the Safari app.
            </li>
            <li>
              <span className="font-medium">3.</span> Tap the address bar at the top, paste the
              link, and go.
            </li>
            <li>
              <span className="font-medium">4.</span> In Safari, follow the{" "}
              <strong>Add to Home Screen</strong> steps on this page.
            </li>
          </ol>

          <p className="mt-4 text-xs text-[var(--student-text-muted,#71717a)]">
            Opened this from Gmail or Chrome? You can leave and come back — just paste this same
            link in Safari whenever you need to read the next steps.
          </p>
        </div>
      ) : null}
    </div>
  );
}
