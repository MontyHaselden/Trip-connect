CREATE TYPE "public"."contact_visibility" AS ENUM('students', 'hosts_only');--> statement-breakpoint
CREATE TYPE "public"."group_type" AS ENUM('activity', 'bus', 'week', 'other');--> statement-breakpoint
CREATE TYPE "public"."itinerary_audience_type" AS ENUM('everyone', 'group', 'room', 'participant');--> statement-breakpoint
CREATE TYPE "public"."participant_role" AS ENUM('student', 'helper', 'teacher', 'host');--> statement-breakpoint
CREATE TYPE "public"."phrase_source" AS ENUM('default', 'ai', 'host');--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"phone_number" text NOT NULL,
	"visibility" "contact_visibility" NOT NULL,
	"sort_order" integer NOT NULL,
	"is_emergency_lead" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emergency_phrase_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emergency_phrases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"english_text" text NOT NULL,
	"translated_text" text NOT NULL,
	"pronunciation" text,
	"notes" text,
	"source" "phrase_source" NOT NULL,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "group_type" NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "itinerary_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"trip_day_id" uuid NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time,
	"title" text NOT NULL,
	"location_name" text,
	"address" text,
	"map_query" text,
	"leave_by_time" time,
	"transport_note" text,
	"bring_note" text,
	"host_note" text,
	"audience_type" "itinerary_audience_type" NOT NULL,
	"audience_id" uuid,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participant_groups" (
	"participant_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	CONSTRAINT "participant_groups_participant_id_group_id_pk" PRIMARY KEY("participant_id","group_id")
);
--> statement-breakpoint
CREATE TABLE "participant_rooms" (
	"participant_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	CONSTRAINT "participant_rooms_participant_id_room_id_pk" PRIMARY KEY("participant_id","room_id")
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"phone_number_e164" text NOT NULL,
	"role" "participant_role" NOT NULL,
	"access_token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "published_trip_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"json_data" jsonb NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"room_name" text NOT NULL,
	"hotel_name" text,
	"hotel_address" text,
	"nearest_station" text,
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tomorrow_prep_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"trip_day_id" uuid NOT NULL,
	"text" text NOT NULL,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"date" date NOT NULL,
	"city_label" text NOT NULL,
	"summary" text,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"school_name" text NOT NULL,
	"invite_code" text NOT NULL,
	"host_code_hash" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"destination_country" text,
	"destination_language" text,
	"timezone" text NOT NULL,
	"default_country_calling_code" text NOT NULL,
	"published_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emergency_phrase_categories" ADD CONSTRAINT "emergency_phrase_categories_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emergency_phrases" ADD CONSTRAINT "emergency_phrases_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emergency_phrases" ADD CONSTRAINT "emergency_phrases_category_id_emergency_phrase_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."emergency_phrase_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itinerary_items" ADD CONSTRAINT "itinerary_items_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itinerary_items" ADD CONSTRAINT "itinerary_items_trip_day_id_trip_days_id_fk" FOREIGN KEY ("trip_day_id") REFERENCES "public"."trip_days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_groups" ADD CONSTRAINT "participant_groups_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_groups" ADD CONSTRAINT "participant_groups_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_rooms" ADD CONSTRAINT "participant_rooms_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_rooms" ADD CONSTRAINT "participant_rooms_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_trip_snapshots" ADD CONSTRAINT "published_trip_snapshots_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tomorrow_prep_items" ADD CONSTRAINT "tomorrow_prep_items_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tomorrow_prep_items" ADD CONSTRAINT "tomorrow_prep_items_trip_day_id_trip_days_id_fk" FOREIGN KEY ("trip_day_id") REFERENCES "public"."trip_days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_days" ADD CONSTRAINT "trip_days_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contacts_trip_id_sort_order_idx" ON "contacts" USING btree ("trip_id","sort_order");--> statement-breakpoint
CREATE INDEX "phrase_categories_trip_id_sort_order_idx" ON "emergency_phrase_categories" USING btree ("trip_id","sort_order");--> statement-breakpoint
CREATE INDEX "emergency_phrases_category_id_sort_order_idx" ON "emergency_phrases" USING btree ("category_id","sort_order");--> statement-breakpoint
CREATE INDEX "groups_trip_id_sort_order_idx" ON "groups" USING btree ("trip_id","sort_order");--> statement-breakpoint
CREATE INDEX "itinerary_items_trip_day_id_sort_order_idx" ON "itinerary_items" USING btree ("trip_day_id","sort_order");--> statement-breakpoint
CREATE INDEX "participant_groups_group_id_idx" ON "participant_groups" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "participant_rooms_room_id_idx" ON "participant_rooms" USING btree ("room_id");--> statement-breakpoint
CREATE UNIQUE INDEX "participants_trip_id_phone_e164_unique" ON "participants" USING btree ("trip_id","phone_number_e164");--> statement-breakpoint
CREATE UNIQUE INDEX "participants_access_token_unique" ON "participants" USING btree ("access_token");--> statement-breakpoint
CREATE INDEX "participants_trip_id_name_phone_idx" ON "participants" USING btree ("trip_id","full_name","phone_number_e164");--> statement-breakpoint
CREATE UNIQUE INDEX "published_trip_snapshots_trip_version_unique" ON "published_trip_snapshots" USING btree ("trip_id","version");--> statement-breakpoint
CREATE INDEX "published_trip_snapshots_trip_id_version_idx" ON "published_trip_snapshots" USING btree ("trip_id","version");--> statement-breakpoint
CREATE INDEX "rooms_trip_id_sort_order_idx" ON "rooms" USING btree ("trip_id","sort_order");--> statement-breakpoint
CREATE INDEX "tomorrow_prep_items_trip_day_id_sort_order_idx" ON "tomorrow_prep_items" USING btree ("trip_day_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "trip_days_trip_id_date_unique" ON "trip_days" USING btree ("trip_id","date");--> statement-breakpoint
CREATE INDEX "trip_days_trip_id_sort_order_idx" ON "trip_days" USING btree ("trip_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "trips_invite_code_unique" ON "trips" USING btree ("invite_code");