CREATE TABLE "event_committers" (
	"id" serial PRIMARY KEY NOT NULL,
	"github_username" varchar(255) NOT NULL,
	"avatar_url" text,
	"date" date NOT NULL,
	"commit_count" integer DEFAULT 0 NOT NULL,
	"push_count" integer DEFAULT 0 NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "event_committers_github_username_date_unique" UNIQUE("github_username","date")
);
--> statement-breakpoint
CREATE INDEX "idx_ec_date_commits" ON "event_committers" USING btree ("date","commit_count");--> statement-breakpoint
CREATE INDEX "idx_ec_username" ON "event_committers" USING btree ("github_username");