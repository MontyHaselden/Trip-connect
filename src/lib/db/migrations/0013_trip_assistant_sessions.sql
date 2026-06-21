CREATE TABLE IF NOT EXISTS "trip_assistant_sessions" (
  "trip_id" uuid PRIMARY KEY NOT NULL,
  "messages_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "source_text" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "trip_assistant_sessions" ADD CONSTRAINT "trip_assistant_sessions_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
