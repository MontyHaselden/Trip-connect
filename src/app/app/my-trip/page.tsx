"use client";

import { useMemo } from "react";

import { useTripApp } from "@/components/layout/TripAppContext";
import { TripNotReady } from "@/components/student/TripNotReady";
import type { ParticipantFilteredTripV1 } from "@/lib/publish/filter-for-participant";
import { MyDetails } from "@/components/student/my-trip/MyDetails";
import { MyGroupsRooms } from "@/components/student/my-trip/MyGroupsRooms";
import { KeyContacts } from "@/components/student/my-trip/KeyContacts";
import { EmergencyCard } from "@/components/student/my-trip/EmergencyCard";
import { PhraseList } from "@/components/student/my-trip/PhraseList";

function isTripPayload(x: unknown): x is ParticipantFilteredTripV1 {
  if (!x || typeof x !== "object") return false;
  const o = x as { trip?: unknown; participant?: unknown; days?: unknown };
  return Boolean(o.trip && o.participant && o.days);
}

function MyTripScroll({ children }: { children: React.ReactNode }) {
  return (
    <main className="no-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto overscroll-y-contain py-2 [-webkit-overflow-scrolling:touch]">
      {children}
    </main>
  );
}

export default function MyTripPage() {
  const { cache } = useTripApp();
  const trip = isTripPayload(cache.payload) ? cache.payload : null;

  const tripNotPublished =
    cache.version === 0 ||
    (cache.version === null &&
      !trip &&
      (cache.status === "up_to_date" || cache.status === "ready"));

  const leadContact = useMemo(() => {
    if (!trip) return null;
    const lead = trip.contacts.find((c) => c.isEmergencyLead);
    return lead ?? trip.contacts[0] ?? null;
  }, [trip]);

  if (!cache.sessionReady) {
    return (
      <MyTripScroll>
        <header className="shrink-0">
          <h2 className="text-lg font-semibold tracking-tight">My Trip</h2>
        </header>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-700">Loading trip…</p>
        </div>
      </MyTripScroll>
    );
  }

  if (cache.status === "offline_no_cache") {
    return (
      <MyTripScroll>
        <header className="shrink-0">
          <h2 className="text-lg font-semibold tracking-tight">My Trip</h2>
        </header>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-700">
            Connect to the internet once to download the trip.
          </p>
        </div>
      </MyTripScroll>
    );
  }

  if (tripNotPublished && !trip) {
    return (
      <MyTripScroll>
        <TripNotReady title="My Trip" />
      </MyTripScroll>
    );
  }

  if (!trip) {
    return (
      <MyTripScroll>
        <header className="shrink-0">
          <h2 className="text-lg font-semibold tracking-tight">My Trip</h2>
        </header>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-700">Loading trip…</p>
        </div>
      </MyTripScroll>
    );
  }

  return (
    <MyTripScroll>
      <header className="flex shrink-0 flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight">My Trip</h2>
        <p className="break-words text-sm text-zinc-600">{trip.trip.name}</p>
      </header>

      <MyDetails
        fullName={trip.participant.fullName}
        phoneNumberE164={trip.participant.phoneNumberE164}
        role={trip.participant.role}
      />

      <KeyContacts contacts={trip.contacts} />

      <PhraseList categories={trip.phraseCategories} phrases={trip.phrases} />

      <MyGroupsRooms
        groups={trip.groups}
        room={
          trip.room
            ? { roomName: trip.room.roomName, roommates: trip.room.roommates }
            : null
        }
      />

      <EmergencyCard
        tripName={trip.trip.name}
        schoolName={trip.trip.schoolName}
        studentName={trip.participant.fullName}
        leadContact={leadContact}
        hotel={
          trip.room
            ? {
                name: trip.room.hotelName,
                address: trip.room.hotelAddress,
                nearestStation: trip.room.nearestStation,
              }
            : null
        }
      />
    </MyTripScroll>
  );
}
