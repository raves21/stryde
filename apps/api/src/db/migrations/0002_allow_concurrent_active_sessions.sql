DROP INDEX "sessions_one_active_per_user";--> statement-breakpoint
CREATE INDEX "sessions_active_per_user" ON "sessions" USING btree ("userId") WHERE "finishedAt" IS NULL AND "deletedAt" IS NULL;