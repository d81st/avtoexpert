CREATE TABLE "audit_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"event_type" varchar(64) NOT NULL,
	"actor_user_id" uuid,
	"target_resource_id" varchar(64),
	"email_or_user_id" varchar(255),
	"client_ip" varchar(64),
	"user_agent" varchar(512),
	"before_value" jsonb,
	"after_value" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_failures" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"email" varchar(255),
	"client_ip" varchar(64) NOT NULL,
	"user_agent" varchar(512),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Photo metadata (R4.6): add nullable first, backfill existing rows, then enforce NOT NULL.
ALTER TABLE "photos" ADD COLUMN "sequence_number" integer;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "original_name" varchar(255);--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "byte_size" integer;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "mime_type" varchar(64);--> statement-breakpoint
-- Backfill sequence_number per report in stable (created_at, id) order.
WITH numbered AS (
	SELECT id, ROW_NUMBER() OVER (PARTITION BY report_id ORDER BY created_at, id) AS rn
	FROM photos
)
UPDATE photos SET sequence_number = numbered.rn FROM numbered WHERE photos.id = numbered.id;--> statement-breakpoint
-- Backfill required metadata for legacy rows with safe defaults.
UPDATE photos SET byte_size = 0 WHERE byte_size IS NULL;--> statement-breakpoint
UPDATE photos SET mime_type = 'image/jpeg' WHERE mime_type IS NULL;--> statement-breakpoint
ALTER TABLE "photos" ALTER COLUMN "sequence_number" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" ALTER COLUMN "byte_size" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" ALTER COLUMN "mime_type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "audit_events_type_time" ON "audit_events" USING btree ("event_type","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_time" ON "audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "auth_failures_ip_time" ON "auth_failures" USING btree ("client_ip","created_at");--> statement-breakpoint
CREATE INDEX "auth_failures_email_time" ON "auth_failures" USING btree ("email","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "photos_report_seq_uniq" ON "photos" USING btree ("report_id","sequence_number");