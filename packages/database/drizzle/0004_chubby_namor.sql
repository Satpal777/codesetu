ALTER TABLE "project" ADD COLUMN "share_token" text;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_share_token_unique" UNIQUE("share_token");