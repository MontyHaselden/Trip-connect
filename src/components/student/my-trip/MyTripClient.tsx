"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

import { MyTripErrorBoundary } from "@/components/debug/MyTripErrorBoundary";
import { useTripApp } from "@/components/layout/TripAppContext";
import { resolveAccommodationForDate } from "@/lib/student/resolve-accommodation-for-date";
import { TripNotReady } from "@/components/student/TripNotReady";
import { PhotoGallerySheet } from "@/components/student/photos/PhotoGallerySheet";
import { tripDebug } from "@/lib/debug/trip-debug";
import {
  formatContactsSubtitle,
  formatRoomGroupSummary,
} from "@/lib/student/my-trip-summary";
import {
  hasMyTripProfile,
  resolveStudentTripPayload,
} from "@/lib/student/resolve-trip-payload";
import {
  isTripCacheLoading,
  isTripConnectionError,
  TRIP_CONNECTION_ERROR_MESSAGE,
} from "@/lib/student/trip-load-state";
import { EmergencyCardBanner } from "@/components/student/my-trip/EmergencyCardBanner";
import { EmergencyCardFullView } from "@/components/student/my-trip/EmergencyCardFullView";
import { KeyContactsSheet } from "@/components/student/my-trip/KeyContacts";
import { MyDetailsSheet } from "@/components/student/my-trip/MyDetails";
import { MyTripMenuGroup } from "@/components/student/my-trip/MyTripMenuGroup";
import { MyTripMenuRow } from "@/components/student/my-trip/MyTripMenuRow";
import { MyTripPassHeader } from "@/components/student/my-trip/MyTripPassHeader";
import {
  MyTripPhotoSection,
  usePhotoGalleryByDay,
} from "@/components/student/my-trip/MyTripPhotoSection";
import { RoomGroupsSheet } from "@/components/student/my-trip/MyGroupsRooms";
import { PhraseCategoriesSheet } from "@/components/student/my-trip/PhraseCategoriesSheet";
import { PhraseCategorySheet } from "@/components/student/my-trip/PhraseCategorySheet";

type ActiveSheet =
  | "details"
  | "room"
  | "contacts"
  | "phrases"
  | "gallery"
  | "emergency"
  | null;

function MyTripScroll({ children }: { children: React.ReactNode }) {
  return (
    <main className="student-app-scroll no-scrollbar flex min-h-0 flex-1 flex-col gap-5 overflow-x-hidden overflow-y-auto overscroll-y-contain py-1">
      {children}
    </main>
  );
}

function MyTripPageContent() {
  const pathname = usePathname();
  const { cache, participantPhotos, todayNav } = useTripApp();
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
  const [selectedPhraseCategoryId, setSelectedPhraseCategoryId] = useState<string | null>(
    null,
  );

  const trip = useMemo(
    () => resolveStudentTripPayload(cache.payload, cache.participantId),
    [cache.payload, cache.participantId],
  );

  const tripNotPublished =
    cache.version === 0 ||
    (cache.version === null &&
      !trip &&
      (cache.status === "up_to_date" || cache.status === "ready"));

  const emergencyContacts = useMemo(() => {
    if (!trip) return [];
    const contacts = trip.contacts ?? [];
    const leads = contacts.filter((c) => c.isEmergencyLead);
    return leads.length ? leads : contacts;
  }, [trip]);

  const room = trip?.room
    ? { roomName: trip.room.roomName, roommates: trip.room.roommates ?? [] }
    : null;
  const groups = trip?.groups ?? [];
  const contacts = trip?.contacts ?? [];
  const phraseCategories = trip?.phraseCategories ?? [];
  const phrases = trip?.phrases ?? [];

  const roomGroupSummary = formatRoomGroupSummary({
    roomName: room?.roomName,
    groups,
  });
  const hasRoomOrGroups = Boolean(room || groups.length);

  const phraseCategoryCount = useMemo(() => {
    const ids = new Set(phrases.map((p) => p.categoryId));
    return phraseCategories.filter((c) => ids.has(c.id)).length;
  }, [phraseCategories, phrases]);

  const selectedCategory = useMemo(
    () => phraseCategories.find((c) => c.id === selectedPhraseCategoryId) ?? null,
    [phraseCategories, selectedPhraseCategoryId],
  );

  const categoryPhrases = useMemo(
    () => phrases.filter((p) => p.categoryId === selectedPhraseCategoryId),
    [phrases, selectedPhraseCategoryId],
  );

  const galleryByDay = usePhotoGalleryByDay(trip?.days ?? [], participantPhotos);

  const emergencyAccommodationDate =
    todayNav?.selectedDateISO ?? trip?.days[0]?.date ?? trip?.trip.startDate ?? null;

  const emergencyAccommodation = useMemo(() => {
    if (!trip || !cache.participantId || !emergencyAccommodationDate) return null;
    const acc = resolveAccommodationForDate(
      trip,
      cache.participantId,
      emergencyAccommodationDate,
    );
    if (!acc) {
      if (!trip.room) return null;
      return {
        name: trip.room.hotelName,
        address: trip.room.hotelAddress,
        phone: trip.room.hotelPhone ?? null,
        nearestStation: trip.room.nearestStation,
        nearestStationNotes: trip.room.nearestStationNotes ?? null,
        nearestBusStopName: trip.room.nearestBusStopName ?? null,
        routeNotes: trip.room.routeNotesToAccommodation ?? null,
        mapsUrl: trip.room.mapsUrl ?? null,
        staticMapUrl: trip.room.staticMapUrl ?? null,
      };
    }
    return {
      name: acc.name,
      address: acc.address,
      phone: acc.phone ?? acc.hotelPhone ?? null,
      nearestStation: acc.nearestStation ?? null,
      nearestStationNotes: acc.nearestStationNotes ?? null,
      nearestBusStopName: acc.nearestBusStopName ?? null,
      routeNotes: acc.routeNotesToAccommodation ?? null,
      mapsUrl: acc.mapsUrl ?? null,
      staticMapUrl: acc.staticMapUrl ?? null,
    };
  }, [trip, cache.participantId, emergencyAccommodationDate]);

  useEffect(() => {
    tripDebug("my-trip.mount", {
      pathname,
      status: cache.status,
      sessionReady: cache.sessionReady,
      hasProfile: hasMyTripProfile(trip),
    });
  }, [pathname, cache.status, cache.sessionReady, trip]);

  if (isTripCacheLoading(cache)) {
    return (
      <MyTripScroll>
        <p className="text-sm text-[var(--student-text-muted)]">Loading trip…</p>
      </MyTripScroll>
    );
  }

  if (isTripConnectionError(cache)) {
    return (
      <MyTripScroll>
        <p className="text-sm text-[var(--student-text-muted)]">
          {cache.message ?? TRIP_CONNECTION_ERROR_MESSAGE}
        </p>
      </MyTripScroll>
    );
  }

  if (tripNotPublished && !trip) {
    return (
      <MyTripScroll>
        <TripNotReady title="My Trip" hasJoined={Boolean(cache.participantId)} />
      </MyTripScroll>
    );
  }

  if (!hasMyTripProfile(trip)) {
    return (
      <MyTripScroll>
        <p className="text-sm text-[var(--student-text-muted)]">Loading trip profile…</p>
      </MyTripScroll>
    );
  }

  return (
    <>
      <MyTripScroll>
        <MyTripPassHeader
          tripName={trip.trip.name}
          fullName={trip.participant.fullName}
          role={trip.participant.role}
          roomName={room?.roomName}
          groups={groups}
        />

        <EmergencyCardBanner onOpen={() => setActiveSheet("emergency")} />

        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--student-text-muted)]">
            Trip info
          </p>
          <MyTripMenuGroup>
            <MyTripMenuRow
              title="My details"
              subtitle={trip.participant.phoneNumberE164}
              onClick={() => setActiveSheet("details")}
            />
            {hasRoomOrGroups ? (
              <MyTripMenuRow
                title="My room & groups"
                subtitle={roomGroupSummary ?? undefined}
                onClick={() => setActiveSheet("room")}
              />
            ) : null}
            <MyTripMenuRow
              title="Key contacts"
              subtitle={formatContactsSubtitle(contacts)}
              onClick={() => setActiveSheet("contacts")}
            />
            <MyTripMenuRow
              title="Emergency phrases"
              subtitle={
                phraseCategoryCount > 0
                  ? `${phraseCategoryCount} categor${phraseCategoryCount === 1 ? "y" : "ies"}`
                  : "No phrases yet"
              }
              onClick={() => setActiveSheet("phrases")}
            />
          </MyTripMenuGroup>
        </div>

        <MyTripPhotoSection
          tripId={trip.trip.id}
          days={trip.days}
          tripTimezone={trip.trip.timezone}
          onOpenGallery={() => setActiveSheet("gallery")}
        />
      </MyTripScroll>

      <MyDetailsSheet
        open={activeSheet === "details"}
        onClose={() => setActiveSheet(null)}
        fullName={trip.participant.fullName}
        phoneNumberE164={trip.participant.phoneNumberE164}
        role={trip.participant.role}
        participantId={trip.participant.id}
      />

      <RoomGroupsSheet
        open={activeSheet === "room"}
        onClose={() => setActiveSheet(null)}
        groups={groups}
        room={room}
      />

      <KeyContactsSheet
        open={activeSheet === "contacts"}
        onClose={() => setActiveSheet(null)}
        contacts={contacts}
      />

      <PhotoGallerySheet
        open={activeSheet === "gallery"}
        onClose={() => setActiveSheet(null)}
        tripTimezone={trip.trip.timezone}
        galleryByDay={galleryByDay}
      />

      <EmergencyCardFullView
        open={activeSheet === "emergency"}
        onClose={() => setActiveSheet(null)}
        tripName={trip.trip.name}
        schoolName={trip.trip.schoolName}
        studentName={trip.participant.fullName}
        localEmergencyNumber={trip.trip.localEmergencyNumber ?? null}
        schoolEmergencyPhone={trip.trip.schoolEmergencyPhone ?? null}
        emergencyContacts={emergencyContacts.map((c) => ({
          name: c.name,
          role: c.role,
          phoneNumber: c.phoneNumber,
        }))}
        accommodation={emergencyAccommodation}
        phraseCategories={phraseCategories}
        phrases={phrases}
      />

      <PhraseCategoriesSheet
        open={activeSheet === "phrases"}
        onClose={() => setActiveSheet(null)}
        categories={phraseCategories}
        phrases={phrases}
        onSelectCategory={(id) => setSelectedPhraseCategoryId(id)}
      />

      <PhraseCategorySheet
        open={selectedPhraseCategoryId !== null}
        onClose={() => setSelectedPhraseCategoryId(null)}
        categoryName={selectedCategory?.name ?? "Phrases"}
        phrases={categoryPhrases}
      />
    </>
  );
}

export function MyTripClient() {
  return (
    <MyTripErrorBoundary>
      <MyTripPageContent />
    </MyTripErrorBoundary>
  );
}
