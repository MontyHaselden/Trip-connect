DO $$ BEGIN
  CREATE TYPE "cost_line_category" AS ENUM(
    'flights', 'transport', 'insurance', 'accommodation', 'meals', 'activities', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "cost_allocation_rule_type" AS ENUM(
    'equal_cost_participants', 'equal_group', 'assign_one', 'manual'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "supplier_payment_status" AS ENUM('estimated', 'invoiced', 'paid');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "trip_cost_settings" (
  "trip_id" uuid PRIMARY KEY NOT NULL,
  "base_currency" text NOT NULL DEFAULT 'NZD',
  "foreign_currency" text,
  "exchange_rate" numeric(12, 6),
  "exchange_rate_date" date,
  "exchange_rate_manual" boolean NOT NULL DEFAULT false,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "trip_cost_settings" ADD CONSTRAINT "trip_cost_settings_trip_id_trips_id_fk"
  FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "cost_line_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "trip_id" uuid NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "category" "cost_line_category" NOT NULL,
  "description" text NOT NULL,
  "notes" text,
  "total_amount_cents" integer NOT NULL DEFAULT 0,
  "currency" text NOT NULL DEFAULT 'NZD',
  "quantity" numeric(10, 2),
  "allocation_rule_type" "cost_allocation_rule_type" NOT NULL DEFAULT 'equal_cost_participants',
  "allocation_rule_payload" jsonb NOT NULL DEFAULT '{}',
  "linked_stay_id" uuid,
  "linked_transport_leg_id" uuid,
  "linked_activity_id" uuid,
  "supplier_payment_status" "supplier_payment_status",
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "cost_line_items" ADD CONSTRAINT "cost_line_items_trip_id_trips_id_fk"
  FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "cost_line_items_trip_idx" ON "cost_line_items" ("trip_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "cost_allocation_overrides" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "line_item_id" uuid NOT NULL,
  "participant_id" uuid NOT NULL,
  "amount_cents" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "cost_allocation_overrides" ADD CONSTRAINT "cost_allocation_overrides_line_item_id_fk"
  FOREIGN KEY ("line_item_id") REFERENCES "public"."cost_line_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "cost_allocation_overrides" ADD CONSTRAINT "cost_allocation_overrides_participant_id_fk"
  FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "cost_allocation_overrides_line_participant_unique"
  ON "cost_allocation_overrides" ("line_item_id", "participant_id");
