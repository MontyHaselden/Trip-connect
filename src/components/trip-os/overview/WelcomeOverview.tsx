"use client";

import { tripNameNeedsAttention } from "@/lib/host/setup/trip-naming";
import type { TripEntityGraph } from "@/lib/trip-engine/types";

import { TripActionRow } from "../shared/TripActionRow";
import { TripEyebrow } from "../shared/TripEyebrow";
import { TripInput } from "../shared/TripInput";
import type { TripOsSection } from "../TripOsWorkspace";

export function WelcomeOverview(props: {
  graph: TripEntityGraph;
  metaLine: string;
  onUpdateName: (name: string) => void;
  onNavigateSection?: (section: TripOsSection) => void;
}) {
  const needsName = tripNameNeedsAttention(props.graph.basics.name);

  return (
    <div className="relative mx-auto max-w-lg py-2">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-20 -top-16 h-72 w-72 rounded-full bg-gradient-to-br from-violet-400/25 via-fuchsia-300/10 to-transparent blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 top-40 h-56 w-56 rounded-full bg-gradient-to-bl from-sky-300/20 to-transparent blur-3xl"
      />

      <div className="relative">
        <TripEyebrow accent>Welcome</TripEyebrow>

        <TripInput
          variant="hero"
          value={props.graph.basics.name}
          onChange={(e) => props.onUpdateName(e.target.value)}
          placeholder="Name your trip"
          className={needsName ? "text-zinc-400" : ""}
        />

        <p className="mt-5 max-w-md text-[1.05rem] leading-relaxed text-zinc-500">
          Sketch the trip today — cities, stays, and travel — then refine it into a complete
          itinerary whenever you&apos;re ready.
        </p>

        <p className="mt-3 text-sm text-zinc-400">{props.metaLine}</p>

        <div className="mt-12">
          <TripEyebrow>Start here</TripEyebrow>
          <div className="mt-2 space-y-0.5">
            <TripActionRow
              label="Paint cities on the calendar"
              hint="Tap days on the right — Tokyo, Kyoto, home, anywhere the group goes."
              accent="violet"
              icon="pin"
              onClick={() => props.onNavigateSection?.("locations")}
            />
            <TripActionRow
              label="Drop in a hotel or stay"
              hint="Already booked? Select the nights and add the property."
              accent="sky"
              icon="stay"
              onClick={() => props.onNavigateSection?.("accommodation")}
            />
          </div>
        </div>

        <div className="mt-8 border-t border-zinc-100 pt-6">
          <TripEyebrow>Or</TripEyebrow>
          <div className="mt-2 space-y-0.5">
            <TripActionRow
              label="Import a document"
              hint="PDF, spreadsheet, or email — AI reads it for you."
              accent="indigo"
              icon="import"
              onClick={() => props.onNavigateSection?.("ingest")}
            />
            <TripActionRow
              label="Add flights later"
              hint="Outbound, return, and between-city legs when you have them."
              accent="zinc"
              icon="plane"
              onClick={() => props.onNavigateSection?.("transport")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
