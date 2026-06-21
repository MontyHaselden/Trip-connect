ALTER TABLE "trip_accommodation_stays" ADD COLUMN IF NOT EXISTS "google_place_id" text;--> statement-breakpoint
ALTER TABLE "trip_accommodation_stays" ADD COLUMN IF NOT EXISTS "latitude" numeric;--> statement-breakpoint
ALTER TABLE "trip_accommodation_stays" ADD COLUMN IF NOT EXISTS "longitude" numeric;
