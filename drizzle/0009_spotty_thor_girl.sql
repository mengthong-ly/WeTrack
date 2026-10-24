ALTER TABLE "task" ADD COLUMN "parent_id" text;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_parent_id_task_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_parent_idx" ON "task" USING btree ("parent_id");--> statement-breakpoint
-- Old checklist sub-tasks become child tasks: same workspace and project as the parent, done = completed.
-- created_at keeps their order (children are listed oldest first).
INSERT INTO "task" ("id", "organization_id", "project_id", "created_by_id", "parent_id", "title", "status", "progress", "completed_at", "created_at", "updated_at")
SELECT s."id", t."organization_id", t."project_id", t."created_by_id", s."task_id", s."title",
  CASE WHEN s."done" THEN 'completed'::task_status ELSE 'not_started'::task_status END,
  CASE WHEN s."done" THEN 100 ELSE 0 END,
  CASE WHEN s."done" THEN s."created_at" END,
  s."created_at" + s."position" * interval '1 millisecond', now()
FROM "subtask" s JOIN "task" t ON t."id" = s."task_id";--> statement-breakpoint
DROP TABLE "subtask" CASCADE;
