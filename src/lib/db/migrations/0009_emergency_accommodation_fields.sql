ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "hotel_phone" text;
ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "nearest_station_notes" text;
ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "nearest_bus_stop_name" text;
ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "route_notes_to_accommodation" text;
ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "static_map_url" text;
ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "maps_url" text;

ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "local_emergency_number" text;
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "school_emergency_phone" text;
