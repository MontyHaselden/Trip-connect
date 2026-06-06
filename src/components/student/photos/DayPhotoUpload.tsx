"use client";

import { useState } from "react";

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

export function DayPhotoUpload(props: {
  tripId: string;
  tripDayId: string;
  type: "selfie" | "place";
  label: string;
  onUploaded: () => void;
}) {
  const { tripId, tripDayId, type, label, onUploaded } = props;
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
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className="block rounded-lg border border-dashed border-zinc-300 p-3 text-center text-xs">
      <span className="font-medium text-zinc-700">{label}</span>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        disabled={busy}
        onChange={onChange}
        className="mt-2 block w-full text-xs"
      />
      {busy ? <p className="mt-1 text-zinc-500">Uploading…</p> : null}
      {error ? <p className="mt-1 text-red-600">{error}</p> : null}
    </label>
  );
}
