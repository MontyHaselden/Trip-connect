ALTER TABLE "host_accounts" ADD COLUMN IF NOT EXISTS "home_city" text;
ALTER TABLE "host_accounts" ADD COLUMN IF NOT EXISTS "default_airport" text;

ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "default_departure_airport" text;
