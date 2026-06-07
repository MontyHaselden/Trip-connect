DO $$ BEGIN CREATE TYPE admin_role AS ENUM ('super_admin', 'admin', 'support');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE billing_status AS ENUM ('trial', 'active', 'manual', 'past_due', 'cancelled', 'expired', 'comped');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE invoice_status AS ENUM ('draft', 'issued', 'sent', 'paid', 'overdue', 'void', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE payment_provider AS ENUM ('manual', 'stripe', 'payshare', 'none');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE enforcement_mode AS ENUM ('soft', 'hard');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE gst_display_mode AS ENUM ('plus_gst', 'inc_gst');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE payshare_session_status AS ENUM ('pending', 'completed', 'expired', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text NOT NULL,
  full_name text NOT NULL,
  role admin_role NOT NULL DEFAULT 'admin',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS admin_users_email_unique ON admin_users (email);

CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  account_type account_type NOT NULL,
  base_price_cents integer NOT NULL DEFAULT 0,
  billing_period text NOT NULL DEFAULT 'year',
  staff_account_limit integer NOT NULL DEFAULT 1,
  active_trip_limit integer NOT NULL DEFAULT 1,
  group_size_limit integer,
  ai_builder_enabled boolean NOT NULL DEFAULT false,
  ai_phrases_enabled boolean NOT NULL DEFAULT false,
  school_tools_enabled boolean NOT NULL DEFAULT false,
  viewer_access_enabled boolean NOT NULL DEFAULT true,
  photo_gallery_enabled boolean NOT NULL DEFAULT true,
  payshare_enabled boolean NOT NULL DEFAULT false,
  visible boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  badge text,
  public_description text,
  feature_list jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS plans_code_unique ON plans (code);

CREATE TABLE IF NOT EXISTS platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_admin_id uuid REFERENCES admin_users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS price_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES host_accounts(id) ON DELETE CASCADE,
  base_price_cents integer NOT NULL,
  gst_behaviour text NOT NULL DEFAULT 'standard',
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  reason text,
  internal_notes text,
  locked_price boolean NOT NULL DEFAULT false,
  created_by_admin_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS price_overrides_account_id_idx ON price_overrides (account_id);

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES host_accounts(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES plans(id),
  billing_status billing_status NOT NULL DEFAULT 'manual',
  payment_provider payment_provider NOT NULL DEFAULT 'manual',
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  renews_at timestamptz,
  cancelled_at timestamptz,
  base_price_cents integer NOT NULL,
  gst_rate numeric(5,4) NOT NULL DEFAULT 0.15,
  gst_amount_cents integer NOT NULL DEFAULT 0,
  total_cents integer NOT NULL DEFAULT 0,
  price_override_id uuid REFERENCES price_overrides(id) ON DELETE SET NULL,
  founding_price_locked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscriptions_account_id_idx ON subscriptions (account_id);

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES host_accounts(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  plan_id uuid REFERENCES plans(id) ON DELETE SET NULL,
  invoice_number text NOT NULL,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  currency text NOT NULL DEFAULT 'NZD',
  subtotal_cents integer NOT NULL,
  gst_rate numeric(5,4) NOT NULL DEFAULT 0.15,
  gst_amount_cents integer NOT NULL,
  total_cents integer NOT NULL,
  status invoice_status NOT NULL DEFAULT 'draft',
  payment_provider payment_provider NOT NULL DEFAULT 'manual',
  payment_reference text,
  pdf_url text,
  internal_notes text,
  xero_invoice_id text,
  xero_contact_id text,
  xero_status text,
  xero_last_synced_at timestamptz,
  xero_error text,
  created_by_admin_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS invoices_number_unique ON invoices (invoice_number);
CREATE INDEX IF NOT EXISTS invoices_account_id_idx ON invoices (account_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx ON invoices (status);

CREATE TABLE IF NOT EXISTS payshare_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES host_accounts(id) ON DELETE CASCADE,
  trip_id uuid REFERENCES trips(id) ON DELETE SET NULL,
  plan_id uuid REFERENCES plans(id) ON DELETE SET NULL,
  session_id text NOT NULL,
  amount_cents integer NOT NULL,
  split_amount_cents integer,
  group_size integer,
  status payshare_session_status NOT NULL DEFAULT 'pending',
  checkout_url text,
  payshare_external_id text,
  expires_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS payshare_sessions_session_id_unique ON payshare_sessions (session_id);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  before_json jsonb,
  after_json jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_audit_log_created_at_idx ON admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_entity_idx ON admin_audit_log (entity_type, entity_id);

CREATE TABLE IF NOT EXISTS ai_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES host_accounts(id) ON DELETE CASCADE,
  trip_id uuid REFERENCES trips(id) ON DELETE SET NULL,
  event_type text NOT NULL DEFAULT 'chat',
  call_count integer NOT NULL DEFAULT 1,
  estimated_cost_cents integer NOT NULL DEFAULT 0,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_usage_events_account_id_idx ON ai_usage_events (account_id);

ALTER TABLE host_accounts
  ADD COLUMN IF NOT EXISTS billing_contact_name text,
  ADD COLUMN IF NOT EXISTS billing_email text,
  ADD COLUMN IF NOT EXISTS billing_address text,
  ADD COLUMN IF NOT EXISTS xero_contact_id text,
  ADD COLUMN IF NOT EXISTS founding_school boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS internal_notes text,
  ADD COLUMN IF NOT EXISTS override_ai_builder boolean,
  ADD COLUMN IF NOT EXISTS override_viewer_links boolean,
  ADD COLUMN IF NOT EXISTS override_photo_gallery boolean,
  ADD COLUMN IF NOT EXISTS override_active_trip_limit integer,
  ADD COLUMN IF NOT EXISTS override_staff_limit integer,
  ADD COLUMN IF NOT EXISTS subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL;

INSERT INTO plans (code, name, account_type, base_price_cents, billing_period, staff_account_limit, active_trip_limit, group_size_limit, ai_builder_enabled, ai_phrases_enabled, school_tools_enabled, viewer_access_enabled, photo_gallery_enabled, payshare_enabled, visible, sort_order, badge, public_description, feature_list)
VALUES
  ('school_starter', 'School Starter', 'school', 15000, 'year', 3, 4, NULL, false, false, true, true, true, false, true, 1, NULL, 'Small schools, one department, or a few trips per year', '["Smart setup wizard","Offline student itinerary","Student invite links","Parent/viewer links","Rooms and groups","Emergency card and phrases","Pre-trip meetings","Daily weather","Basic photo gallery","Trip history"]'::jsonb),
  ('school_pro', 'School Pro', 'school', 25000, 'year', 6, 8, NULL, true, true, true, true, true, false, true, 2, 'Most popular', 'Most schools and international departments', '["Everything in School Starter","AI itinerary builder","AI phrase generator","AI conflict checks","Larger photo galleries","Helper permissions","Export/print backup","Priority early support"]'::jsonb),
  ('school_pro_plus', 'School Pro+', 'school', 40000, 'year', 12, 20, NULL, true, true, true, true, true, false, true, 3, NULL, 'Larger schools, multiple departments, and frequent trips', '["Everything in School Pro","Higher AI usage allowance","Larger photo storage","Custom school branding","Multiple department support","Priority support","Extended trip history"]'::jsonb),
  ('personal_one_time', 'Personal One-Time Trip', 'personal', 1800, 'once', 1, 1, 6, false, false, false, true, true, true, true, 10, 'Pay with PayShare', 'One trip valid for 6 months, up to 6 people', '["One trip","Valid for 6 months","Up to 6 people","Itinerary builder","Weather","Emergency phrases","Basic photo gallery","Viewer link"]'::jsonb),
  ('personal', 'Personal', 'personal', 4000, 'year', 1, 2, 6, false, false, false, false, true, false, true, 11, NULL, 'Family holidays and small group travel', '["1 account","Up to 2 active trips","Groups up to 6 people","Standard itinerary tools","Weather","Emergency phrases","Basic photo gallery"]'::jsonb),
  ('personal_pro', 'Personal Pro', 'personal', 8000, 'year', 1, 5, 15, true, false, false, true, true, false, true, 12, NULL, 'Frequent personal group trips', '["1 account","Up to 5 active trips","Groups up to 15 people","AI builder","Photo gallery","Viewer link","Rooms/groups","Export/print backup"]'::jsonb)
ON CONFLICT (code) DO NOTHING;

INSERT INTO platform_settings (key, value) VALUES
  ('gst_enabled', 'true'::jsonb),
  ('gst_rate', '0.15'::jsonb),
  ('gst_display_mode', '"plus_gst"'::jsonb),
  ('gst_label', '"GST"'::jsonb),
  ('country', '"NZ"'::jsonb),
  ('currency', '"NZD"'::jsonb),
  ('product_name', '"Trip Connect"'::jsonb),
  ('support_email', '"support@tripconnect.app"'::jsonb),
  ('founding_school_offer_enabled', 'true'::jsonb),
  ('founding_school_max_slots', '15'::jsonb),
  ('enforcement_mode', '"soft"'::jsonb),
  ('default_school_plan', '"school_starter"'::jsonb),
  ('xero_enabled', 'false'::jsonb),
  ('xero_connected', 'false'::jsonb),
  ('xero_tenant_id', 'null'::jsonb),
  ('xero_client_id', 'null'::jsonb),
  ('xero_revenue_account_code', 'null'::jsonb),
  ('xero_gst_tax_type', 'null'::jsonb),
  ('xero_branding_theme_id', 'null'::jsonb),
  ('payshare_enabled', 'true'::jsonb),
  ('maintenance_mode', 'false'::jsonb),
  ('ai_globally_enabled', 'true'::jsonb),
  ('photo_uploads_globally_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;
