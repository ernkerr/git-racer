CREATE TABLE "user_benchmarks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"github_username" varchar(255) NOT NULL,
	"display_name" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_benchmarks_user_id_github_username_unique" UNIQUE("user_id","github_username")
);
--> statement-breakpoint
ALTER TABLE "user_benchmarks" ADD CONSTRAINT "user_benchmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;