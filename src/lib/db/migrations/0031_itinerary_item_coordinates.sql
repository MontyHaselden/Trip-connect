ALTER TABLE "itinerary_items" ADD COLUMN IF NOT EXISTS "google_place_id" text;--> statement-breakpoint
ALTER TABLE "itinerary_items" ADD COLUMN IF NOT EXISTS "latitude" numeric;--> statement-breakpoint
ALTER TABLE "itinerary_items" ADD COLUMN IF NOT EXISTS "longitude" numeric;
