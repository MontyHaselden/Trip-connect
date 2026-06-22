import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
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
  "route",
  "split_travel",
  "accommodation",
  "staff_helper",
  "other",
]);

export const visibilityMode = pgEnum("visibility_mode", [
  "everyone",
  "staff_only",
  "viewers_only",
  "hidden_from_students",
  "custom",
]);

export const visibilityEntityType = pgEnum("visibility_entity_type", [
  "itinerary_item",
  "transport_leg",
  "accommodation_stay",
  "day_reminder",
  "prep_item",
  "contact",
  "room",
]);

export const visibilityTargetType = pgEnum("visibility_target_type", [
  "group",
  "participant",
  "room",
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

export const accountType = pgEnum("account_type", [
  "school",
  "personal",
  "organisation_interest",
]);

export const subscriptionPlan = pgEnum("subscription_plan", [
  "school_starter",
  "school_pro",
  "school_pro_plus",
  "personal_one_time",
  "personal",
  "personal_pro",
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

export const costLineCategory = pgEnum("cost_line_category", [
  "flights",
  "transport",
  "insurance",
  "accommodation",
  "meals",
  "activities",
  "other",
]);

export const costAllocationRuleType = pgEnum("cost_allocation_rule_type", [
  "equal_cost_participants",
  "equal_group",
  "equal_present",
  "assign_one",
  "manual",
]);

export const costLineScope = pgEnum("cost_line_scope", ["presence", "trip_wide"]);

export const supplierPaymentStatus = pgEnum("supplier_payment_status", [
  "estimated",
  "invoiced",
  "paid",
]);

export const bookingStatus = pgEnum("booking_status", [
  "booked",
  "not_booked",
  "placeholder",
  "flexible",
  "cancelled",
]);

export const overlayEntityType = pgEnum("overlay_entity_type", [
  "itinerary_item",
  "transport_leg",
  "accommodation_stay",
  "trip_day",
]);

export const overlayOp = pgEnum("overlay_op", ["hide", "replace"]);

export const bookingEntityType = pgEnum("booking_entity_type", [
  "itinerary_item",
  "transport_leg",
  "accommodation_stay",
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
  "campground",
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
    phoneNumberE164: text("phone_number_e164"),
    passwordHash: text("password_hash").notNull(),
    fullName: text("full_name").notNull(),
    role: hostAccountRole("role").notNull(),
    accountType: accountType("account_type").notNull().default("school"),
    plan: subscriptionPlan("plan").notNull().default("school_starter"),
    schoolName: text("school_name"),
    jobTitle: text("job_title"),
    homeCity: text("home_city"),
    defaultAirport: text("default_airport"),
    planExpiresAt: timestamp("plan_expires_at", { withTimezone: true }),
    linkedParticipantId: uuid("linked_participant_id"),
    billingContactName: text("billing_contact_name"),
    billingEmail: text("billing_email"),
    billingAddress: text("billing_address"),
    xeroContactId: text("xero_contact_id"),
    foundingSchool: boolean("founding_school").notNull().default(false),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    internalNotes: text("internal_notes"),
    overrideAiBuilder: boolean("override_ai_builder"),
    overrideViewerLinks: boolean("override_viewer_links"),
    overridePhotoGallery: boolean("override_photo_gallery"),
    overrideActiveTripLimit: integer("override_active_trip_limit"),
    overrideStaffLimit: integer("override_staff_limit"),
    subscriptionId: uuid("subscription_id"),
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
    localEmergencyNumber: text("local_emergency_number"),
    schoolEmergencyPhone: text("school_emergency_phone"),
    setupMethod: tripSetupMethod("setup_method").default("ai"),
    departureCity: text("departure_city"),
    returnCity: text("return_city"),
    defaultDepartureAirport: text("default_departure_airport"),
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

export const tripAssistantSessions = pgTable("trip_assistant_sessions", {
  tripId: uuid("trip_id")
    .primaryKey()
    .references(() => trips.id, { onDelete: "cascade" }),
  messagesJson: jsonb("messages_json").notNull().default([]),
  sourceText: text("source_text"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const tripCostSettings = pgTable("trip_cost_settings", {
  tripId: uuid("trip_id")
    .primaryKey()
    .references(() => trips.id, { onDelete: "cascade" }),
  baseCurrency: text("base_currency").notNull().default("NZD"),
  foreignCurrency: text("foreign_currency"),
  exchangeRate: numeric("exchange_rate", { precision: 12, scale: 6 }),
  exchangeRateDate: date("exchange_rate_date"),
  exchangeRateManual: boolean("exchange_rate_manual").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const costLineItems = pgTable(
  "cost_line_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    category: costLineCategory("category").notNull(),
    description: text("description").notNull(),
    notes: text("notes"),
    totalAmountCents: integer("total_amount_cents").notNull().default(0),
    currency: text("currency").notNull().default("NZD"),
    quantity: numeric("quantity", { precision: 10, scale: 2 }),
    allocationRuleType: costAllocationRuleType("allocation_rule_type")
      .notNull()
      .default("equal_cost_participants"),
    allocationRulePayload: jsonb("allocation_rule_payload").notNull().default({}),
    linkedStayId: uuid("linked_stay_id"),
    linkedTransportLegId: uuid("linked_transport_leg_id"),
    linkedActivityId: uuid("linked_activity_id"),
    scope: costLineScope("scope").notNull().default("presence"),
    supplierPaymentStatus: supplierPaymentStatus("supplier_payment_status"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    tripIdx: index("cost_line_items_trip_idx").on(t.tripId),
  }),
);

export const costAllocationOverrides = pgTable(
  "cost_allocation_overrides",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    lineItemId: uuid("line_item_id")
      .notNull()
      .references(() => costLineItems.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    lineParticipantUnique: uniqueIndex("cost_allocation_overrides_line_participant_unique").on(
      t.lineItemId,
      t.participantId,
    ),
  }),
);

export const tripFunds = pgTable(
  "trip_funds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("NZD"),
    allocationRuleType: costAllocationRuleType("allocation_rule_type")
      .notNull()
      .default("equal_cost_participants"),
    allocationRulePayload: jsonb("allocation_rule_payload").notNull().default({}),
    sortOrder: integer("sort_order").notNull().default(0),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    tripIdx: index("trip_funds_trip_idx").on(t.tripId),
  }),
);

export const participantPayments = pgTable(
  "participant_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("NZD"),
    paidAt: date("paid_at").notNull(),
    label: text("label").notNull().default("deposit"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    tripIdx: index("participant_payments_trip_idx").on(t.tripId),
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
    visibilityMode: visibilityMode("visibility_mode").notNull().default("everyone"),
    category: activityCategory("category"),
    sortOrder: integer("sort_order").notNull(),
    bookingStatus: bookingStatus("booking_status"),
    wizardSource: wizardSource("wizard_source"),
    isTimeTbc: boolean("is_time_tbc").notNull().default(false),
    isLocationTbc: boolean("is_location_tbc").notNull().default(false),
    originGroupId: uuid("origin_group_id").references(() => groups.id, {
      onDelete: "set null",
    }),
    sourceEntityId: uuid("source_entity_id"),
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
    visibilityMode: visibilityMode("visibility_mode").notNull().default("everyone"),
    originGroupId: uuid("origin_group_id").references(() => groups.id, {
      onDelete: "set null",
    }),
    sourceEntityId: uuid("source_entity_id"),
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
    googlePlaceId: text("google_place_id"),
    latitude: numeric("latitude"),
    longitude: numeric("longitude"),
    checkInDate: date("check_in_date").notNull(),
    checkOutDate: date("check_out_date").notNull(),
    notes: text("notes"),
    isHomestayGroup: boolean("is_homestay_group").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    visibilityMode: visibilityMode("visibility_mode").notNull().default("everyone"),
    originGroupId: uuid("origin_group_id").references(() => groups.id, {
      onDelete: "set null",
    }),
    sourceEntityId: uuid("source_entity_id"),
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
    visibilityMode: visibilityMode("visibility_mode").notNull().default("everyone"),
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
    visibilityMode: visibilityMode("visibility_mode").notNull().default("everyone"),
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
    joinedViaGroupInviteLinkId: uuid("joined_via_group_invite_link_id"),
    inCostSplit: boolean("in_cost_split").notNull().default(true),
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
    visibilityMode: visibilityMode("visibility_mode").notNull().default("everyone"),
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
    isMain: boolean("is_main").notNull().default(false),
    inheritMode: text("inherit_mode"),
    personalForParticipantId: uuid("personal_for_participant_id").references(
      () => participants.id,
      { onDelete: "set null" },
    ),
  },
  (g) => ({
    tripSortIndex: index("groups_trip_id_sort_order_idx").on(
      g.tripId,
      g.sortOrder,
    ),
    personalParticipantIdx: index("groups_personal_participant_idx").on(
      g.personalForParticipantId,
    ),
  }),
);

export const tripFinanceDismissals = pgTable(
  "trip_finance_dismissals",
  {
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.tripId, t.entityType, t.entityId] }),
    tripIdx: index("trip_finance_dismissals_trip_idx").on(t.tripId),
  }),
);

export const groupDayPlaces = pgTable(
  "group_day_places",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    primaryCity: text("primary_city").notNull().default(""),
    secondaryCity: text("secondary_city"),
    primaryShare: numeric("primary_share", { precision: 4, scale: 3 })
      .notNull()
      .default("1"),
    dayType: tripDayType("day_type").default("trip"),
    calendarLabel: text("calendar_label"),
    weatherLocationQuery: text("weather_location_query"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (gdp) => ({
    tripGroupDateUnique: uniqueIndex("group_day_places_trip_group_date_unique").on(
      gdp.tripId,
      gdp.groupId,
      gdp.date,
    ),
    tripGroupIdx: index("group_day_places_trip_group_idx").on(gdp.tripId, gdp.groupId),
  }),
);

export const groupOverlayOps = pgTable(
  "group_overlay_ops",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    entityType: overlayEntityType("entity_type").notNull(),
    baseEntityId: uuid("base_entity_id").notNull(),
    op: overlayOp("op").notNull(),
    replacementEntityId: uuid("replacement_entity_id"),
    effectiveFrom: date("effective_from"),
    effectiveTo: date("effective_to"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (go) => ({
    uniqueOp: uniqueIndex("group_overlay_ops_unique").on(
      go.tripId,
      go.groupId,
      go.entityType,
      go.baseEntityId,
      go.op,
    ),
    tripGroupIdx: index("group_overlay_ops_trip_group_idx").on(go.tripId, go.groupId),
  }),
);

export const entityBookingDetails = pgTable(
  "entity_booking_details",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    entityType: bookingEntityType("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    bookingStatus: bookingStatus("booking_status").notNull().default("not_booked"),
    supplier: text("supplier"),
    bookingReference: text("booking_reference"),
    invoiceNumber: text("invoice_number"),
    invoiceFileUrl: text("invoice_file_url"),
    confirmationFileUrl: text("confirmation_file_url"),
    amountCents: integer("amount_cents"),
    currency: text("currency").default("NZD"),
    paymentStatus: text("payment_status"),
    dueDate: date("due_date"),
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    internalNotes: text("internal_notes"),
    externalRouteId: text("external_route_id"),
    routeLastCheckedAt: timestamp("route_last_checked_at", { withTimezone: true }),
    routeStatus: text("route_status"),
    routeWarning: text("route_warning"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (ebd) => ({
    entityUnique: uniqueIndex("entity_booking_details_entity_unique").on(
      ebd.entityType,
      ebd.entityId,
    ),
    tripIdx: index("entity_booking_details_trip_idx").on(ebd.tripId),
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
    effectiveFrom: date("effective_from"),
    effectiveTo: date("effective_to"),
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
    hotelPhone: text("hotel_phone"),
    nearestStationNotes: text("nearest_station_notes"),
    nearestBusStopName: text("nearest_bus_stop_name"),
    routeNotesToAccommodation: text("route_notes_to_accommodation"),
    staticMapUrl: text("static_map_url"),
    mapsUrl: text("maps_url"),
    notes: text("notes"),
    sortOrder: integer("sort_order").notNull().default(0),
    visibilityMode: visibilityMode("visibility_mode").notNull().default("everyone"),
  },
  (r) => ({
    tripSortIndex: index("rooms_trip_id_sort_order_idx").on(r.tripId, r.sortOrder),
  }),
);

export const visibilityTargets = pgTable(
  "visibility_targets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    entityType: visibilityEntityType("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    targetType: visibilityTargetType("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
  },
  (vt) => ({
    tripEntityIdx: index("visibility_targets_trip_entity_idx").on(
      vt.tripId,
      vt.entityType,
      vt.entityId,
    ),
    entityTargetUnique: uniqueIndex("visibility_targets_entity_target_unique").on(
      vt.entityType,
      vt.entityId,
      vt.targetType,
      vt.targetId,
    ),
  }),
);

export const groupInviteLinks = pgTable(
  "group_invite_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    inviteCode: text("invite_code").notNull(),
    label: text("label").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (g) => ({
    inviteCodeUnique: uniqueIndex("group_invite_links_invite_code_unique").on(g.inviteCode),
    tripIdx: index("group_invite_links_trip_id_idx").on(g.tripId),
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

export const adminRole = pgEnum("admin_role", [
  "super_admin",
  "admin",
  "support",
]);

export const billingStatus = pgEnum("billing_status", [
  "trial",
  "active",
  "manual",
  "past_due",
  "cancelled",
  "expired",
  "comped",
]);

export const invoiceStatus = pgEnum("invoice_status", [
  "draft",
  "issued",
  "sent",
  "paid",
  "overdue",
  "void",
  "cancelled",
]);

export const paymentProvider = pgEnum("payment_provider", [
  "manual",
  "stripe",
  "payshare",
  "none",
]);

export const enforcementMode = pgEnum("enforcement_mode", ["soft", "hard"]);

export const gstDisplayMode = pgEnum("gst_display_mode", [
  "plus_gst",
  "inc_gst",
]);

export const payshareSessionStatus = pgEnum("payshare_session_status", [
  "pending",
  "completed",
  "expired",
  "cancelled",
]);

export const adminUsers = pgTable(
  "admin_users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    fullName: text("full_name").notNull(),
    role: adminRole("role").notNull().default("admin"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (a) => ({
    emailUnique: uniqueIndex("admin_users_email_unique").on(a.email),
  }),
);

export const plans = pgTable(
  "plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    accountType: accountType("account_type").notNull(),
    basePriceCents: integer("base_price_cents").notNull().default(0),
    billingPeriod: text("billing_period").notNull().default("year"),
    staffAccountLimit: integer("staff_account_limit").notNull().default(1),
    activeTripLimit: integer("active_trip_limit").notNull().default(1),
    groupSizeLimit: integer("group_size_limit"),
    aiBuilderEnabled: boolean("ai_builder_enabled").notNull().default(false),
    aiPhrasesEnabled: boolean("ai_phrases_enabled").notNull().default(false),
    schoolToolsEnabled: boolean("school_tools_enabled").notNull().default(false),
    viewerAccessEnabled: boolean("viewer_access_enabled").notNull().default(true),
    photoGalleryEnabled: boolean("photo_gallery_enabled").notNull().default(true),
    payshareEnabled: boolean("payshare_enabled").notNull().default(false),
    visible: boolean("visible").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    badge: text("badge"),
    publicDescription: text("public_description"),
    featureList: jsonb("feature_list").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (p) => ({
    codeUnique: uniqueIndex("plans_code_unique").on(p.code),
  }),
);

export const platformSettings = pgTable("platform_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedByAdminId: uuid("updated_by_admin_id").references(() => adminUsers.id, {
    onDelete: "set null",
  }),
});

export const priceOverrides = pgTable(
  "price_overrides",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => hostAccounts.id, { onDelete: "cascade" }),
    basePriceCents: integer("base_price_cents").notNull(),
    gstBehaviour: text("gst_behaviour").notNull().default("standard"),
    startsAt: timestamp("starts_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    reason: text("reason"),
    internalNotes: text("internal_notes"),
    lockedPrice: boolean("locked_price").notNull().default(false),
    createdByAdminId: uuid("created_by_admin_id").references(() => adminUsers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (o) => ({
    accountIdx: index("price_overrides_account_id_idx").on(o.accountId),
  }),
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => hostAccounts.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id),
    billingStatus: billingStatus("billing_status").notNull().default("manual"),
    paymentProvider: paymentProvider("payment_provider")
      .notNull()
      .default("manual"),
    startsAt: timestamp("starts_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    renewsAt: timestamp("renews_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    basePriceCents: integer("base_price_cents").notNull(),
    gstRate: numeric("gst_rate", { precision: 5, scale: 4 }).notNull().default("0.15"),
    gstAmountCents: integer("gst_amount_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull().default(0),
    priceOverrideId: uuid("price_override_id").references(() => priceOverrides.id, {
      onDelete: "set null",
    }),
    foundingPriceLocked: boolean("founding_price_locked").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (s) => ({
    accountIdx: index("subscriptions_account_id_idx").on(s.accountId),
  }),
);

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => hostAccounts.id, { onDelete: "cascade" }),
    subscriptionId: uuid("subscription_id").references(() => subscriptions.id, {
      onDelete: "set null",
    }),
    planId: uuid("plan_id").references(() => plans.id, { onDelete: "set null" }),
    invoiceNumber: text("invoice_number").notNull(),
    issueDate: date("issue_date").notNull().defaultNow(),
    dueDate: date("due_date").notNull(),
    currency: text("currency").notNull().default("NZD"),
    subtotalCents: integer("subtotal_cents").notNull(),
    gstRate: numeric("gst_rate", { precision: 5, scale: 4 }).notNull().default("0.15"),
    gstAmountCents: integer("gst_amount_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    status: invoiceStatus("status").notNull().default("draft"),
    paymentProvider: paymentProvider("payment_provider")
      .notNull()
      .default("manual"),
    paymentReference: text("payment_reference"),
    pdfUrl: text("pdf_url"),
    internalNotes: text("internal_notes"),
    xeroInvoiceId: text("xero_invoice_id"),
    xeroContactId: text("xero_contact_id"),
    xeroStatus: text("xero_status"),
    xeroLastSyncedAt: timestamp("xero_last_synced_at", { withTimezone: true }),
    xeroError: text("xero_error"),
    createdByAdminId: uuid("created_by_admin_id").references(() => adminUsers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (i) => ({
    numberUnique: uniqueIndex("invoices_number_unique").on(i.invoiceNumber),
    accountIdx: index("invoices_account_id_idx").on(i.accountId),
    statusIdx: index("invoices_status_idx").on(i.status),
  }),
);

export const payshareSessions = pgTable(
  "payshare_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => hostAccounts.id, { onDelete: "cascade" }),
    tripId: uuid("trip_id").references(() => trips.id, { onDelete: "set null" }),
    planId: uuid("plan_id").references(() => plans.id, { onDelete: "set null" }),
    sessionId: text("session_id").notNull(),
    amountCents: integer("amount_cents").notNull(),
    splitAmountCents: integer("split_amount_cents"),
    groupSize: integer("group_size"),
    status: payshareSessionStatus("status").notNull().default("pending"),
    checkoutUrl: text("checkout_url"),
    payshareExternalId: text("payshare_external_id"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (p) => ({
    sessionIdUnique: uniqueIndex("payshare_sessions_session_id_unique").on(p.sessionId),
  }),
);

export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    adminUserId: uuid("admin_user_id").references(() => adminUsers.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    beforeJson: jsonb("before_json"),
    afterJson: jsonb("after_json"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (a) => ({
    createdAtIdx: index("admin_audit_log_created_at_idx").on(a.createdAt),
    entityIdx: index("admin_audit_log_entity_idx").on(a.entityType, a.entityId),
  }),
);

export const aiUsageEvents = pgTable(
  "ai_usage_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => hostAccounts.id, { onDelete: "cascade" }),
    tripId: uuid("trip_id").references(() => trips.id, { onDelete: "set null" }),
    eventType: text("event_type").notNull().default("chat"),
    callCount: integer("call_count").notNull().default(1),
    estimatedCostCents: integer("estimated_cost_cents").notNull().default(0),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (e) => ({
    accountIdx: index("ai_usage_events_account_id_idx").on(e.accountId),
  }),
);

