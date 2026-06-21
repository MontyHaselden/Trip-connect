CREATE TABLE IF NOT EXISTS "trip_funds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "trip_id" uuid NOT NULL,
  "name" text NOT NULL,
  "amount_cents" integer NOT NULL,
  "currency" text NOT NULL DEFAULT 'NZD',
  "allocation_rule_type" "cost_allocation_rule_type" NOT NULL DEFAULT 'equal_cost_participants',
  "allocation_rule_payload" jsonb NOT NULL DEFAULT '{}',
  "sort_order" integer NOT NULL DEFAULT 0,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "trip_funds" ADD CONSTRAINT "trip_funds_trip_id_trips_id_fk"
  FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "trip_funds_trip_idx" ON "trip_funds" ("trip_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "participant_payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "trip_id" uuid NOT NULL,
  "participant_id" uuid NOT NULL,
  "amount_cents" integer NOT NULL,
  "currency" text NOT NULL DEFAULT 'NZD',
  "paid_at" date NOT NULL,
  "label" text NOT NULL DEFAULT 'deposit',
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "participant_payments" ADD CONSTRAINT "participant_payments_trip_id_fk"
  FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "participant_payments" ADD CONSTRAINT "participant_payments_participant_id_fk"
  FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "participant_payments_trip_idx" ON "participant_payments" ("trip_id");
