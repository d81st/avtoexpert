-- R8.1, R8.9: caption — nullable, ≤200 chars.
ALTER TABLE "photos" ADD COLUMN "caption" varchar(200);--> statement-breakpoint
-- R8.2, R8.9: position — user-controlled display order; added nullable so we can backfill.
ALTER TABLE "photos" ADD COLUMN "position" integer;--> statement-breakpoint
-- Backfill: per report_id, assign positions 1..k in (created_at, id) order so existing
-- reports preserve their visible photo ordering. Deterministic tie-break on id.
WITH numbered AS (
	SELECT id, ROW_NUMBER() OVER (PARTITION BY report_id ORDER BY created_at, id) AS rn
	FROM photos
)
UPDATE photos SET position = numbered.rn FROM numbered WHERE photos.id = numbered.id;--> statement-breakpoint
-- Lock position to NOT NULL after backfill.
ALTER TABLE "photos" ALTER COLUMN "position" SET NOT NULL;--> statement-breakpoint
-- R8.4 + §3.8 reorder transaction:
-- Constraint is DEFERRABLE INITIALLY DEFERRED so the position-shift step inside
-- the reorder transaction is allowed to transiently hold duplicate
-- (report_id, position) pairs between the band-shift UPDATE and the final SET
-- of the moved photo's position. PostgreSQL validates uniqueness once, at COMMIT.
ALTER TABLE "photos" ADD CONSTRAINT "photos_report_position_unique" UNIQUE ("report_id","position") DEFERRABLE INITIALLY DEFERRED;
