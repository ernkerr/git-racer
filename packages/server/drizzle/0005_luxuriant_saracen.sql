CREATE INDEX "idx_cp_challenge_id" ON "challenge_participants" USING btree ("challenge_id");--> statement-breakpoint
CREATE INDEX "idx_cp_github_username" ON "challenge_participants" USING btree ("github_username");--> statement-breakpoint
CREATE INDEX "idx_cs_username_date" ON "commit_snapshots" USING btree ("github_username","date");--> statement-breakpoint
CREATE INDEX "idx_cs_date" ON "commit_snapshots" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_lm_week_start" ON "league_memberships" USING btree ("week_start");--> statement-breakpoint
CREATE INDEX "idx_lm_user_id" ON "league_memberships" USING btree ("user_id");