DO $$ BEGIN
  CREATE TYPE "transport_product_kind" AS ENUM (
    'flight_package',
    'train_pass',
    'ic_card',
    'bus_pass'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "trip_transport_products" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "trip_id" uuid NOT NULL,
  "kind" "transport_product_kind" NOT NULL,
  "name" text NOT NULL,
  "participant_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "notes" text,
  "sort_order" integer DEFAULT 0 NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "trip_transport_products"
    ADD CONSTRAINT "trip_transport_products_trip_id_trips_id_fk"
    FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "trip_transport_products_trip_id_sort_order_idx"
  ON "trip_transport_products" USING btree ("trip_id", "sort_order");

ALTER TABLE "trip_transport_legs"
  ADD COLUMN IF NOT EXISTS "transport_product_id" uuid;

DO $$ BEGIN
  ALTER TABLE "trip_transport_legs"
    ADD CONSTRAINT "trip_transport_legs_transport_product_id_fk"
    FOREIGN KEY ("transport_product_id") REFERENCES "public"."trip_transport_products"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "cost_line_items"
  ADD COLUMN IF NOT EXISTS "linked_transport_product_id" uuid;

DO $$ BEGIN
  ALTER TABLE "cost_line_items"
    ADD CONSTRAINT "cost_line_items_linked_transport_product_id_fk"
    FOREIGN KEY ("linked_transport_product_id") REFERENCES "public"."trip_transport_products"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
