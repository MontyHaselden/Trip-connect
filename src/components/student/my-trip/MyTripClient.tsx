"use client";

import { useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";

import { MyTripErrorBoundary } from "@/components/debug/MyTripErrorBoundary";
import { useTripApp } from "@/components/layout/TripAppContext";
import { TripNotReady } from "@/components/student/TripNotReady";
import { tripDebug } from "@/lib/debug/trip-debug";
import {
  hasMyTripProfile,
  resolveStudentTripPayload,
} from "@/lib/student/resolve-trip-payload";
import { MyDetails } from "@/components/student/my-trip/MyDetails";
import { MyGroupsRooms } from "@/components/student/my-trip/MyGroupsRooms";
import { KeyContacts } from "@/components/student/my-trip/KeyContacts";
import { EmergencyCard } from "@/components/student/my-trip/EmergencyCard";
import { PhraseList } from "@/components/student/my-trip/PhraseList";
import { DayPhotoGallery } from "@/components/student/photos/DayPhotoGallery";

function MyTripScroll({ children }: { children: React.ReactNode }) {
  return (
    <main className="no-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto overscroll-y-contain py-2 [-webkit-overflow-scrolling:touch]">
      {children}
    </main>
  );
}

function MyTripPageContent() {
  const pathname = usePathname();
  const { cache } = useTripApp();
  const trip = useMemo(
    () => resolveStudentTripPayload(cache.payload, cache.participantId),
    [cache.payload, cache.participantId],
  );

  const tripNotPublished =
    cache.version === 0 ||
    (cache.version === null &&
      !trip &&
      (cache.status === "up_to_date" || cache.status === "ready"));

  const leadContact = useMemo(() => {
    if (!trip) return null;
    const contacts = trip.contacts ?? [];
    return contacts.find((c) => c.isEmergencyLead) ?? contacts[0] ?? null;
  }, [trip]);

  useEffect(() => {
    tripDebug("my-trip.mount", {
      pathname,
      status: cache.status,
      sessionReady: cache.sessionReady,
      hasProfile: hasMyTripProfile(trip),
    });
  }, [pathname, cache.status, cache.sessionReady, trip]);

  if (!cache.sessionReady) {
    return (
      <MyTripScroll>
        <p className="text-sm text-zinc-700">Loading trip…</p>
      </MyTripScroll>
    );
  }

  if (cache.status === "offline_no_cache") {
    return (
      <MyTripScroll>
        <p className="text-sm text-zinc-700">
          Connect to the internet once to download the trip.
        </p>
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

  if (!hasMyTripProfile(trip)) {
    return (
      <MyTripScroll>
        <p className="text-sm text-zinc-700">Loading trip profile…</p>
      </MyTripScroll>
    );
  }

  return (
    <MyTripScroll>
      <header className="shrink-0">
        <h2 className="text-lg font-semibold tracking-tight">My Trip</h2>
        <p className="text-sm text-zinc-600">{trip.trip.name}</p>
      </header>

      <MyDetails
        fullName={trip.participant.fullName}
        phoneNumberE164={trip.participant.phoneNumberE164}
        role={trip.participant.role}
        participantId={trip.participant.id}
      />

      <KeyContacts contacts={trip.contacts ?? []} />

      <PhraseList categories={trip.phraseCategories ?? []} phrases={trip.phrases ?? []} />

      <MyGroupsRooms
        groups={trip.groups ?? []}
        room={
          trip.room
            ? { roomName: trip.room.roomName, roommates: trip.room.roommates ?? [] }
            : null
        }
      />

      <DayPhotoGallery
        tripId={trip.trip.id}
        days={trip.days}
        tripTimezone={trip.trip.timezone}
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

export function MyTripClient() {
  return (
    <MyTripErrorBoundary>
      <MyTripPageContent />
    </MyTripErrorBoundary>
  );
}
