ALTER TABLE "group_day_places"
  ADD COLUMN IF NOT EXISTS "am_city" text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "pm_city" text NOT NULL DEFAULT '';
