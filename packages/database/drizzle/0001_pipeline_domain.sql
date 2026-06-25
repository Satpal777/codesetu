DO $$
BEGIN
  CREATE TYPE "public"."stage_status" AS ENUM('pending', 'running', 'awaiting_input', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  CREATE TYPE "public"."stage_type" AS ENUM('request', 'product_thinking', 'prd', 'design', 'tasks', 'implementation', 'review', 'fixes', 'approval', 'release');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TYPE "public"."stage_type" ADD VALUE IF NOT EXISTS 'design';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "title" text NOT NULL,
  "prompt" text NOT NULL,
  "status" text DEFAULT 'running' NOT NULL,
  "current_stage" "stage_type",
  "autopilot" boolean DEFAULT false NOT NULL,
  "repo_url" text,
  "repo_branch" text,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stage" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL,
  "type" "stage_type" NOT NULL,
  "status" "stage_status" DEFAULT 'pending' NOT NULL,
  "order" integer NOT NULL,
  "error" text,
  "started_at" timestamp,
  "completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "artifact" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL,
  "stage_id" text NOT NULL,
  "type" "stage_type" NOT NULL,
  "content" jsonb NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clarification" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL,
  "question" text NOT NULL,
  "options" jsonb,
  "allow_custom" boolean DEFAULT true NOT NULL,
  "multi_select" boolean DEFAULT false NOT NULL,
  "answer" text,
  "order" integer NOT NULL,
  "created_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "autopilot" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "clarification" ADD COLUMN IF NOT EXISTS "options" jsonb;
--> statement-breakpoint
ALTER TABLE "clarification" ADD COLUMN IF NOT EXISTS "allow_custom" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "clarification" ADD COLUMN IF NOT EXISTS "multi_select" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "project" ADD CONSTRAINT "project_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "stage" ADD CONSTRAINT "stage_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "artifact" ADD CONSTRAINT "artifact_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "artifact" ADD CONSTRAINT "artifact_stage_id_stage_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stage"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "clarification" ADD CONSTRAINT "clarification_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
