"use client";

import { useMemo, useState, type RefObject } from "react";

import { VenueNamePicker } from "@/components/geo/VenueNamePicker";
import { hostJson } from "@/components/host/shared/host-fetch";
import { TimeInput } from "@/components/ui/TimeInput";
import {
  formatActivityTransport,
  parseActivityTransport,
  primaryLeaveByTime,
} from "@/lib/host/activity-transport";

import { ActivityTransportAddon } from "./ActivityTransportAddon";
import { CompactActivityForm } from "./CompactActivityForm";
import type { ItineraryItem, RosterSummary } from "./types";
import { timeToInput } from "./types";

function mapSavedItem(row: ItineraryItem): ItineraryItem {
  return {
    id: row.id,
    tripDayId: row.tripDayId,
    startTime: row.startTime,
    endTime: row.endTime,
    title: row.title,
    locationName: row.locationName,
    address: row.address,
    mapQuery: row.mapQuery ?? null,
    leaveByTime: row.leaveByTime,
    transportNote: row.transportNote,
    bringNote: row.bringNote,
    hostNote: row.hostNote,
    audienceType: row.audienceType,
    audienceId: row.audienceId,
    category: row.category ?? null,
    sortOrder: row.sortOrder,
  };
}

export function ItemForm(props: {
  inviteCode: string;
  dayId: string;
  roster: RosterSummary;
  item?: ItineraryItem;
  countryNames?: string[];
  cityHint?: string;
  hideTimeFields?: boolean;
  compact?: boolean;
  formId?: string;
  hideFooter?: boolean;
  timePickerOverlayRef?: RefObject<HTMLElement | null>;
  onSaved: (item?: ItineraryItem) => void;
  onCancel?: () => void;
  onError: (msg: string) => void;
}) {
  const {
    inviteCode,
    dayId,
    roster,
    item,
    countryNames = [],
    cityHint,
    hideTimeFields,
    compact,
    formId,
    hideFooter,
    timePickerOverlayRef,
    onSaved,
    onCancel,
    onError,
  } = props;
  const api = `/api/host/${encodeURIComponent(inviteCode)}`;
  const editing = Boolean(item);

  const inputClass = compact
    ? "mt-0.5 h-8 w-full rounded-md border border-zinc-200 px-2 text-xs"
    : "mt-1 h-10 w-full rounded-lg border border-zinc-200 px-2 text-sm";

  const [title, setTitle] = useState(item?.title ?? "");
  const [startTime, setStartTime] = useState(item ? timeToInput(item.startTime) : "09:00");
  const [endTime, setEndTime] = useState(item ? timeToInput(item.endTime) : "");
  const [locationName, setLocationName] = useState(item?.locationName ?? "");
  const [address, setAddress] = useState(item?.address ?? "");
  const [transport, setTransport] = useState(() =>
    parseActivityTransport(item?.transportNote ?? null, item?.leaveByTime ?? null),
  );
  const [showMore, setShowMore] = useState(false);
  const [bringNote, setBringNote] = useState(item?.bringNote ?? "");
  const [hostNote, setHostNote] = useState(item?.hostNote ?? "");
  const [audienceType, setAudienceType] = useState<ItineraryItem["audienceType"]>(
    item?.audienceType ?? "everyone",
  );
  const [audienceId, setAudienceId] = useState(item?.audienceId ?? "");
  const [saving, setSaving] = useState(false);

  const initialTab = useMemo(() => {
    if (locationName.trim() || address.trim()) return "location" as const;
    if (formatActivityTransport(transport)) return "transport" as const;
    if (bringNote.trim() || hostNote.trim() || audienceType !== "everyone") {
      return "notes" as const;
    }
    return null;
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...(hideTimeFields && editing && item
        ? {
            startTime: item.startTime,
            endTime: item.endTime,
          }
        : {
            startTime,
            endTime: endTime.trim() || null,
          }),
      title: title.trim(),
      locationName: locationName.trim() || null,
      address: address.trim() || null,
      leaveByTime: primaryLeaveByTime(transport),
      transportNote: formatActivityTransport(transport),
      bringNote: bringNote.trim() || null,
      hostNote: hostNote.trim() || null,
      audienceType,
      audienceId: audienceType === "everyone" ? null : audienceId || null,
      category: null,
    };
    try {
      let saved: ItineraryItem;
      if (editing && item) {
        saved = mapSavedItem(
          await hostJson<ItineraryItem>(`${api}/items/${item.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          }),
        );
      } else {
        saved = mapSavedItem(
          await hostJson<ItineraryItem>(`${api}/days/${dayId}/items`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          }),
        );
      }
      onSaved(saved);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const btnClass = compact
    ? "inline-flex h-8 flex-1 items-center justify-center rounded-lg px-3 text-xs font-medium"
    : "inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-medium";

  if (compact) {
    return (
      <form
        id={formId}
        onSubmit={submit}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <CompactActivityForm
          title={title}
          onTitleChange={setTitle}
          startTime={startTime}
          onStartTimeChange={setStartTime}
          endTime={endTime}
          onEndTimeChange={setEndTime}
          locationName={locationName}
          onLocationNameChange={setLocationName}
          address={address}
          onAddressChange={setAddress}
          transport={transport}
          onTransportChange={setTransport}
          bringNote={bringNote}
          onBringNoteChange={setBringNote}
          hostNote={hostNote}
          onHostNoteChange={setHostNote}
          audienceType={audienceType}
          onAudienceTypeChange={setAudienceType}
          audienceId={audienceId}
          onAudienceIdChange={setAudienceId}
          roster={roster}
          countryNames={countryNames}
          cityHint={cityHint}
          timePickerOverlayRef={timePickerOverlayRef}
          initialTab={initialTab}
        />
        {hideFooter ? null : (
          <div className="mt-3 flex shrink-0 gap-2 border-t border-zinc-100 bg-white pt-2">
            <button
              type="submit"
              disabled={saving}
              className={`${btnClass} bg-zinc-900 text-white disabled:opacity-50`}
            >
              {saving ? "…" : editing ? "Save" : "Add"}
            </button>
            {onCancel ? (
              <button
                type="button"
                onClick={onCancel}
                className={`${btnClass} border border-zinc-200 text-zinc-700`}
              >
                Cancel
              </button>
            ) : null}
          </div>
        )}
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block">
        <span className="text-xs font-medium text-zinc-600">Name</span>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. TeamLab Planets"
          className={inputClass}
        />
      </label>

      {hideTimeFields ? (
        <p className="text-xs text-zinc-500">Times set on timeline.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-zinc-600">Start time</span>
            <TimeInput
              required
              value={startTime}
              onChange={(next) => setStartTime(next ?? "09:00")}
              inputClassName={`${inputClass} shadow-none focus:ring-0`}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-zinc-600">End time</span>
            <TimeInput
              value={endTime || null}
              onChange={(next) => setEndTime(next ?? "")}
              inputClassName={`${inputClass} shadow-none focus:ring-0`}
            />
          </label>
        </div>
      )}

      <label className="block">
        <span className="text-xs font-medium text-zinc-600">Location</span>
        <VenueNamePicker
          value={locationName}
          onChange={setLocationName}
          onSelectVenue={({ name, address: pickedAddress }) => {
            setLocationName(name);
            setAddress(pickedAddress);
          }}
          countryNames={countryNames}
          cityHint={cityHint}
          placeholder="Search Google Maps…"
          inputClassName={inputClass}
        />
      </label>

      <ActivityTransportAddon value={transport} onChange={setTransport} />

      <button
        type="button"
        onClick={() => setShowMore((v) => !v)}
        className="text-xs font-medium text-zinc-600 underline"
      >
        {showMore ? "Hide extra fields" : "Bring note, host note, audience…"}
      </button>

      {showMore ? (
        <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50/60 p-3">
          <label className="block">
            <span className="text-xs font-medium text-zinc-600">Bring</span>
            <input value={bringNote} onChange={(e) => setBringNote(e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-zinc-600">Host note</span>
            <input value={hostNote} onChange={(e) => setHostNote(e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-zinc-600">Audience</span>
            <select
              value={audienceType}
              onChange={(e) => {
                setAudienceType(e.target.value as ItineraryItem["audienceType"]);
                setAudienceId("");
              }}
              className={inputClass}
            >
              <option value="everyone">Everyone</option>
              <option value="group">Group</option>
              <option value="room">Room</option>
              <option value="participant">Participant</option>
            </select>
          </label>
          {audienceType !== "everyone" ? (
            <label className="block">
              <span className="text-xs font-medium text-zinc-600">Target</span>
              <select
                required
                value={audienceId}
                onChange={(e) => setAudienceId(e.target.value)}
                className={inputClass}
              >
                <option value="">Select…</option>
                {audienceType === "group"
                  ? roster.groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))
                  : null}
                {audienceType === "room"
                  ? roster.rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.roomName}
                      </option>
                    ))
                  : null}
                {audienceType === "participant"
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
      ) : null}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className={`${btnClass} bg-zinc-900 text-white disabled:opacity-50`}
        >
          {saving ? "Saving…" : editing ? "Save" : "Add"}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className={`${btnClass} border border-zinc-200 text-zinc-700`}
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
