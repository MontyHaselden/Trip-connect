-- Week 1 launch: trial billing, Itinerary Live pricing alignment

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

-- Hide legacy school tiers from public signup; keep rows for existing accounts
UPDATE plans
SET visible = false, updated_at = now()
WHERE code IN ('school_starter', 'school_pro');

UPDATE plans
SET
  name = 'School plan',
  badge = 'Launch plan',
  public_description = 'Full school trip platform — itineraries, groups, emergency info, and live student access',
  updated_at = now()
WHERE code = 'school_pro_plus';

INSERT INTO platform_settings (key, value) VALUES
  ('founding_school_price_cents', '24000'::jsonb),
  ('normal_school_price_cents', '40000'::jsonb),
  ('trial_days', '7'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

UPDATE platform_settings SET value = '"school_pro_plus"'::jsonb, updated_at = now()
WHERE key = 'default_school_plan';

UPDATE platform_settings SET value = '"Itinerary Live"'::jsonb, updated_at = now()
WHERE key = 'product_name';

UPDATE platform_settings SET value = '"support@itinerarylive.app"'::jsonb, updated_at = now()
WHERE key = 'support_email';
