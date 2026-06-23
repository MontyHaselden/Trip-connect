"use client";

import { useEffect, type ReactNode } from "react";

import { TripEyebrow } from "./TripEyebrow";
import { TripPrimaryButton } from "./TripPrimaryButton";

export function TripConfirmModal(props: {
  open: boolean;
  eyebrow?: string;
  title: string;
  description?: string;
  tone?: "default" | "warning" | "danger";
  cancelLabel?: string;
  confirmLabel: string;
  confirmLoading?: boolean;
  confirmDisabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  children?: ReactNode;
  wide?: boolean;
}) {
  const {
    open,
    eyebrow,
    title,
    description,
    tone = "default",
    cancelLabel = "Cancel",
    confirmLabel,
    confirmLoading,
    confirmDisabled,
    onCancel,
    onConfirm,
    children,
    wide,
  } = props;

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const toneRing =
    tone === "warning"
      ? "ring-amber-200/80"
      : tone === "danger"
        ? "ring-red-200/80"
        : "ring-zinc-200/80";
  const toneAccent =
    tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-950"
      : tone === "danger"
        ? "border-red-200 bg-red-50 text-red-950"
        : "border-violet-200 bg-violet-50 text-violet-950";

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Dismiss"
        className="absolute inset-0 bg-zinc-900/45 backdrop-blur-[2px]"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="trip-confirm-title"
        className={[
          "relative w-full overflow-hidden rounded-2xl bg-white shadow-2xl ring-1",
          wide ? "max-w-lg" : "max-w-md",
          toneRing,
        ].join(" ")}
      >
        <div className={["border-b px-6 py-4", toneAccent].join(" ")}>
          {eyebrow ? (
            <TripEyebrow accent={tone === "default"} className={tone === "default" ? undefined : "text-amber-700"}>
              {eyebrow}
            </TripEyebrow>
          ) : null}
          <h2 id="trip-confirm-title" className="mt-1 text-lg font-semibold tracking-tight">
            {title}
          </h2>
          {description ? <p className="mt-1.5 text-sm leading-relaxed opacity-90">{description}</p> : null}
        </div>

        {children ? <div className="px-6 py-5">{children}</div> : null}

        <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-100 bg-zinc-50/80 px-6 py-4">
          <TripPrimaryButton variant="ghost" onClick={onCancel} disabled={confirmLoading}>
            {cancelLabel}
          </TripPrimaryButton>
          <TripPrimaryButton
            variant={tone === "danger" ? "dark" : "violet"}
            onClick={onConfirm}
            disabled={confirmLoading || confirmDisabled}
          >
            {confirmLoading ? "Applying…" : confirmLabel}
          </TripPrimaryButton>
        </div>
      </div>
    </div>
  );
}
