CREATE TYPE "public"."label_kind" AS ENUM('status', 'category');--> statement-breakpoint
CREATE TYPE "public"."label_lifecycle" AS ENUM('active', 'done');--> statement-breakpoint
CREATE TABLE "workspace_labels" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"kind" "label_kind" NOT NULL,
	"key" varchar(32) NOT NULL,
	"label" varchar(48) NOT NULL,
	"tone" varchar(16) DEFAULT 'neutral' NOT NULL,
	"lifecycle" "label_lifecycle" DEFAULT 'active' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspace_labels" ADD CONSTRAINT "workspace_labels_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_labels_unique" ON "workspace_labels" USING btree ("workspace_id","kind","key");--> statement-breakpoint
CREATE INDEX "workspace_labels_workspace_kind_idx" ON "workspace_labels" USING btree ("workspace_id","kind","position");--> statement-breakpoint

-- Enum to varchar. The default has to go first: it is typed as the enum, so
-- Postgres refuses to retype the column while it is attached. The USING clause
-- is required too — there is no implicit cast from an enum to varchar.
ALTER TABLE "feedback" ALTER COLUMN "category" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "feedback" ALTER COLUMN "category" SET DATA TYPE varchar(32) USING "category"::text;--> statement-breakpoint
ALTER TABLE "feedback" ALTER COLUMN "category" SET DEFAULT 'other';--> statement-breakpoint
ALTER TABLE "feedback" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "feedback" ALTER COLUMN "status" SET DATA TYPE varchar(32) USING "status"::text;--> statement-breakpoint
ALTER TABLE "feedback" ALTER COLUMN "status" SET DEFAULT 'open';--> statement-breakpoint

-- Seed every existing workspace with the vocabulary it has been using all
-- along. Without this the dashboard would come back with no statuses and no
-- categories to filter by, and every existing row would point at a label that
-- does not exist. The keys match the old enum members exactly, so no feedback
-- row needs to be rewritten.
INSERT INTO "workspace_labels" ("id", "workspace_id", "kind", "key", "label", "tone", "lifecycle", "position", "is_system")
SELECT
  'lbl_' || substr(md5(w."id" || v."kind" || v."key"), 1, 20),
  w."id",
  v."kind"::"label_kind",
  v."key",
  v."label",
  v."tone",
  v."lifecycle"::"label_lifecycle",
  v."position",
  true
FROM "workspaces" w
CROSS JOIN (VALUES
  ('status',   'open',        'Open',            'info',     'active', 0),
  ('status',   'in_progress', 'In progress',     'accent',   'active', 1),
  ('status',   'testing',     'Testing',         'warning',  'active', 2),
  ('status',   'resolved',    'Resolved',        'success',  'done',   3),
  ('status',   'closed',      'Closed',          'neutral',  'done',   4),
  ('category', 'bug',         'Bug',             'danger',   'active', 0),
  ('category', 'feature',     'Feature request', 'accent',   'active', 1),
  ('category', 'ui',          'UI issue',        'info',     'active', 2),
  ('category', 'performance', 'Performance',     'warning',  'active', 3),
  ('category', 'content',     'Content',         'neutral',  'active', 4),
  ('category', 'question',    'Question',        'info',     'active', 5),
  ('category', 'other',       'Other',           'neutral',  'active', 6)
) AS v("kind", "key", "label", "tone", "lifecycle", "position")
ON CONFLICT DO NOTHING;
