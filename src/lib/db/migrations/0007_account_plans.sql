DO $$ BEGIN
  CREATE TYPE account_type AS ENUM ('school', 'personal', 'organisation_interest');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE subscription_plan AS ENUM (
    'school_starter',
    'school_pro',
    'school_pro_plus',
    'personal_one_time',
    'personal',
    'personal_pro'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE host_accounts
  ADD COLUMN IF NOT EXISTS account_type account_type NOT NULL DEFAULT 'school',
  ADD COLUMN IF NOT EXISTS plan subscription_plan NOT NULL DEFAULT 'school_starter',
  ADD COLUMN IF NOT EXISTS school_name text,
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz;

ALTER TABLE host_accounts ALTER COLUMN phone_number_e164 DROP NOT NULL;
