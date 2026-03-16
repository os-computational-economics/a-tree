ALTER TABLE "experiment_trials" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "experiments" ADD COLUMN "deleted_at" timestamp;