DO $$ BEGIN
 CREATE TYPE "public"."activity_category" AS ENUM('travel', 'meal', 'school', 'activity', 'free_time', 'hotel', 'meeting', 'important', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."weather_snapshot_status" AS ENUM('available', 'too_far', 'unavailable');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "trip_days" ADD COLUMN IF NOT EXISTS "calendar_label" text;
--> statement-breakpoint
ALTER TABLE "itinerary_items" ADD COLUMN IF NOT EXISTS "category" "activity_category";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "day_weather_snapshots" (
	"trip_day_id" uuid PRIMARY KEY NOT NULL,
	"location_query" text NOT NULL,
	"temp_c" integer,
	"condition" text,
	"advice" text,
	"status" "weather_snapshot_status" NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "day_weather_snapshots" ADD CONSTRAINT "day_weather_snapshots_trip_day_id_trip_days_id_fk" FOREIGN KEY ("trip_day_id") REFERENCES "public"."trip_days"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
