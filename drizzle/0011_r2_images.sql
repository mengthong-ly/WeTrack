ALTER TABLE "attachment" ALTER COLUMN "data" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "attachment" ADD COLUMN "key" text;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "image_id" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "logo_id" text;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_image_id_attachment_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."attachment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_logo_id_attachment_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."attachment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Feedback screenshots become attachments, keeping the feedback's id so nothing else has to change.
INSERT INTO "attachment" ("id", "organization_id", "uploader_id", "data", "type", "created_at")
  SELECT "id", "organization_id", "author_id", "image", "image_type", "created_at" FROM "feedback" WHERE "image" IS NOT NULL;--> statement-breakpoint
UPDATE "feedback" SET "image_id" = "id" WHERE "image" IS NOT NULL;
