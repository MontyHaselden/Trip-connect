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

export const hostAccountRole = pgEnum("host_account_role", [
  "teacher",
  "helper",
  "host",
  "admin",
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
    // Legacy: replaced by host_accounts + host_trip_members. Kept for backwards compatibility.
    hostCodeHash: text("host_code_hash"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    destinationCountry: text("destination_country"),
    destinationLanguage: text("destination_language"),
    timezone: text("timezone").notNull(),
    defaultCountryCallingCode: text("default_country_calling_code").notNull(),
    publishedVersion: integer("published_version").notNull().default(0),
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (m) => ({
    pk: primaryKey({ columns: [m.hostId, m.tripId] }),
    tripIdx: index("host_trip_members_trip_id_idx").on(m.tripId),
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
    summary: text("summary"),
    sortOrder: integer("sort_order").notNull(),
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
    sortOrder: integer("sort_order").notNull(),
  },
  (i) => ({
    daySortIndex: index("itinerary_items_trip_day_id_sort_order_idx").on(
      i.tripDayId,
      i.sortOrder,
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

