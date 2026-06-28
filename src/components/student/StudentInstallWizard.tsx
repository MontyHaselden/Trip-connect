"use client";

import { useEffect, useState } from "react";

import {
  detectMobileBrowser,
  isStandaloneDisplayMode,
} from "@/lib/mobile/pwa-detect";
import { registerPwaServiceWorker } from "@/lib/mobile/register-pwa-sw";
import { useBeforeInstallPrompt } from "@/lib/mobile/use-before-install-prompt";
import { wirePwaHead } from "@/lib/mobile/wire-pwa-head";

type InstallPlatform = "ios" | "android";

function platformFromDetection(): InstallPlatform {
  return detectMobileBrowser() === "android" ? "android" : "ios";
}

function IosInstructions(props: { tripName: string }) {
  return (
    <ol className="mt-5 space-y-3 text-sm text-zinc-800">
      <li>
        <span className="font-medium">1.</span> Use <strong>Safari</strong> (not Chrome).
      </li>
      <li>
        <span className="font-medium">2.</span> Tap <strong>Share</strong> (square with arrow).
      </li>
      <li>
        <span className="font-medium">3.</span> Tap <strong>Add to Home Screen</strong>.
      </li>
      <li>
        <span className="font-medium">4.</span> Name it <strong>{props.tripName}</strong>, then tap
        Add.
      </li>
      <li>
        <span className="font-medium">5.</span> Open <strong>{props.tripName}</strong> from your
        home screen — this page will continue automatically.
      </li>
    </ol>
  );
}

function AndroidInstructions(props: { tripName: string; showManualSteps: boolean }) {
  return (
    <>
      {props.showManualSteps ? (
        <ol className="mt-5 space-y-3 text-sm text-zinc-800">
          <li>
            <span className="font-medium">1.</span> Tap the menu (⋮) in Chrome.
          </li>
          <li>
            <span className="font-medium">2.</span> Tap <strong>Add to Home screen</strong> or{" "}
            <strong>Install app</strong>.
          </li>
          <li>
            <span className="font-medium">3.</span> Name it <strong>{props.tripName}</strong>, then
            confirm.
          </li>
          <li>
            <span className="font-medium">4.</span> Open the new icon from your home screen.
          </li>
        </ol>
      ) : (
        <p className="mt-5 text-sm text-zinc-700">
          Tap <strong>Install app</strong> below, or use Chrome&apos;s menu (⋮) →{" "}
          <strong>Add to Home screen</strong>.
        </p>
      )}
    </>
  );
}

export function StudentInstallWizard(props: {
  tripName: string;
  manifestHref: string;
  onReady: () => void;
}) {
  const { tripName, manifestHref, onReady } = props;
  const [platform, setPlatform] = useState<InstallPlatform>(platformFromDetection);
  const [showPlatformPicker, setShowPlatformPicker] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [installing, setInstalling] = useState(false);
  const { canPromptInstall, promptInstall } = useBeforeInstallPrompt();

  useEffect(() => {
    wirePwaHead({ manifestHref, appTitle: tripName });
    void registerPwaServiceWorker();
  }, [manifestHref, tripName]);

  useEffect(() => {
    function checkStandalone() {
      if (isStandaloneDisplayMode()) {
        setStandalone(true);
        onReady();
      }
    }

    checkStandalone();

    const interval = window.setInterval(checkStandalone, 800);
    function onVisible() {
      if (document.visibilityState === "visible") checkStandalone();
    }
    window.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", checkStandalone);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", checkStandalone);
    };
  }, [onReady]);

  async function onInstallClick() {
    setInstalling(true);
    try {
      await promptInstall();
    } finally {
      setInstalling(false);
    }
  }

  if (standalone) return null;

  return (
    <main className="student-app-scroll flex min-h-dvh flex-col items-center justify-center overflow-y-auto bg-[var(--student-bg)] px-6 py-10">
      <div className="student-card w-full max-w-md shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--student-nav)]">
          Step 1 of 2 — Add to home screen
        </p>
        <h1 className="mt-2 text-xl font-bold text-[var(--student-text)]">{tripName}</h1>
        <p className="mt-2 text-sm text-[var(--student-text-muted)]">
          Install this trip on your phone first so you stay signed in. Joining in the browser
          won&apos;t remember you when you open the app icon.
        </p>

        {showPlatformPicker ? (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium text-[var(--student-text-muted)]">Pick your device</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setPlatform("ios");
                  setShowPlatformPicker(false);
                }}
                className={[
                  "flex-1 rounded-xl border px-3 py-2.5 text-xs font-semibold",
                  platform === "ios"
                    ? "border-[var(--student-nav)] bg-[var(--student-nav)]/10 text-[var(--student-text)]"
                    : "border-[var(--student-line)] text-[var(--student-text-muted)]",
                ].join(" ")}
              >
                iPhone / iPad (Safari)
              </button>
              <button
                type="button"
                onClick={() => {
                  setPlatform("android");
                  setShowPlatformPicker(false);
                }}
                className={[
                  "flex-1 rounded-xl border px-3 py-2.5 text-xs font-semibold",
                  platform === "android"
                    ? "border-[var(--student-nav)] bg-[var(--student-nav)]/10 text-[var(--student-text)]"
                    : "border-[var(--student-line)] text-[var(--student-text-muted)]",
                ].join(" ")}
              >
                Android (Samsung, Pixel…)
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowPlatformPicker(true)}
            className="mt-3 text-xs font-medium text-[var(--student-nav)] hover:underline"
          >
            Not right? Pick device
          </button>
        )}

        {platform === "ios" ? (
          <IosInstructions tripName={tripName} />
        ) : (
          <AndroidInstructions tripName={tripName} showManualSteps={!canPromptInstall} />
        )}

        {platform === "android" && canPromptInstall ? (
          <button
            type="button"
            onClick={() => void onInstallClick()}
            disabled={installing}
            className="student-btn-primary mt-6 h-11 w-full text-sm disabled:opacity-50"
          >
            {installing ? "Installing…" : "Install app"}
          </button>
        ) : null}

        <div className="mt-6 rounded-xl border border-[var(--student-line)] bg-[var(--student-surface)] px-4 py-3 text-center">
          <p className="text-sm font-medium text-[var(--student-text)]">
            Waiting for you to open from your home screen…
          </p>
          <p className="mt-1 text-xs text-[var(--student-text-muted)]">
            This step completes automatically once you launch <strong>{tripName}</strong> from the
            icon you added.
          </p>
        </div>
      </div>
    </main>
  );
}
