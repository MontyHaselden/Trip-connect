DO $$ BEGIN
 CREATE TYPE "public"."cost_status" AS ENUM(
  'unknown', 'estimate', 'quoted', 'confirmed', 'invoiced', 'paid', 'cancelled'
 );
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
 CREATE TYPE "public"."line_payment_status" AS ENUM(
  'unpaid', 'deposit_paid', 'part_paid', 'paid', 'reimbursable'
 );
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
 CREATE TYPE "public"."funding_status" AS ENUM(
  'unfunded', 'part_funded', 'fully_funded'
 );
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
 CREATE TYPE "public"."tax_treatment" AS ENUM(
  'no_gst', 'gst', 'gst_exempt', 'overseas', 'unknown'
 );
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

ALTER TABLE "cost_line_items" ADD COLUMN IF NOT EXISTS "cost_status" "cost_status" DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "cost_line_items" ADD COLUMN IF NOT EXISTS "line_payment_status" "line_payment_status" DEFAULT 'unpaid' NOT NULL;--> statement-breakpoint
ALTER TABLE "cost_line_items" ADD COLUMN IF NOT EXISTS "funding_status" "funding_status" DEFAULT 'unfunded' NOT NULL;--> statement-breakpoint
ALTER TABLE "cost_line_items" ADD COLUMN IF NOT EXISTS "supplier_name" text;--> statement-breakpoint
ALTER TABLE "cost_line_items" ADD COLUMN IF NOT EXISTS "estimated_amount_cents" integer;--> statement-breakpoint
ALTER TABLE "cost_line_items" ADD COLUMN IF NOT EXISTS "actual_amount_cents" integer;--> statement-breakpoint
ALTER TABLE "cost_line_items" ADD COLUMN IF NOT EXISTS "tax_treatment" "tax_treatment" DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "cost_line_items" ADD COLUMN IF NOT EXISTS "export_category_label" text;--> statement-breakpoint
ALTER TABLE "cost_line_items" ADD COLUMN IF NOT EXISTS "export_reference" text;--> statement-breakpoint
ALTER TABLE "cost_line_items" ADD COLUMN IF NOT EXISTS "booking_reference" text;--> statement-breakpoint
ALTER TABLE "cost_line_items" ADD COLUMN IF NOT EXISTS "invoice_recorded" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "cost_line_items" ADD COLUMN IF NOT EXISTS "receipt_recorded" boolean DEFAULT false NOT NULL;--> statement-breakpoint

UPDATE "cost_line_items"
SET "cost_status" = CASE
  WHEN "supplier_payment_status" = 'estimated' THEN 'estimate'::"cost_status"
  WHEN "supplier_payment_status" = 'invoiced' THEN 'invoiced'::"cost_status"
  WHEN "supplier_payment_status" = 'paid' THEN 'paid'::"cost_status"
  ELSE "cost_status"
END
WHERE "supplier_payment_status" IS NOT NULL;--> statement-breakpoint

UPDATE "cost_line_items"
SET "line_payment_status" = 'paid'::"line_payment_status"
WHERE "supplier_payment_status" = 'paid';--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "trip_supplier_payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "trip_id" uuid NOT NULL,
  "cost_line_item_id" uuid,
  "paid_at" date NOT NULL,
  "paid_by_type" text NOT NULL DEFAULT 'school_bank',
  "paid_by_name" text,
  "paid_to" text,
  "amount_cents" integer NOT NULL,
  "currency" text NOT NULL DEFAULT 'NZD',
  "payment_method" text NOT NULL DEFAULT 'bank_transfer',
  "reference" text,
  "receipt_status" text DEFAULT 'none',
  "reimbursement_needed" boolean DEFAULT false NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "trip_supplier_payments" ADD CONSTRAINT "trip_supplier_payments_trip_id_fk"
  FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "trip_supplier_payments" ADD CONSTRAINT "trip_supplier_payments_cost_line_item_id_fk"
  FOREIGN KEY ("cost_line_item_id") REFERENCES "public"."cost_line_items"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "trip_supplier_payments_trip_idx" ON "trip_supplier_payments" ("trip_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trip_supplier_payments_line_idx" ON "trip_supplier_payments" ("cost_line_item_id");
