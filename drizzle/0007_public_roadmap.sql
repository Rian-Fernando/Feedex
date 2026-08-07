ALTER TABLE "feedback" ADD COLUMN "is_public" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "public_title" varchar(200);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "roadmap_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "public_slug" varchar(80);--> statement-breakpoint
ALTER TABLE "workspace_labels" ADD COLUMN "is_public" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "projects_public_slug_unique" ON "projects" USING btree ("public_slug");