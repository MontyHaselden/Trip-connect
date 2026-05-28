"use client";

import { useMemo, useState } from "react";

import { useTripCache } from "@/hooks/useTripCache";
import { TripNotReady } from "@/components/student/TripNotReady";
import type { ParticipantFilteredTripV1 } from "@/lib/publish/filter-for-participant";
import { MyDetails } from "@/components/student/my-trip/MyDetails";
import { MyGroupsRooms } from "@/components/student/my-trip/MyGroupsRooms";
import { KeyContacts } from "@/components/student/my-trip/KeyContacts";
import { EmergencyCard } from "@/components/student/my-trip/EmergencyCard";
import { PhraseList } from "@/components/student/my-trip/PhraseList";

function isTripPayload(x: unknown): x is ParticipantFilteredTripV1 {
  if (!x || typeof x !== "object") return false;
  const o = x as { trip?: unknown; participant?: unknown };
  return Boolean(o.trip && o.participant);
}

export default function MyTripPage() {
  const cache = useTripCache();
  const trip = isTripPayload(cache.payload) ? cache.payload : null;
  const [refreshing, setRefreshing] = useState(false);

  const tripNotPublished =
    cache.version === 0 ||
    (cache.version === null &&
      !trip &&
      (cache.status === "up_to_date" || cache.status === "ready"));

  async function onRefresh() {
    setRefreshing(true);
    try {
      await cache.refresh();
    } finally {
      setRefreshing(false);
    }
  }

  const leadContact = useMemo(() => {
    if (!trip) return null;
    const lead = trip.contacts.find((c) => c.isEmergencyLead);
    return lead ?? trip.contacts[0] ?? null;
  }, [trip]);

  if (cache.status === "offline_no_cache") {
    return (
      <main className="flex flex-col gap-4 py-6">
        <h1 className="text-2xl font-semibold tracking-tight">My Trip</h1>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-700">
            Connect to the internet once to download the trip.
          </p>
        </div>
      </main>
    );
  }

  if (tripNotPublished && !trip) {
    return (
      <TripNotReady
        title="My Trip"
        onRefresh={cache.online ? onRefresh : undefined}
        refreshing={refreshing}
      />
    );
  }

  if (!trip) {
    return (
      <main className="flex flex-col gap-4 py-6">
        <h1 className="text-2xl font-semibold tracking-tight">My Trip</h1>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-700">Loading trip…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-4 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">My Trip</h1>
        <p className="text-sm text-zinc-600">{trip.trip.name}</p>
      </header>

      <MyDetails
        fullName={trip.participant.fullName}
        phoneNumberE164={trip.participant.phoneNumberE164}
        role={trip.participant.role}
      />

      <MyGroupsRooms
        groups={trip.groups}
        room={trip.room ? { roomName: trip.room.roomName, roommates: trip.room.roommates } : null}
      />

      <KeyContacts contacts={trip.contacts} />

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

      <PhraseList categories={trip.phraseCategories} phrases={trip.phrases} />
    </main>
  );
}

