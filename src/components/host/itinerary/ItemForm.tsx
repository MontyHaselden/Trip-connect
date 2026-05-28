"use client";

import { useState } from "react";

import { hostJson } from "@/components/host/shared/host-fetch";

import type { ItineraryItem, RosterSummary } from "./types";
import { timeToInput } from "./types";

type AudienceType = ItineraryItem["audienceType"];

const emptyForm = {
  startTime: "09:00",
  endTime: "",
  title: "",
  locationName: "",
  address: "",
  leaveByTime: "",
  transportNote: "",
  bringNote: "",
  hostNote: "",
  audienceType: "everyone" as AudienceType,
  audienceId: "",
};

export function ItemForm(props: {
  inviteCode: string;
  dayId: string;
  roster: RosterSummary;
  item?: ItineraryItem;
  onSaved: () => void;
  onCancel?: () => void;
  onError: (msg: string) => void;
}) {
  const { inviteCode, dayId, roster, item, onSaved, onCancel, onError } = props;
  const api = `/api/host/${encodeURIComponent(inviteCode)}`;
  const editing = Boolean(item);

  const [form, setForm] = useState(() =>
    item
      ? {
          startTime: timeToInput(item.startTime),
          endTime: timeToInput(item.endTime),
          title: item.title,
          locationName: item.locationName ?? "",
          address: item.address ?? "",
          leaveByTime: timeToInput(item.leaveByTime),
          transportNote: item.transportNote ?? "",
          bringNote: item.bringNote ?? "",
          hostNote: item.hostNote ?? "",
          audienceType: item.audienceType,
          audienceId: item.audienceId ?? "",
        }
      : emptyForm,
  );
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      startTime: form.startTime,
      endTime: form.endTime.trim() || null,
      title: form.title.trim(),
      locationName: form.locationName.trim() || null,
      address: form.address.trim() || null,
      leaveByTime: form.leaveByTime.trim() || null,
      transportNote: form.transportNote.trim() || null,
      bringNote: form.bringNote.trim() || null,
      hostNote: form.hostNote.trim() || null,
      audienceType: form.audienceType,
      audienceId:
        form.audienceType === "everyone" ? null : form.audienceId || null,
    };
    try {
      if (editing && item) {
        await hostJson(`${api}/items/${item.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await hostJson(`${api}/days/${dayId}/items`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4"
    >
      <p className="text-sm font-medium">{editing ? "Edit item" : "Add item"}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-zinc-600">Start time</span>
          <input
            type="time"
            required
            value={form.startTime}
            onChange={(e) => set("startTime", e.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-zinc-200 px-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-zinc-600">End time</span>
          <input
            type="time"
            value={form.endTime}
            onChange={(e) => set("endTime", e.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-zinc-200 px-2 text-sm"
          />
        </label>
      </div>
      <label className="mt-3 block">
        <span className="text-xs font-medium text-zinc-600">Title</span>
        <input
          required
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          className="mt-1 h-10 w-full rounded-lg border border-zinc-200 px-2 text-sm"
        />
      </label>
      <label className="mt-3 block">
        <span className="text-xs font-medium text-zinc-600">Location</span>
        <input
          value={form.locationName}
          onChange={(e) => set("locationName", e.target.value)}
          className="mt-1 h-10 w-full rounded-lg border border-zinc-200 px-2 text-sm"
        />
      </label>
      <label className="mt-3 block">
        <span className="text-xs font-medium text-zinc-600">Address</span>
        <input
          value={form.address}
          onChange={(e) => set("address", e.target.value)}
          className="mt-1 h-10 w-full rounded-lg border border-zinc-200 px-2 text-sm"
        />
      </label>
      <label className="mt-3 block">
        <span className="text-xs font-medium text-zinc-600">Leave by</span>
        <input
          type="time"
          value={form.leaveByTime}
          onChange={(e) => set("leaveByTime", e.target.value)}
          className="mt-1 h-10 w-full rounded-lg border border-zinc-200 px-2 text-sm"
        />
      </label>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-zinc-600">Audience</span>
          <select
            value={form.audienceType}
            onChange={(e) => {
              set("audienceType", e.target.value as AudienceType);
              set("audienceId", "");
            }}
            className="mt-1 h-10 w-full rounded-lg border border-zinc-200 px-2 text-sm"
          >
            <option value="everyone">Everyone</option>
            <option value="group">Group</option>
            <option value="room">Room</option>
            <option value="participant">Participant</option>
          </select>
        </label>
        {form.audienceType !== "everyone" ? (
          <label className="block">
            <span className="text-xs font-medium text-zinc-600">Target</span>
            <select
              required
              value={form.audienceId}
              onChange={(e) => set("audienceId", e.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-zinc-200 px-2 text-sm"
            >
              <option value="">Select…</option>
              {form.audienceType === "group"
                ? roster.groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))
                : null}
              {form.audienceType === "room"
                ? roster.rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.roomName}
                    </option>
                  ))
                : null}
              {form.audienceType === "participant"
                ? roster.participants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName}
                    </option>
                  ))
                : null}
            </select>
          </label>
        ) : null}
      </div>
      <label className="mt-3 block">
        <span className="text-xs font-medium text-zinc-600">Bring note</span>
        <input
          value={form.bringNote}
          onChange={(e) => set("bringNote", e.target.value)}
          className="mt-1 h-10 w-full rounded-lg border border-zinc-200 px-2 text-sm"
        />
      </label>
      <label className="mt-3 block">
        <span className="text-xs font-medium text-zinc-600">Host note</span>
        <input
          value={form.hostNote}
          onChange={(e) => set("hostNote", e.target.value)}
          className="mt-1 h-10 w-full rounded-lg border border-zinc-200 px-2 text-sm"
        />
      </label>
      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : editing ? "Update" : "Add"}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-200 px-4 text-sm"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
