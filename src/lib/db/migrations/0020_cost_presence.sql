ALTER TYPE cost_allocation_rule_type ADD VALUE IF NOT EXISTS 'equal_present';

DO $$ BEGIN
  CREATE TYPE cost_line_scope AS ENUM ('presence', 'trip_wide');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE cost_line_items
  ADD COLUMN IF NOT EXISTS scope cost_line_scope NOT NULL DEFAULT 'presence';
