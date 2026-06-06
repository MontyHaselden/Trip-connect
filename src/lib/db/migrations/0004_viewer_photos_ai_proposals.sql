DO $$ BEGIN
 CREATE TYPE "public"."photo_type" AS ENUM('selfie', 'place');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."photo_status" AS ENUM('visible', 'hidden', 'deleted');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."ai_proposal_status" AS ENUM('draft', 'applied', 'rejected');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "viewer_code" text;
--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "viewer_gallery_enabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "viewer_room_details_enabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "student_gallery_enabled" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
UPDATE "trips" SET "viewer_code" = substr(md5(random()::text), 1, 8) WHERE "viewer_code" IS NULL;
--> statement-breakpoint
ALTER TABLE "trips" ALTER COLUMN "viewer_code" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "trips_viewer_code_unique" ON "trips" ("viewer_code");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trip_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"trip_day_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"type" "photo_type" NOT NULL,
	"image_url" text NOT NULL,
	"thumbnail_url" text,
	"caption" text,
	"status" "photo_status" DEFAULT 'visible' NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_change_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"user_message" text NOT NULL,
	"assistant_reply" text NOT NULL,
	"proposed_changes_json" jsonb NOT NULL,
	"warnings_json" jsonb,
	"status" "ai_proposal_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"applied_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trip_photos" ADD CONSTRAINT "trip_photos_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trip_photos" ADD CONSTRAINT "trip_photos_trip_day_id_trip_days_id_fk" FOREIGN KEY ("trip_day_id") REFERENCES "public"."trip_days"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trip_photos" ADD CONSTRAINT "trip_photos_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_change_proposals" ADD CONSTRAINT "ai_change_proposals_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_change_proposals" ADD CONSTRAINT "ai_change_proposals_created_by_host_accounts_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."host_accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
