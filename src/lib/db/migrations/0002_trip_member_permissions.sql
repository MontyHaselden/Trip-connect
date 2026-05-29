ALTER TABLE "host_trip_members" ADD COLUMN "can_edit" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "host_trip_members" ADD COLUMN "invited_email" text;--> statement-breakpoint
ALTER TABLE "host_trip_members" ADD COLUMN "invited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "host_trip_members" ADD COLUMN "accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "host_accounts" ADD COLUMN "linked_participant_id" uuid;--> statement-breakpoint
ALTER TABLE "host_accounts" ADD CONSTRAINT "host_accounts_linked_participant_id_participants_id_fk" FOREIGN KEY ("linked_participant_id") REFERENCES "public"."participants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE TABLE "host_trip_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"invited_email" text NOT NULL,
	"can_edit" boolean DEFAULT true NOT NULL,
	"invited_by_host_id" uuid,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "host_trip_invites" ADD CONSTRAINT "host_trip_invites_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_trip_invites" ADD CONSTRAINT "host_trip_invites_invited_by_host_id_host_accounts_id_fk" FOREIGN KEY ("invited_by_host_id") REFERENCES "public"."host_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "host_trip_invites_trip_email_unique" ON "host_trip_invites" USING btree ("trip_id","invited_email");
