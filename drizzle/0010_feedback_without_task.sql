ALTER TABLE "feedback" DROP CONSTRAINT "feedback_task_id_task_id_fk";
--> statement-breakpoint
ALTER TABLE "feedback" ALTER COLUMN "task_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE set null ON UPDATE no action;
