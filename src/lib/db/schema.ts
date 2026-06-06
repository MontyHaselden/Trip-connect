import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const participantRole = pgEnum("participant_role", [
  "student",
  "helper",
  "teacher",
  "host",
]);

export const contactVisibility = pgEnum("contact_visibility", [
  "students",
  "hosts_only",
]);

export const itineraryAudienceType = pgEnum("itinerary_audience_type", [
  "everyone",
  "group",
  "room",
  "participant",
]);

export const groupType = pgEnum("group_type", [
  "activity",
  "bus",
  "week",
  "other",
]);

export const phraseSource = pgEnum("phrase_source", ["default", "ai", "host"]);

export const activityCategory = pgEnum("activity_category", [
  "travel",
  "meal",
  "school",
  "activity",
  "free_time",
  "hotel",
  "meeting",
  "important",
  "other",
]);

export const weatherSnapshotStatus = pgEnum("weather_snapshot_status", [
  "available",
  "too_far",
  "unavailable",
]);

export const hostAccountRole = pgEnum("host_account_role", [
  "teacher",
  "helper",
  "host",
  "admin",
]);

export const mobileTokenPurpose = pgEnum("mobile_token_purpose", [
  "host_admin",
  "host_trip",
  "student_invite",
]);

export const tripSetupMethod = pgEnum("trip_setup_method", ["ai", "wizard"]);

export const tripDayType = pgEnum("trip_day_type", [
  "trip",
  "travel",
  "meeting",
  "free",
  "buffer",
  "return",
]);

export const bookingStatus = pgEnum("booking_status", [
  "booked",
  "not_booked",
  "placeholder",
]);

export const wizardSource = pgEnum("wizard_source", [
  "outbound",
  "return",
  "intercity",
  "activity",
  "meeting",
  "accommodation",
]);

export const accommodationStayType = pgEnum("accommodation_stay_type", [
  "hotel",
  "hostel",
  "homestay",
  "multiple_hosts",
  "multiple_hotels",
  "not_booked",
  "other",
]);

export const transportLegKind = pgEnum("transport_leg_kind", [
  "outbound",
  "return",
  "intercity",
]);

export const transportType = pgEnum("transport_type", [
  "plane",
  "train",
  "bus",
  "coach",
  "ferry",
  "car",
  "taxi",
  "walking",
  "other",
]);

export const hostAccounts = pgTable(
  "host_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    phoneNumberE164: text("phone_number_e164").notNull(),
    passwordHash: text("password_hash").notNull(),
    fullName: text("full_name").notNull(),
    role: hostAccountRole("role").notNull(),
    linkedParticipantId: uuid("linked_participant_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (h) => ({
    emailUnique: uniqueIndex("host_accounts_email_unique").on(h.email),
    phoneUnique: uniqueIndex("host_accounts_phone_e164_unique").on(h.phoneNumberE164),
  }),
);

export const trips = pgTable(
  "trips",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    schoolName: text("school_name").notNull(),
    inviteCode: text("invite_code").notNull(),
    viewerCode: text("viewer_code").notNull(),
    viewerGalleryEnabled: boolean("viewer_gallery_enabled").notNull().default(false),
    viewerRoomDetailsEnabled: boolean("viewer_room_details_enabled")
      .notNull()
      .default(false),
    studentGalleryEnabled: boolean("student_gallery_enabled").notNull().default(true),
    // Legacy: replaced by host_accounts + host_trip_members. Kept for backwards compatibility.
    hostCodeHash: text("host_code_hash"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    destinationCountry: text("destination_country"),
    destinationLanguage: text("destination_language"),
    timezone: text("timezone").notNull(),
    defaultCountryCallingCode: text("default_country_calling_code").notNull(),
    publishedVersion: integer("published_version").notNull().default(0),
    setupMethod: tripSetupMethod("setup_method").default("ai"),
    departureCity: text("departure_city"),
    returnCity: text("return_city"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => ({
    inviteCodeUnique: uniqueIndex("trips_invite_code_unique").on(t.inviteCode),
    viewerCodeUnique: uniqueIndex("trips_viewer_code_unique").on(t.viewerCode),
  }),
);

export const photoType = pgEnum("photo_type", ["selfie", "place"]);

export const photoStatus = pgEnum("photo_status", ["visible", "hidden", "deleted"]);

export const aiProposalStatus = pgEnum("ai_proposal_status", [
  "draft",
  "applied",
  "rejected",
]);

export const tripPhotos = pgTable(
  "trip_photos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    tripDayId: uuid("trip_day_id")
      .notNull()
      .references(() => tripDays.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    type: photoType("type").notNull(),
    imageUrl: text("image_url").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    caption: text("caption"),
    status: photoStatus("status").notNull().default("visible"),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedBy: uuid("deleted_by"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (p) => ({
    dayParticipantTypeIdx: index("trip_photos_day_participant_type_idx").on(
      p.tripDayId,
      p.participantId,
      p.type,
    ),
  }),
);

export const aiChangeProposals = pgTable(
  "ai_change_proposals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => hostAccounts.id, { onDelete: "cascade" }),
    userMessage: text("user_message").notNull(),
    assistantReply: text("assistant_reply").notNull(),
    proposedChangesJson: jsonb("proposed_changes_json").notNull(),
    warningsJson: jsonb("warnings_json"),
    status: aiProposalStatus("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
  },
  (p) => ({
    tripStatusIdx: index("ai_change_proposals_trip_status_idx").on(p.tripId, p.status),
  }),
);

export const hostTripMembers = pgTable(
  "host_trip_members",
  {
    hostId: uuid("host_id")
      .notNull()
      .references(() => hostAccounts.id, { onDelete: "cascade" }),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    canEdit: boolean("can_edit").notNull().default(true),
    invitedEmail: text("invited_email"),
    invitedAt: timestamp("invited_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (m) => ({
    pk: primaryKey({ columns: [m.hostId, m.tripId] }),
    tripIdx: index("host_trip_members_trip_id_idx").on(m.tripId),
  }),
);

export const hostTripInvites = pgTable(
  "host_trip_invites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    invitedEmail: text("invited_email").notNull(),
    canEdit: boolean("can_edit").notNull().default(true),
    invitedByHostId: uuid("invited_by_host_id").references(() => hostAccounts.id, {
      onDelete: "set null",
    }),
    invitedAt: timestamp("invited_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (i) => ({
    tripEmailUnique: uniqueIndex("host_trip_invites_trip_email_unique").on(
      i.tripId,
      i.invitedEmail,
    ),
  }),
);

export const tripDays = pgTable(
  "trip_days",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    cityLabel: text("city_label").notNull(),
    calendarLabel: text("calendar_label"),
    summary: text("summary"),
    sortOrder: integer("sort_order").notNull(),
    dayType: tripDayType("day_type").default("trip"),
    secondaryCityLabel: text("secondary_city_label"),
    isBufferDay: boolean("is_buffer_day").notNull().default(false),
    weatherLocationQuery: text("weather_location_query"),
  },
  (d) => ({
    tripDateUnique: uniqueIndex("trip_days_trip_id_date_unique").on(
      d.tripId,
      d.date,
    ),
    tripSortIndex: index("trip_days_trip_id_sort_order_idx").on(
      d.tripId,
      d.sortOrder,
    ),
  }),
);

export const itineraryItems = pgTable(
  "itinerary_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    tripDayId: uuid("trip_day_id")
      .notNull()
      .references(() => tripDays.id, { onDelete: "cascade" }),
    startTime: time("start_time").notNull(),
    endTime: time("end_time"),
    title: text("title").notNull(),
    locationName: text("location_name"),
    address: text("address"),
    mapQuery: text("map_query"),
    leaveByTime: time("leave_by_time"),
    transportNote: text("transport_note"),
    bringNote: text("bring_note"),
    hostNote: text("host_note"),
    audienceType: itineraryAudienceType("audience_type").notNull(),
    audienceId: uuid("audience_id"),
    category: activityCategory("category"),
    sortOrder: integer("sort_order").notNull(),
    bookingStatus: bookingStatus("booking_status"),
    wizardSource: wizardSource("wizard_source"),
    isTimeTbc: boolean("is_time_tbc").notNull().default(false),
    isLocationTbc: boolean("is_location_tbc").notNull().default(false),
  },
  (i) => ({
    daySortIndex: index("itinerary_items_trip_day_id_sort_order_idx").on(
      i.tripDayId,
      i.sortOrder,
    ),
  }),
);

export const tripWizardDrafts = pgTable("trip_wizard_drafts", {
  tripId: uuid("trip_id")
    .primaryKey()
    .references(() => trips.id, { onDelete: "cascade" }),
  currentStep: integer("current_step").notNull().default(1),
  draftJson: jsonb("draft_json").notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const tripTransportLegs = pgTable(
  "trip_transport_legs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    legKind: transportLegKind("leg_kind").notNull(),
    transportType: transportType("transport_type").notNull(),
    bookingStatus: bookingStatus("booking_status").notNull().default("not_booked"),
    travelDate: date("travel_date").notNull(),
    departureTime: time("departure_time"),
    arrivalTime: time("arrival_time"),
    fromCity: text("from_city"),
    toCity: text("to_city"),
    fromStation: text("from_station"),
    toStation: text("to_station"),
    operator: text("operator"),
    referenceNumber: text("reference_number"),
    flightNumber: text("flight_number"),
    notes: text("notes"),
    intercityFromCity: text("intercity_from_city"),
    intercityToCity: text("intercity_to_city"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (l) => ({
    tripSortIndex: index("trip_transport_legs_trip_id_sort_order_idx").on(
      l.tripId,
      l.sortOrder,
    ),
  }),
);

export const tripAccommodationStays = pgTable(
  "trip_accommodation_stays",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    cityLabel: text("city_label").notNull(),
    stayType: accommodationStayType("stay_type").notNull().default("hotel"),
    name: text("name"),
    url: text("url"),
    address: text("address"),
    phone: text("phone"),
    checkInDate: date("check_in_date").notNull(),
    checkOutDate: date("check_out_date").notNull(),
    notes: text("notes"),
    isHomestayGroup: boolean("is_homestay_group").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (s) => ({
    tripSortIndex: index("trip_accommodation_stays_trip_id_sort_order_idx").on(
      s.tripId,
      s.sortOrder,
    ),
  }),
);

export const accommodationAssignments = pgTable(
  "accommodation_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    stayId: uuid("stay_id")
      .notNull()
      .references(() => tripAccommodationStays.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id").references(() => participants.id, {
      onDelete: "cascade",
    }),
    groupId: uuid("group_id").references(() => groups.id, { onDelete: "cascade" }),
    roomId: uuid("room_id").references(() => rooms.id, { onDelete: "cascade" }),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
  },
  (a) => ({
    stayIdx: index("accommodation_assignments_stay_id_idx").on(a.stayId),
  }),
);

export const tripDayReminders = pgTable(
  "trip_day_reminders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    tripDayId: uuid("trip_day_id")
      .notNull()
      .references(() => tripDays.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    reminderTime: time("reminder_time"),
    note: text("note"),
    audienceType: itineraryAudienceType("audience_type").notNull().default("everyone"),
    audienceId: uuid("audience_id"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (r) => ({
    daySortIndex: index("trip_day_reminders_trip_day_id_sort_order_idx").on(
      r.tripDayId,
      r.sortOrder,
    ),
  }),
);

export const tomorrowPrepItems = pgTable(
  "tomorrow_prep_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    tripDayId: uuid("trip_day_id")
      .notNull()
      .references(() => tripDays.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    sortOrder: integer("sort_order").notNull(),
  },
  (p) => ({
    daySortIndex: index("tomorrow_prep_items_trip_day_id_sort_order_idx").on(
      p.tripDayId,
      p.sortOrder,
    ),
  }),
);

export const participants = pgTable(
  "participants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    phoneNumberE164: text("phone_number_e164").notNull(),
    role: participantRole("role").notNull(),
    accessToken: text("access_token").notNull(),
    passwordHash: text("password_hash"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (p) => ({
    tripPhoneUnique: uniqueIndex("participants_trip_id_phone_e164_unique").on(
      p.tripId,
      p.phoneNumberE164,
    ),
    accessTokenUnique: uniqueIndex("participants_access_token_unique").on(
      p.accessToken,
    ),
    tripNamePhoneIdx: index("participants_trip_id_name_phone_idx").on(
      p.tripId,
      p.fullName,
      p.phoneNumberE164,
    ),
  }),
);

export const mobileAccessTokens = pgTable(
  "mobile_access_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    hostId: uuid("host_id").references(() => hostAccounts.id, {
      onDelete: "cascade",
    }),
    participantId: uuid("participant_id").references(() => participants.id, {
      onDelete: "cascade",
    }),
    purpose: mobileTokenPurpose("purpose").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    tokenHashUnique: uniqueIndex("mobile_access_tokens_token_hash_unique").on(
      t.tokenHash,
    ),
    tripPurposeIdx: index("mobile_access_tokens_trip_purpose_idx").on(
      t.tripId,
      t.purpose,
    ),
  }),
);

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    role: text("role").notNull(),
    phoneNumber: text("phone_number").notNull(),
    visibility: contactVisibility("visibility").notNull(),
    sortOrder: integer("sort_order").notNull(),
    isEmergencyLead: boolean("is_emergency_lead").notNull().default(false),
  },
  (c) => ({
    tripSortIndex: index("contacts_trip_id_sort_order_idx").on(
      c.tripId,
      c.sortOrder,
    ),
  }),
);

export const groups = pgTable(
  "groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: groupType("type").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (g) => ({
    tripSortIndex: index("groups_trip_id_sort_order_idx").on(
      g.tripId,
      g.sortOrder,
    ),
  }),
);

export const participantGroups = pgTable(
  "participant_groups",
  {
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
  },
  (pg) => ({
    pk: primaryKey({ columns: [pg.participantId, pg.groupId] }),
    groupIdx: index("participant_groups_group_id_idx").on(pg.groupId),
  }),
);

export const rooms = pgTable(
  "rooms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    roomName: text("room_name").notNull(),
    hotelName: text("hotel_name"),
    hotelAddress: text("hotel_address"),
    nearestStation: text("nearest_station"),
    notes: text("notes"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (r) => ({
    tripSortIndex: index("rooms_trip_id_sort_order_idx").on(r.tripId, r.sortOrder),
  }),
);

export const participantRooms = pgTable(
  "participant_rooms",
  {
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
  },
  (pr) => ({
    pk: primaryKey({ columns: [pr.participantId, pr.roomId] }),
    roomIdx: index("participant_rooms_room_id_idx").on(pr.roomId),
  }),
);

export const emergencyPhraseCategories = pgTable(
  "emergency_phrase_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull(),
  },
  (c) => ({
    tripSortIndex: index("phrase_categories_trip_id_sort_order_idx").on(
      c.tripId,
      c.sortOrder,
    ),
  }),
);

export const emergencyPhrases = pgTable(
  "emergency_phrases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => emergencyPhraseCategories.id, { onDelete: "cascade" }),
    englishText: text("english_text").notNull(),
    translatedText: text("translated_text").notNull(),
    pronunciation: text("pronunciation"),
    notes: text("notes"),
    source: phraseSource("source").notNull(),
    sortOrder: integer("sort_order").notNull(),
  },
  (p) => ({
    catSortIndex: index("emergency_phrases_category_id_sort_order_idx").on(
      p.categoryId,
      p.sortOrder,
    ),
  }),
);

export const dayWeatherSnapshots = pgTable(
  "day_weather_snapshots",
  {
    tripDayId: uuid("trip_day_id")
      .primaryKey()
      .references(() => tripDays.id, { onDelete: "cascade" }),
    locationQuery: text("location_query").notNull(),
    tempC: integer("temp_c"),
    condition: text("condition"),
    advice: text("advice"),
    status: weatherSnapshotStatus("status").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export const publishedTripSnapshots = pgTable(
  "published_trip_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    jsonData: jsonb("json_data").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (s) => ({
    tripVersionUnique: uniqueIndex("published_trip_snapshots_trip_version_unique").on(
      s.tripId,
      s.version,
    ),
    tripVersionIdx: index("published_trip_snapshots_trip_id_version_idx").on(
      s.tripId,
      s.version,
    ),
  }),
);

