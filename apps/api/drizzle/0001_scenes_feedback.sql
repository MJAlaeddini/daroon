CREATE TABLE "insight_feedback" (
	"user_id" uuid NOT NULL,
	"id" text NOT NULL,
	"verdict" text NOT NULL,
	"group_size" integer NOT NULL,
	"hits" integer NOT NULL,
	"others" integer NOT NULL,
	"elsewhere" integer NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "insight_feedback_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "scenes" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "insight_feedback" ADD CONSTRAINT "insight_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;