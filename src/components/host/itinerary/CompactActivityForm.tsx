"use client";

import { useMemo, useState, type RefObject } from "react";

import { VenueNamePicker } from "@/components/geo/VenueNamePicker";
import { TimeInput } from "@/components/ui/TimeInput";
import {
  formatActivityTransport,
  type ActivityTransportDraft,
} from "@/lib/host/activity-transport";

import { ActivityTransportPanel } from "./ActivityTransportPanel";
import type { ItineraryItem, RosterSummary } from "./types";

type ExtraTab = "location" | "transport" | "notes";

const inputClass =
  "mt-0.5 h-8 w-full rounded-md border border-zinc-200 px-2 text-xs focus:border-zinc-400 focus:outline-none";

function TabChip({
  label,
  active,
  filled,
  onClick,
}: {
  label: string;
  active: boolean;
  filled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "relative flex-1 rounded-md py-1.5 text-[11px] font-medium transition",
        active
          ? "bg-zinc-900 text-white"
          : filled
            ? "bg-zinc-100 text-zinc-800"
            : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700",
      ].join(" ")}
    >
      {label}
      {filled && !active ? (
        <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-sky-400" />
      ) : null}
    </button>
  );
}

export function CompactActivityForm(props: {
  title: string;
  onTitleChange: (v: string) => void;
  startTime: string;
  onStartTimeChange: (v: string) => void;
  endTime: string;
  onEndTimeChange: (v: string) => void;
  locationName: string;
  onLocationNameChange: (v: string) => void;
  address: string;
  onAddressChange: (v: string) => void;
  transport: ActivityTransportDraft;
  onTransportChange: (v: ActivityTransportDraft) => void;
  bringNote: string;
  onBringNoteChange: (v: string) => void;
  hostNote: string;
  onHostNoteChange: (v: string) => void;
  audienceType: ItineraryItem["audienceType"];
  onAudienceTypeChange: (v: ItineraryItem["audienceType"]) => void;
  audienceId: string;
  onAudienceIdChange: (v: string) => void;
  roster: RosterSummary;
  countryNames: string[];
  cityHint?: string;
  timePickerOverlayRef?: RefObject<HTMLElement | null>;
  initialTab?: ExtraTab | null;
}) {
  const {
    title,
    onTitleChange,
    startTime,
    onStartTimeChange,
    endTime,
    onEndTimeChange,
    locationName,
    onLocationNameChange,
    address,
    onAddressChange,
    transport,
    onTransportChange,
    bringNote,
    onBringNoteChange,
    hostNote,
    onHostNoteChange,
    audienceType,
    onAudienceTypeChange,
    audienceId,
    onAudienceIdChange,
    roster,
    countryNames,
    cityHint,
    timePickerOverlayRef,
    initialTab,
  } = props;

  const [tab, setTab] = useState<ExtraTab | null>(initialTab ?? null);

  const hasLocation = Boolean(locationName.trim() || address.trim());
  const hasTransport = Boolean(formatActivityTransport(transport));
  const hasNotes = Boolean(
    bringNote.trim() || hostNote.trim() || audienceType !== "everyone",
  );

  const tabs = useMemo(
    () =>
      [
        { id: "location" as const, label: "Place", filled: hasLocation },
        { id: "transport" as const, label: "Travel", filled: hasTransport },
        { id: "notes" as const, label: "Notes", filled: hasNotes },
      ],
    [hasLocation, hasTransport, hasNotes],
  );

  function pickTab(next: ExtraTab) {
    setTab((cur) => (cur === next ? null : next));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <label className="block shrink-0">
        <span className="text-[11px] font-medium text-zinc-600">Name</span>
        <input
          required
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="What is it?"
          className={inputClass}
          autoFocus
        />
      </label>

      <div className="mt-2 grid shrink-0 grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[11px] font-medium text-zinc-600">Arrive</span>
          <TimeInput
            required
            value={startTime}
            onChange={(next) => onStartTimeChange(next ?? "09:00")}
            overlayAnchorRef={timePickerOverlayRef}
            inputClassName={`${inputClass} shadow-none focus:ring-0`}
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-medium text-zinc-600">Depart</span>
          <TimeInput
            value={endTime || null}
            onChange={(next) => onEndTimeChange(next ?? "")}
            overlayAnchorRef={timePickerOverlayRef}
            inputClassName={`${inputClass} shadow-none focus:ring-0`}
          />
        </label>
      </div>

      <div className="mt-3 flex shrink-0 gap-1 rounded-lg bg-zinc-50 p-0.5">
        {tabs.map((t) => (
          <TabChip
            key={t.id}
            label={t.label}
            active={tab === t.id}
            filled={t.filled}
            onClick={() => pickTab(t.id)}
          />
        ))}
      </div>

      <div className="mt-2 min-h-0 flex-1 overflow-hidden rounded-lg border border-zinc-100 bg-zinc-50/50">
        <div className="h-full overflow-y-auto px-2 py-2">
        {!tab ? (
          <div className="flex min-h-[5.5rem] flex-col items-center justify-center gap-1 text-center">
            <p className="text-[11px] font-medium text-zinc-500">Optional extras</p>
            <p className="text-[10px] leading-snug text-zinc-400">
              Place search · travel time · notes
            </p>
          </div>
        ) : null}

        {tab === "location" ? (
          <div className="flex min-h-[5.5rem] flex-col gap-1.5 py-0.5">
            <VenueNamePicker
              value={locationName}
              onChange={onLocationNameChange}
              onSelectVenue={({ name, address: picked }) => {
                onLocationNameChange(name);
                onAddressChange(picked);
              }}
              countryNames={countryNames}
              cityHint={cityHint}
              placeholder="Search Google Maps…"
              inputClassName={inputClass}
            />
            {address ? (
              <p className="truncate text-[10px] text-zinc-500" title={address}>
                {address}
              </p>
            ) : (
              <p className="text-[10px] text-zinc-400">Pick from search — address fills in</p>
            )}
            {hasLocation ? (
              <button
                type="button"
                onClick={() => {
                  onLocationNameChange("");
                  onAddressChange("");
                }}
                className="self-start text-[10px] font-medium text-zinc-400 hover:text-zinc-600"
              >
                Clear place
              </button>
            ) : null}
          </div>
        ) : null}

        {tab === "transport" ? (
          <ActivityTransportPanel
            value={transport}
            onChange={onTransportChange}
            timePickerOverlayRef={timePickerOverlayRef}
          />
        ) : null}

        {tab === "notes" ? (
          <div className="flex min-h-[5.5rem] flex-col gap-2 py-0.5">
            <input
              value={bringNote}
              onChange={(e) => onBringNoteChange(e.target.value)}
              placeholder="Bring…"
              className={inputClass}
            />
            <input
              value={hostNote}
              onChange={(e) => onHostNoteChange(e.target.value)}
              placeholder="Host note…"
              className={inputClass}
            />
            <select
              value={audienceType}
              onChange={(e) => {
                onAudienceTypeChange(e.target.value as ItineraryItem["audienceType"]);
                onAudienceIdChange("");
              }}
              className={inputClass}
            >
              <option value="everyone">Everyone</option>
              <option value="group">Group</option>
              <option value="room">Room</option>
              <option value="participant">Participant</option>
            </select>
            {audienceType !== "everyone" ? (
              <select
                required
                value={audienceId}
                onChange={(e) => onAudienceIdChange(e.target.value)}
                className={inputClass}
              >
                <option value="">Who…</option>
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
            ) : null}
          </div>
        ) : null}
        </div>
      </div>
    </div>
  );
}
