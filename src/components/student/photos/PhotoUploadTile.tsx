"use client";

import { useRef, useState } from "react";

async function compressImage(file: File, maxWidth = 1200): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.82);
  });
}

export function PhotoUploadTile(props: {
  tripId: string;
  tripDayId: string;
  type: "selfie" | "place";
  title: string;
  helper?: string;
  previewUrl?: string | null;
  onUploaded: () => void;
}) {
  const {
    tripId,
    tripDayId,
    type,
    title,
    helper = "Select from camera roll",
    previewUrl,
    onUploaded,
  } = props;
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const token = localStorage.getItem("tc_access_token");
      const compressed = await compressImage(file);
      const form = new FormData();
      form.append("tripId", tripId);
      form.append("tripDayId", tripDayId);
      form.append("type", type);
      form.append("file", compressed, "photo.jpg");
      const res = await fetch("/api/photos/upload", {
        method: "POST",
        headers: token ? { authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Upload failed");
      }
      onUploaded();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message.includes("fetch") || err.message.includes("network")
            ? "You appear to be offline. Try again when connected."
            : err.message
          : "Upload failed",
      );
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  if (previewUrl) {
    return (
      <div className="relative min-h-[7rem] w-full overflow-hidden rounded-xl border border-[var(--student-line)] bg-[var(--student-surface)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={previewUrl} alt={title} className="h-full min-h-[7rem] w-full object-cover" />
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-2 text-left text-[10px] font-semibold text-white"
        >
          {busy ? "Uploading…" : "Change photo"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          disabled={busy}
          onChange={onChange}
          className="sr-only"
        />
        {error ? (
          <p className="absolute inset-x-2 bottom-8 text-[10px] text-red-200">{error}</p>
        ) : null}
      </div>
    );
  }

  return (
    <label className="student-upload-tile relative w-full cursor-pointer">
      <input
        type="file"
        accept="image/*"
        disabled={busy}
        onChange={onChange}
        className="sr-only"
      />
      {busy ? (
        <span className="text-xs font-medium text-[var(--student-text-muted)]">Uploading…</span>
      ) : (
        <>
          <span className="text-xs font-semibold text-[var(--student-text)]">{title}</span>
          <span className="text-[10px] leading-snug text-[var(--student-text-muted)]">
            {helper}
          </span>
        </>
      )}
      {error ? (
        <span className="absolute inset-x-2 bottom-2 text-[10px] text-red-600">{error}</span>
      ) : null}
    </label>
  );
}
