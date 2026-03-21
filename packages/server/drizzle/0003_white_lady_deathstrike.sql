ALTER TABLE "league_memberships" DROP CONSTRAINT "league_memberships_week_start_user_id_unique";--> statement-breakpoint
ALTER TABLE "league_memberships" DROP CONSTRAINT "league_memberships_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "league_memberships" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "league_memberships" ADD CONSTRAINT "league_memberships_week_start_github_username_unique" UNIQUE("week_start","github_username");