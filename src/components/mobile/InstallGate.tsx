"use client";

import { useEffect, useState } from "react";

import {
  detectMobileBrowser,
  isPwaReady,
  markPwaReady,
} from "@/lib/mobile/pwa-detect";

export function InstallGate(props: {
  tripName: string;
  manifestHref: string;
  children: React.ReactNode;
  onReady?: () => void;
}) {
  const { tripName, manifestHref, children, onReady } = props;
  const [ready, setReady] = useState(false);
  const browser = detectMobileBrowser();

  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (link) link.href = manifestHref;

    const titleMeta = document.querySelector<HTMLMetaElement>(
      'meta[name="apple-mobile-web-app-title"]',
    );
    if (titleMeta) titleMeta.content = tripName;
    else {
      const meta = document.createElement("meta");
      meta.name = "apple-mobile-web-app-title";
      meta.content = tripName;
      document.head.appendChild(meta);
    }

    if (isPwaReady()) {
      setReady(true);
      onReady?.();
    }
  }, [manifestHref, tripName, onReady]);

  if (ready) return <>{children}</>;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
          Add to home screen
        </p>
        <h1 className="mt-2 text-xl font-semibold text-zinc-900">{tripName}</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Open this in Chrome on your phone, then install the app so it stays on your home
          screen and keeps you signed in.
        </p>

        <ol className="mt-5 space-y-3 text-sm text-zinc-800">
          {browser === "ios" ? (
            <>
              <li>
                <span className="font-medium">1.</span> Tap the <strong>Share</strong>{" "}
                button (square with arrow) in Safari.
              </li>
              <li>
                <span className="font-medium">2.</span> Tap{" "}
                <strong>Add to Home Screen</strong>.
              </li>
              <li>
                <span className="font-medium">3.</span> Name it{" "}
                <strong>{tripName}</strong>, then tap Add.
              </li>
              <li>
                <span className="font-medium">4.</span> Open the new icon on your home
                screen.
              </li>
            </>
          ) : (
            <>
              <li>
                <span className="font-medium">1.</span> Tap the menu (⋮) in Chrome.
              </li>
              <li>
                <span className="font-medium">2.</span> Tap{" "}
                <strong>Add to Home screen</strong> or <strong>Install app</strong>.
              </li>
              <li>
                <span className="font-medium">3.</span> Name it{" "}
                <strong>{tripName}</strong>, then confirm.
              </li>
              <li>
                <span className="font-medium">4.</span> Open the new icon on your home
                screen.
              </li>
            </>
          )}
        </ol>

        <button
          type="button"
          onClick={() => {
            markPwaReady();
            setReady(true);
            onReady?.();
          }}
          className="mt-6 h-11 w-full rounded-xl bg-zinc-900 text-sm font-medium text-white"
        >
          I&apos;ve added it — continue
        </button>
        <p className="mt-3 text-center text-xs text-zinc-500">
          You must open from your home screen icon for the best experience.
        </p>
      </div>
    </div>
  );
}
