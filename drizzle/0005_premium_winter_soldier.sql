CREATE TABLE "meeting" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"task_id" text,
	"created_by_id" text,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"attendee_emails" text[] NOT NULL,
	"google_event_id" text NOT NULL,
	"meet_url" text,
	"calendar_url" text,
	"reminded_at" timestamp with time zone,
	"canceled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_integration" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"slack_webhook_url" text
);
--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_integration" ADD CONSTRAINT "workspace_integration_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meeting_org_start_idx" ON "meeting" USING btree ("organization_id","starts_at");