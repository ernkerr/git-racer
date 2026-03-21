CREATE TABLE "famous_devs" (
	"id" serial PRIMARY KEY NOT NULL,
	"github_username" varchar(255) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"known_for" text NOT NULL,
	"avatar_url" text,
	"category" varchar(50),
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "famous_devs_github_username_unique" UNIQUE("github_username")
);
--> statement-breakpoint
CREATE TABLE "league_memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"week_start" date NOT NULL,
	"user_id" integer NOT NULL,
	"github_username" varchar(255) NOT NULL,
	"tier" varchar(20) DEFAULT 'bronze' NOT NULL,
	"group_number" integer DEFAULT 0 NOT NULL,
	"weekly_commits" integer DEFAULT 0 NOT NULL,
	"final_rank" integer,
	"promoted" boolean DEFAULT false,
	"demoted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "league_memberships_week_start_user_id_unique" UNIQUE("week_start","user_id")
);
--> statement-breakpoint
CREATE TABLE "social_circles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"following_username" varchar(255) NOT NULL,
	"avatar_url" text,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "social_circles_user_id_following_username_unique" UNIQUE("user_id","following_username")
);
--> statement-breakpoint
CREATE TABLE "user_streaks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"github_username" varchar(255) NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"best_week_commits" integer DEFAULT 0 NOT NULL,
	"best_week_start" date,
	"last_active_date" date,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_streaks_github_username_unique" UNIQUE("github_username")
);
--> statement-breakpoint
ALTER TABLE "league_memberships" ADD CONSTRAINT "league_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_circles" ADD CONSTRAINT "social_circles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_streaks" ADD CONSTRAINT "user_streaks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;