DO $$ BEGIN
 CREATE TYPE "public"."trip_setup_method" AS ENUM('ai', 'wizard');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."trip_day_type" AS ENUM('trip', 'travel', 'meeting', 'free', 'buffer', 'return');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."booking_status" AS ENUM('booked', 'not_booked', 'placeholder');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."wizard_source" AS ENUM('outbound', 'return', 'intercity', 'activity', 'meeting', 'accommodation');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."accommodation_stay_type" AS ENUM('hotel', 'hostel', 'homestay', 'multiple_hosts', 'multiple_hotels', 'not_booked', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."transport_leg_kind" AS ENUM('outbound', 'return', 'intercity');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."transport_type" AS ENUM('plane', 'train', 'bus', 'coach', 'ferry', 'car', 'taxi', 'walking', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "setup_method" "trip_setup_method" DEFAULT 'ai';
--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "departure_city" text;
--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "return_city" text;
--> statement-breakpoint
ALTER TABLE "trip_days" ADD COLUMN IF NOT EXISTS "day_type" "trip_day_type" DEFAULT 'trip';
--> statement-breakpoint
ALTER TABLE "trip_days" ADD COLUMN IF NOT EXISTS "secondary_city_label" text;
--> statement-breakpoint
ALTER TABLE "trip_days" ADD COLUMN IF NOT EXISTS "is_buffer_day" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "trip_days" ADD COLUMN IF NOT EXISTS "weather_location_query" text;
--> statement-breakpoint
ALTER TABLE "itinerary_items" ADD COLUMN IF NOT EXISTS "booking_status" "booking_status";
--> statement-breakpoint
ALTER TABLE "itinerary_items" ADD COLUMN IF NOT EXISTS "wizard_source" "wizard_source";
--> statement-breakpoint
ALTER TABLE "itinerary_items" ADD COLUMN IF NOT EXISTS "is_time_tbc" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "itinerary_items" ADD COLUMN IF NOT EXISTS "is_location_tbc" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trip_wizard_drafts" (
	"trip_id" uuid PRIMARY KEY NOT NULL,
	"current_step" integer DEFAULT 1 NOT NULL,
	"draft_json" jsonb DEFAULT '{}' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trip_wizard_drafts" ADD CONSTRAINT "trip_wizard_drafts_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trip_transport_legs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"leg_kind" "transport_leg_kind" NOT NULL,
	"transport_type" "transport_type" NOT NULL,
	"booking_status" "booking_status" DEFAULT 'not_booked' NOT NULL,
	"travel_date" date NOT NULL,
	"departure_time" time,
	"arrival_time" time,
	"from_city" text,
	"to_city" text,
	"from_station" text,
	"to_station" text,
	"operator" text,
	"reference_number" text,
	"flight_number" text,
	"notes" text,
	"intercity_from_city" text,
	"intercity_to_city" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trip_transport_legs" ADD CONSTRAINT "trip_transport_legs_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trip_transport_legs_trip_id_sort_order_idx" ON "trip_transport_legs" USING btree ("trip_id","sort_order");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trip_accommodation_stays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"city_label" text NOT NULL,
	"stay_type" "accommodation_stay_type" DEFAULT 'hotel' NOT NULL,
	"name" text,
	"url" text,
	"address" text,
	"phone" text,
	"check_in_date" date NOT NULL,
	"check_out_date" date NOT NULL,
	"notes" text,
	"is_homestay_group" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trip_accommodation_stays" ADD CONSTRAINT "trip_accommodation_stays_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trip_accommodation_stays_trip_id_sort_order_idx" ON "trip_accommodation_stays" USING btree ("trip_id","sort_order");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accommodation_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stay_id" uuid NOT NULL,
	"participant_id" uuid,
	"group_id" uuid,
	"room_id" uuid,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "accommodation_assignments" ADD CONSTRAINT "accommodation_assignments_stay_id_trip_accommodation_stays_id_fk" FOREIGN KEY ("stay_id") REFERENCES "public"."trip_accommodation_stays"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accommodation_assignments_stay_id_idx" ON "accommodation_assignments" USING btree ("stay_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trip_day_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"trip_day_id" uuid NOT NULL,
	"title" text NOT NULL,
	"reminder_time" time,
	"note" text,
	"audience_type" "itinerary_audience_type" DEFAULT 'everyone' NOT NULL,
	"audience_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trip_day_reminders" ADD CONSTRAINT "trip_day_reminders_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trip_day_reminders" ADD CONSTRAINT "trip_day_reminders_trip_day_id_trip_days_id_fk" FOREIGN KEY ("trip_day_id") REFERENCES "public"."trip_days"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trip_day_reminders_trip_day_id_sort_order_idx" ON "trip_day_reminders" USING btree ("trip_day_id","sort_order");
