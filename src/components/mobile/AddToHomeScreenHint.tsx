"use client";

import { detectMobileBrowser } from "@/lib/mobile/pwa-detect";

export function AddToHomeScreenHint(props: {
  tripName: string;
  onDismiss: () => void;
}) {
  const { tripName, onDismiss } = props;
  const browser = detectMobileBrowser();

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 p-4 sm:items-center sm:justify-center">
      <div
        className="mx-auto w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl"
        role="dialog"
        aria-labelledby="install-title"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
          Install as app
        </p>
        <h2 id="install-title" className="mt-2 text-xl font-semibold text-zinc-900">
          {tripName}
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          To open full-screen without the browser bar, add this trip to your home
          screen and open it from the new icon.
        </p>

        {browser === "ios" ? (
          <ol className="mt-5 space-y-3 text-sm text-zinc-800">
            <li>
              <span className="font-medium">1.</span> Use <strong>Safari</strong>{" "}
              (not Chrome).
            </li>
            <li>
              <span className="font-medium">2.</span> Tap <strong>Share</strong>{" "}
              (square with arrow).
            </li>
            <li>
              <span className="font-medium">3.</span> Tap{" "}
              <strong>Add to Home Screen</strong>.
            </li>
            <li>
              <span className="font-medium">4.</span> Open{" "}
              <strong>{tripName}</strong> from your home screen.
            </li>
          </ol>
        ) : (
          <ol className="mt-5 space-y-3 text-sm text-zinc-800">
            <li>
              <span className="font-medium">1.</span> Tap the menu (⋮) in Chrome.
            </li>
            <li>
              <span className="font-medium">2.</span> Tap{" "}
              <strong>Add to Home screen</strong> or <strong>Install app</strong>.
            </li>
            <li>
              <span className="font-medium">3.</span> Open the new icon from your home
              screen.
            </li>
          </ol>
        )}

        <button
          type="button"
          onClick={onDismiss}
          className="mt-6 h-11 w-full rounded-xl bg-zinc-900 text-sm font-medium text-white"
        >
          Continue in browser
        </button>
        <p className="mt-3 text-center text-xs text-zinc-500">
          Delete any old Itinerary Live icon first, then add again from this page.
        </p>
      </div>
    </div>
  );
}
