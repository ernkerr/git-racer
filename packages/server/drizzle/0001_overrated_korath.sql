CREATE TABLE "seed_state" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(50) NOT NULL,
	"last_run_at" timestamp,
	"cursor" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "seed_state_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "suggested_opponents" (
	"id" serial PRIMARY KEY NOT NULL,
	"github_username" varchar(255) NOT NULL,
	"avatar_url" text,
	"followers" integer DEFAULT 0 NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "suggested_opponents_github_username_unique" UNIQUE("github_username")
);
