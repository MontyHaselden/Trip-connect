export type PublishedTripSnapshotV1 = {
  version: number;
  publishedAt: string; // ISO
  trip: {
    id: string;
    name: string;
    schoolName: string;
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
    destinationCountry: string | null;
    destinationLanguage: string | null;
    timezone: string;
    publishedVersion: number;
  };
  days: Array<{
    id: string;
    date: string; // YYYY-MM-DD
    cityLabel: string;
    summary: string | null;
    sortOrder: number;
  }>;
  itineraryItems: Array<{
    id: string;
    tripDayId: string;
    startTime: string; // HH:MM:SS
    endTime: string | null;
    title: string;
    locationName: string | null;
    address: string | null;
    mapQuery: string | null;
    leaveByTime: string | null;
    transportNote: string | null;
    bringNote: string | null;
    hostNote: string | null;
    audienceType: "everyone" | "group" | "room" | "participant";
    audienceId: string | null;
    sortOrder: number;
  }>;
  tomorrowPrepItems: Array<{
    id: string;
    tripDayId: string;
    text: string;
    sortOrder: number;
  }>;
  contacts: Array<{
    id: string;
    name: string;
    role: string;
    phoneNumber: string;
    visibility: "students" | "hosts_only";
    sortOrder: number;
    isEmergencyLead: boolean;
  }>;
  participants: Array<{
    id: string;
    fullName: string;
    phoneNumberE164: string;
    role: "student" | "helper" | "teacher" | "host";
  }>;
  groups: Array<{
    id: string;
    name: string;
    type: "activity" | "bus" | "week" | "other";
    description: string | null;
    sortOrder: number;
  }>;
  participantGroups: Array<{ participantId: string; groupId: string }>;
  rooms: Array<{
    id: string;
    roomName: string;
    hotelName: string | null;
    hotelAddress: string | null;
    nearestStation: string | null;
    notes: string | null;
    sortOrder: number;
  }>;
  participantRooms: Array<{ participantId: string; roomId: string }>;
  phraseCategories: Array<{ id: string; name: string; sortOrder: number }>;
  phrases: Array<{
    id: string;
    categoryId: string;
    englishText: string;
    translatedText: string;
    pronunciation: string | null;
    notes: string | null;
    source: "default" | "ai" | "host";
    sortOrder: number;
  }>;
};

