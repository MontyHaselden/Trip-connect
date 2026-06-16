-- Group layers, overlay ops, flexible booking, admin booking details

ALTER TYPE "group_type" ADD VALUE IF NOT EXISTS 'split_travel';--> statement-breakpoint
ALTER TYPE "group_type" ADD VALUE IF NOT EXISTS 'accommodation';--> statement-breakpoint
ALTER TYPE "group_type" ADD VALUE IF NOT EXISTS 'staff_helper';--> statement-breakpoint

ALTER TYPE "booking_status" ADD VALUE IF NOT EXISTS 'flexible';--> statement-breakpoint
ALTER TYPE "booking_status" ADD VALUE IF NOT EXISTS 'cancelled';--> statement-breakpoint

CREATE TYPE "public"."overlay_entity_type" AS ENUM(
  'itinerary_item',
  'transport_leg',
  'accommodation_stay',
  'trip_day'
);--> statement-breakpoint

CREATE TYPE "public"."overlay_op" AS ENUM('hide', 'replace');--> statement-breakpoint

CREATE TYPE "public"."booking_entity_type" AS ENUM(
  'itinerary_item',
  'transport_leg',
  'accommodation_stay'
);--> statement-breakpoint

ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "is_main" boolean NOT NULL DEFAULT false;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "groups_trip_main_unique"
  ON "groups" ("trip_id")
  WHERE "is_main" = true;--> statement-breakpoint

ALTER TABLE "itinerary_items" ADD COLUMN IF NOT EXISTS "origin_group_id" uuid;--> statement-breakpoint
ALTER TABLE "itinerary_items" ADD COLUMN IF NOT EXISTS "source_entity_id" uuid;--> statement-breakpoint

ALTER TABLE "trip_transport_legs" ADD COLUMN IF NOT EXISTS "origin_group_id" uuid;--> statement-breakpoint
ALTER TABLE "trip_transport_legs" ADD COLUMN IF NOT EXISTS "source_entity_id" uuid;--> statement-breakpoint

ALTER TABLE "trip_accommodation_stays" ADD COLUMN IF NOT EXISTS "origin_group_id" uuid;--> statement-breakpoint
ALTER TABLE "trip_accommodation_stays" ADD COLUMN IF NOT EXISTS "source_entity_id" uuid;--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "itinerary_items" ADD CONSTRAINT "itinerary_items_origin_group_id_groups_id_fk"
   FOREIGN KEY ("origin_group_id") REFERENCES "public"."groups"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "trip_transport_legs" ADD CONSTRAINT "trip_transport_legs_origin_group_id_groups_id_fk"
   FOREIGN KEY ("origin_group_id") REFERENCES "public"."groups"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "trip_accommodation_stays" ADD CONSTRAINT "trip_accommodation_stays_origin_group_id_groups_id_fk"
   FOREIGN KEY ("origin_group_id") REFERENCES "public"."groups"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "group_day_places" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "trip_id" uuid NOT NULL,
  "group_id" uuid NOT NULL,
  "date" date NOT NULL,
  "primary_city" text NOT NULL DEFAULT '',
  "secondary_city" text,
  "primary_share" numeric(4,3) NOT NULL DEFAULT 1,
  "day_type" "trip_day_type" DEFAULT 'trip',
  "calendar_label" text,
  "weather_location_query" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "group_day_places" ADD CONSTRAINT "group_day_places_trip_id_trips_id_fk"
  FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_day_places" ADD CONSTRAINT "group_day_places_group_id_groups_id_fk"
  FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "group_day_places_trip_group_date_unique"
  ON "group_day_places" ("trip_id", "group_id", "date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "group_day_places_trip_group_idx"
  ON "group_day_places" ("trip_id", "group_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "group_overlay_ops" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "trip_id" uuid NOT NULL,
  "group_id" uuid NOT NULL,
  "entity_type" "overlay_entity_type" NOT NULL,
  "base_entity_id" uuid NOT NULL,
  "op" "overlay_op" NOT NULL,
  "replacement_entity_id" uuid,
  "effective_from" date,
  "effective_to" date,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "group_overlay_ops" ADD CONSTRAINT "group_overlay_ops_trip_id_trips_id_fk"
  FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_overlay_ops" ADD CONSTRAINT "group_overlay_ops_group_id_groups_id_fk"
  FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "group_overlay_ops_unique"
  ON "group_overlay_ops" ("trip_id", "group_id", "entity_type", "base_entity_id", "op");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "group_overlay_ops_trip_group_idx"
  ON "group_overlay_ops" ("trip_id", "group_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "entity_booking_details" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "trip_id" uuid NOT NULL,
  "entity_type" "booking_entity_type" NOT NULL,
  "entity_id" uuid NOT NULL,
  "booking_status" "booking_status" DEFAULT 'not_booked' NOT NULL,
  "supplier" text,
  "booking_reference" text,
  "invoice_number" text,
  "invoice_file_url" text,
  "confirmation_file_url" text,
  "amount_cents" integer,
  "currency" text DEFAULT 'NZD',
  "payment_status" text,
  "due_date" date,
  "contact_name" text,
  "contact_email" text,
  "contact_phone" text,
  "internal_notes" text,
  "external_route_id" text,
  "route_last_checked_at" timestamp with time zone,
  "route_status" text,
  "route_warning" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "entity_booking_details" ADD CONSTRAINT "entity_booking_details_trip_id_trips_id_fk"
  FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "entity_booking_details_entity_unique"
  ON "entity_booking_details" ("entity_type", "entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entity_booking_details_trip_idx"
  ON "entity_booking_details" ("trip_id");--> statement-breakpoint

-- Backfill Main Group for trips without one
INSERT INTO "groups" ("trip_id", "name", "type", "description", "sort_order", "is_main")
SELECT t."id", 'Main Group', 'other', NULL, 0, true
FROM "trips" t
WHERE NOT EXISTS (
  SELECT 1 FROM "groups" g WHERE g."trip_id" = t."id" AND g."is_main" = true
);--> statement-breakpoint

-- Backfill origin_group_id on entities
UPDATE "itinerary_items" i
SET "origin_group_id" = g."id"
FROM "groups" g
WHERE g."trip_id" = i."trip_id" AND g."is_main" = true AND i."origin_group_id" IS NULL;--> statement-breakpoint

UPDATE "trip_transport_legs" l
SET "origin_group_id" = g."id"
FROM "groups" g
WHERE g."trip_id" = l."trip_id" AND g."is_main" = true AND l."origin_group_id" IS NULL;--> statement-breakpoint

UPDATE "trip_accommodation_stays" s
SET "origin_group_id" = g."id"
FROM "groups" g
WHERE g."trip_id" = s."trip_id" AND g."is_main" = true AND s."origin_group_id" IS NULL;--> statement-breakpoint

-- Seed group_day_places from trip_days for main groups
INSERT INTO "group_day_places" (
  "trip_id", "group_id", "date", "primary_city", "secondary_city",
  "primary_share", "day_type", "calendar_label", "weather_location_query"
)
SELECT
  d."trip_id",
  g."id",
  d."date",
  COALESCE(d."city_label", ''),
  d."secondary_city_label",
  CASE
    WHEN d."secondary_city_label" IS NULL OR trim(d."secondary_city_label") = '' THEN 1
    WHEN d."day_type" = 'travel' THEN 0.25
    ELSE 0.5
  END,
  COALESCE(d."day_type", 'trip'),
  d."calendar_label",
  d."weather_location_query"
FROM "trip_days" d
INNER JOIN "groups" g ON g."trip_id" = d."trip_id" AND g."is_main" = true
ON CONFLICT ("trip_id", "group_id", "date") DO NOTHING;
