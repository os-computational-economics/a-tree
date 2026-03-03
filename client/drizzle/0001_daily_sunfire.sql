CREATE TABLE "experiment_trials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trial_code" varchar(6) NOT NULL,
	"experiment_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'in_progress' NOT NULL,
	"history_table" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"current_step_index" integer DEFAULT 0 NOT NULL,
	"current_template_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "experiment_trials_trial_code_unique" UNIQUE("trial_code")
);
--> statement-breakpoint
ALTER TABLE "experiment_trials" ADD CONSTRAINT "experiment_trials_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_trials" ADD CONSTRAINT "experiment_trials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;