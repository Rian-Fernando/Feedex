ALTER TABLE "feedback" ADD COLUMN "github_issue_url" text;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "github_issue_number" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "github_repo" varchar(140);