ALTER TABLE "trip_cost_settings"
ADD COLUMN IF NOT EXISTS "finance_section_exclusions" jsonb NOT NULL DEFAULT '{}'::jsonb;
