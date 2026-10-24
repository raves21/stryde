-- Sync infrastructure (DATA_MODEL_AND_SYNC.md §1, §5). Hand-written: drizzle-kit
-- can't express DEFERRABLE foreign keys or triggers.

CREATE SEQUENCE IF NOT EXISTS sync_version_seq;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION set_server_version() RETURNS trigger AS $$
BEGIN
  NEW."serverVersion" := nextval('sync_version_seq');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER exercises_server_version BEFORE INSERT OR UPDATE ON "exercises" FOR EACH ROW EXECUTE FUNCTION set_server_version();
--> statement-breakpoint
CREATE TRIGGER templates_server_version BEFORE INSERT OR UPDATE ON "templates" FOR EACH ROW EXECUTE FUNCTION set_server_version();
--> statement-breakpoint
CREATE TRIGGER template_exercises_server_version BEFORE INSERT OR UPDATE ON "template_exercises" FOR EACH ROW EXECUTE FUNCTION set_server_version();
--> statement-breakpoint
CREATE TRIGGER template_sets_server_version BEFORE INSERT OR UPDATE ON "template_sets" FOR EACH ROW EXECUTE FUNCTION set_server_version();
--> statement-breakpoint
CREATE TRIGGER sessions_server_version BEFORE INSERT OR UPDATE ON "sessions" FOR EACH ROW EXECUTE FUNCTION set_server_version();
--> statement-breakpoint
CREATE TRIGGER session_exercises_server_version BEFORE INSERT OR UPDATE ON "session_exercises" FOR EACH ROW EXECUTE FUNCTION set_server_version();
--> statement-breakpoint
CREATE TRIGGER sets_server_version BEFORE INSERT OR UPDATE ON "sets" FOR EACH ROW EXECUTE FUNCTION set_server_version();
--> statement-breakpoint
CREATE TRIGGER user_settings_server_version BEFORE INSERT OR UPDATE ON "user_settings" FOR EACH ROW EXECUTE FUNCTION set_server_version();
--> statement-breakpoint
-- Owner FKs (presets have userId NULL, which FKs allow).
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_userId_fk" FOREIGN KEY ("userId") REFERENCES "user"("id") DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_userId_fk" FOREIGN KEY ("userId") REFERENCES "user"("id") DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE "template_exercises" ADD CONSTRAINT "template_exercises_userId_fk" FOREIGN KEY ("userId") REFERENCES "user"("id") DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE "template_sets" ADD CONSTRAINT "template_sets_userId_fk" FOREIGN KEY ("userId") REFERENCES "user"("id") DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fk" FOREIGN KEY ("userId") REFERENCES "user"("id") DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE "session_exercises" ADD CONSTRAINT "session_exercises_userId_fk" FOREIGN KEY ("userId") REFERENCES "user"("id") DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE "sets" ADD CONSTRAINT "sets_userId_fk" FOREIGN KEY ("userId") REFERENCES "user"("id") DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_userId_fk" FOREIGN KEY ("userId") REFERENCES "user"("id") DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
-- Parent/child FKs between synced tables: deferred so a push batch can contain
-- children before parents. No ON DELETE: synced rows are never hard-deleted.
ALTER TABLE "template_exercises" ADD CONSTRAINT "template_exercises_templateId_fk" FOREIGN KEY ("templateId") REFERENCES "templates"("id") DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE "template_exercises" ADD CONSTRAINT "template_exercises_exerciseId_fk" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE "template_sets" ADD CONSTRAINT "template_sets_templateExerciseId_fk" FOREIGN KEY ("templateExerciseId") REFERENCES "template_exercises"("id") DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_templateId_fk" FOREIGN KEY ("templateId") REFERENCES "templates"("id") DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE "session_exercises" ADD CONSTRAINT "session_exercises_sessionId_fk" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE "session_exercises" ADD CONSTRAINT "session_exercises_exerciseId_fk" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE "sets" ADD CONSTRAINT "sets_sessionExerciseId_fk" FOREIGN KEY ("sessionExerciseId") REFERENCES "session_exercises"("id") DEFERRABLE INITIALLY DEFERRED;
