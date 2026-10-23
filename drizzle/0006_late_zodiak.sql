CREATE TABLE "join_code" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"created_by_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "join_code_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "join_code" ADD CONSTRAINT "join_code_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "join_code" ADD CONSTRAINT "join_code_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;