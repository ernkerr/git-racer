-- Add new columns
ALTER TABLE "challenges" ADD COLUMN "duration_preset" varchar(20);--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN "include_today" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN "is_finalized" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN "final_results" jsonb;--> statement-breakpoint

-- Backfill duration_preset from old refresh_period
UPDATE "challenges" SET duration_preset = CASE
  WHEN refresh_period = 'daily' THEN '1day'
  WHEN refresh_period = 'weekly' THEN '1week'
  ELSE 'ongoing'
END;--> statement-breakpoint

-- For old daily/weekly races, update start_date to their last reset boundary
-- so cumulative counts roughly match what users last saw
UPDATE "challenges" SET start_date = date_trunc('day', NOW()) WHERE refresh_period = 'daily';--> statement-breakpoint
UPDATE "challenges" SET start_date = date_trunc('week', NOW()) + interval '0 days' WHERE refresh_period = 'weekly';--> statement-breakpoint

-- Drop the old column
ALTER TABLE "challenges" DROP COLUMN "refresh_period";
