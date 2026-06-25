ALTER TABLE "trip_cost_settings"
  ADD COLUMN IF NOT EXISTS "finance_custom_sections" jsonb NOT NULL DEFAULT '[]'::jsonb;--> statement-breakpoint

ALTER TABLE "trip_cost_settings"
  ADD COLUMN IF NOT EXISTS "finance_view_groups" jsonb NOT NULL DEFAULT '[]'::jsonb;
