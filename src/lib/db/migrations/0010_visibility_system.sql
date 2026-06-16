-- Visibility system: multi-target audience, group invite links, route groups

ALTER TYPE "group_type" ADD VALUE IF NOT EXISTS 'route';--> statement-breakpoint

CREATE TYPE "public"."visibility_mode" AS ENUM(
  'everyone',
  'staff_only',
  'viewers_only',
  'hidden_from_students',
  'custom'
);--> statement-breakpoint

CREATE TYPE "public"."visibility_entity_type" AS ENUM(
  'itinerary_item',
  'transport_leg',
  'accommodation_stay',
  'day_reminder',
  'prep_item',
  'contact',
  'room'
);--> statement-breakpoint

CREATE TYPE "public"."visibility_target_type" AS ENUM(
  'group',
  'participant',
  'room'
);--> statement-breakpoint

ALTER TABLE "itinerary_items" ADD COLUMN IF NOT EXISTS "visibility_mode" "visibility_mode" DEFAULT 'everyone' NOT NULL;--> statement-breakpoint
ALTER TABLE "trip_day_reminders" ADD COLUMN IF NOT EXISTS "visibility_mode" "visibility_mode" DEFAULT 'everyone' NOT NULL;--> statement-breakpoint
ALTER TABLE "tomorrow_prep_items" ADD COLUMN IF NOT EXISTS "visibility_mode" "visibility_mode" DEFAULT 'everyone' NOT NULL;--> statement-breakpoint
ALTER TABLE "trip_transport_legs" ADD COLUMN IF NOT EXISTS "visibility_mode" "visibility_mode" DEFAULT 'everyone' NOT NULL;--> statement-breakpoint
ALTER TABLE "trip_accommodation_stays" ADD COLUMN IF NOT EXISTS "visibility_mode" "visibility_mode" DEFAULT 'everyone' NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "visibility_mode" "visibility_mode" DEFAULT 'everyone' NOT NULL;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "visibility_mode" "visibility_mode" DEFAULT 'everyone' NOT NULL;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "visibility_targets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "trip_id" uuid NOT NULL,
  "entity_type" "visibility_entity_type" NOT NULL,
  "entity_id" uuid NOT NULL,
  "target_type" "visibility_target_type" NOT NULL,
  "target_id" uuid NOT NULL
);--> statement-breakpoint

ALTER TABLE "visibility_targets" ADD CONSTRAINT "visibility_targets_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "visibility_targets_trip_entity_idx" ON "visibility_targets" USING btree ("trip_id","entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "visibility_targets_entity_target_unique" ON "visibility_targets" USING btree ("entity_type","entity_id","target_type","target_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "group_invite_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "trip_id" uuid NOT NULL,
  "group_id" uuid NOT NULL,
  "invite_code" text NOT NULL,
  "label" text NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "group_invite_links" ADD CONSTRAINT "group_invite_links_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_invite_links" ADD CONSTRAINT "group_invite_links_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "group_invite_links_invite_code_unique" ON "group_invite_links" USING btree ("invite_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "group_invite_links_trip_id_idx" ON "group_invite_links" USING btree ("trip_id");--> statement-breakpoint

ALTER TABLE "participant_groups" ADD COLUMN IF NOT EXISTS "effective_from" date;--> statement-breakpoint
ALTER TABLE "participant_groups" ADD COLUMN IF NOT EXISTS "effective_to" date;--> statement-breakpoint

ALTER TABLE "participants" ADD COLUMN IF NOT EXISTS "joined_via_group_invite_link_id" uuid;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_joined_via_group_invite_link_id_fk" FOREIGN KEY ("joined_via_group_invite_link_id") REFERENCES "public"."group_invite_links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- Backfill visibility_mode from legacy audience_type
UPDATE "itinerary_items" SET "visibility_mode" = 'custom'
  WHERE "audience_type" IN ('group', 'room', 'participant');--> statement-breakpoint
UPDATE "trip_day_reminders" SET "visibility_mode" = 'custom'
  WHERE "audience_type" IN ('group', 'room', 'participant');--> statement-breakpoint

INSERT INTO "visibility_targets" ("trip_id", "entity_type", "entity_id", "target_type", "target_id")
SELECT i."trip_id", 'itinerary_item', i."id",
  CASE i."audience_type"
    WHEN 'group' THEN 'group'::visibility_target_type
    WHEN 'participant' THEN 'participant'::visibility_target_type
    WHEN 'room' THEN 'room'::visibility_target_type
  END,
  i."audience_id"
FROM "itinerary_items" i
WHERE i."audience_type" IN ('group', 'room', 'participant')
  AND i."audience_id" IS NOT NULL
ON CONFLICT DO NOTHING;--> statement-breakpoint

INSERT INTO "visibility_targets" ("trip_id", "entity_type", "entity_id", "target_type", "target_id")
SELECT r."trip_id", 'day_reminder', r."id",
  CASE r."audience_type"
    WHEN 'group' THEN 'group'::visibility_target_type
    WHEN 'participant' THEN 'participant'::visibility_target_type
    WHEN 'room' THEN 'room'::visibility_target_type
  END,
  r."audience_id"
FROM "trip_day_reminders" r
WHERE r."audience_type" IN ('group', 'room', 'participant')
  AND r."audience_id" IS NOT NULL
ON CONFLICT DO NOTHING;
