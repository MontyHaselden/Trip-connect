CREATE TYPE "public"."host_account_role" AS ENUM('teacher', 'helper', 'host', 'admin');--> statement-breakpoint
CREATE TABLE "host_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"phone_number_e164" text NOT NULL,
	"password_hash" text NOT NULL,
	"full_name" text NOT NULL,
	"role" "host_account_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "host_trip_members" (
	"host_id" uuid NOT NULL,
	"trip_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "host_trip_members_host_id_trip_id_pk" PRIMARY KEY("host_id","trip_id")
);
--> statement-breakpoint
ALTER TABLE "trips" ALTER COLUMN "host_code_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "host_trip_members" ADD CONSTRAINT "host_trip_members_host_id_host_accounts_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."host_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_trip_members" ADD CONSTRAINT "host_trip_members_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "host_accounts_email_unique" ON "host_accounts" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "host_accounts_phone_e164_unique" ON "host_accounts" USING btree ("phone_number_e164");--> statement-breakpoint
CREATE INDEX "host_trip_members_trip_id_idx" ON "host_trip_members" USING btree ("trip_id");