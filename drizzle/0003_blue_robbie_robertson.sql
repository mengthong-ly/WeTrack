CREATE TABLE "digest_sent" (
	"organization_id" text NOT NULL,
	"sent_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "digest_sent_organization_id_sent_on_pk" PRIMARY KEY("organization_id","sent_on")
);
--> statement-breakpoint
ALTER TABLE "digest_sent" ADD CONSTRAINT "digest_sent_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;