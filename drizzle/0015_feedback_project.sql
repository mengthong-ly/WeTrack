ALTER TABLE "feedback" ADD COLUMN "project_id" text;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_project_idx" ON "feedback" USING btree ("project_id","created_at");--> statement-breakpoint
UPDATE "feedback" SET "project_id" = "task"."project_id" FROM "task" WHERE "feedback"."task_id" = "task"."id";
