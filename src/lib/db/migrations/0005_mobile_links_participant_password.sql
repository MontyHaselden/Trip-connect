DO $$ BEGIN
  CREATE TYPE "public"."mobile_token_purpose" AS ENUM('host_admin', 'host_trip', 'student_invite');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "mobile_access_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "trip_id" uuid NOT NULL REFERENCES "trips"("id") ON DELETE CASCADE,
  "host_id" uuid REFERENCES "host_accounts"("id") ON DELETE CASCADE,
  "participant_id" uuid REFERENCES "participants"("id") ON DELETE CASCADE,
  "purpose" "mobile_token_purpose" NOT NULL,
  "token_hash" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "mobile_access_tokens_token_hash_unique"
  ON "mobile_access_tokens" ("token_hash");

CREATE INDEX IF NOT EXISTS "mobile_access_tokens_trip_purpose_idx"
  ON "mobile_access_tokens" ("trip_id", "purpose");

ALTER TABLE "participants" ADD COLUMN IF NOT EXISTS "password_hash" text;
