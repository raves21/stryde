CREATE TYPE "public"."equipment" AS ENUM('barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'band', 'smith', 'other');--> statement-breakpoint
CREATE TYPE "public"."exercise_type" AS ENUM('weighted', 'bodyweight', 'timed');--> statement-breakpoint
CREATE TYPE "public"."friendship_status" AS ENUM('pending', 'accepted', 'declined');--> statement-breakpoint
CREATE TYPE "public"."muscle_group" AS ENUM('chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'quads', 'hamstrings', 'glutes', 'calves', 'core', 'full_body', 'cardio', 'other');--> statement-breakpoint
CREATE TYPE "public"."pr_type" AS ENUM('e1rm', 'weight', 'reps_at_weight', 'volume', 'max_reps', 'duration');--> statement-breakpoint
CREATE TYPE "public"."reaction_emoji" AS ENUM('muscle', 'fire', 'clap', 'trophy', 'grimace');--> statement-breakpoint
CREATE TYPE "public"."set_type" AS ENUM('warmup', 'working');--> statement-breakpoint
CREATE TYPE "public"."target_kind" AS ENUM('fixed', 'rir', 'failure');--> statement-breakpoint
CREATE TYPE "public"."weight_unit" AS ENUM('kg', 'lb');--> statement-breakpoint
CREATE TABLE "account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" uuid NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp with time zone,
	"refreshTokenExpiresAt" timestamp with time zone,
	"scope" text,
	"password" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" uuid NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"image" text,
	"username" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"sessionId" uuid NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"prs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	CONSTRAINT "feed_events_sessionId_unique" UNIQUE("sessionId")
);
--> statement-breakpoint
CREATE TABLE "friend_mutes" (
	"userId" uuid NOT NULL,
	"mutedUserId" uuid NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "friend_mutes_userId_mutedUserId_pk" PRIMARY KEY("userId","mutedUserId")
);
--> statement-breakpoint
CREATE TABLE "friendships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requesterId" uuid NOT NULL,
	"addresseeId" uuid NOT NULL,
	"status" "friendship_status" DEFAULT 'pending' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"readAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personal_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"exerciseId" uuid NOT NULL,
	"prType" "pr_type" NOT NULL,
	"value" numeric(10, 2) NOT NULL,
	"setId" uuid,
	"sessionId" uuid NOT NULL,
	"achievedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"userAgent" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"lastUsedAt" timestamp with time zone,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"sessionId" uuid NOT NULL,
	"emoji" "reaction_emoji" NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_pushes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"sessionId" uuid NOT NULL,
	"fireAt" timestamp with time zone NOT NULL,
	"sentAt" timestamp with time zone,
	"cancelledAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" uuid PRIMARY KEY NOT NULL,
	"userId" uuid,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	"deletedAt" timestamp with time zone,
	"serverVersion" bigint DEFAULT 0 NOT NULL,
	"name" text NOT NULL,
	"type" "exercise_type" NOT NULL,
	"muscleGroup" "muscle_group" NOT NULL,
	"equipment" "equipment" NOT NULL,
	"defaultRestSeconds" integer,
	"isPreset" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_exercises" (
	"id" uuid PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	"deletedAt" timestamp with time zone,
	"serverVersion" bigint DEFAULT 0 NOT NULL,
	"sessionId" uuid NOT NULL,
	"exerciseId" uuid NOT NULL,
	"position" integer NOT NULL,
	"supersetGroup" text,
	"restSeconds" integer
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	"deletedAt" timestamp with time zone,
	"serverVersion" bigint DEFAULT 0 NOT NULL,
	"templateId" uuid,
	"name" text NOT NULL,
	"startedAt" timestamp with time zone NOT NULL,
	"finishedAt" timestamp with time zone,
	"timezone" text NOT NULL,
	"localDate" date NOT NULL,
	"notes" text,
	"shareWithFriends" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	"deletedAt" timestamp with time zone,
	"serverVersion" bigint DEFAULT 0 NOT NULL,
	"sessionExerciseId" uuid NOT NULL,
	"position" integer NOT NULL,
	"setType" "set_type" NOT NULL,
	"targetKind" "target_kind" NOT NULL,
	"targetReps" integer,
	"targetRepsMax" integer,
	"targetRir" integer,
	"weightKg" numeric(7, 2),
	"reps" integer,
	"rir" integer,
	"durationSec" integer,
	"completedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "template_exercises" (
	"id" uuid PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	"deletedAt" timestamp with time zone,
	"serverVersion" bigint DEFAULT 0 NOT NULL,
	"templateId" uuid NOT NULL,
	"exerciseId" uuid NOT NULL,
	"position" integer NOT NULL,
	"supersetGroup" text,
	"restSeconds" integer
);
--> statement-breakpoint
CREATE TABLE "template_sets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	"deletedAt" timestamp with time zone,
	"serverVersion" bigint DEFAULT 0 NOT NULL,
	"templateExerciseId" uuid NOT NULL,
	"position" integer NOT NULL,
	"setType" "set_type" NOT NULL,
	"targetKind" "target_kind" NOT NULL,
	"targetReps" integer,
	"targetRepsMax" integer,
	"targetRir" integer,
	"plannedWeightKg" numeric(7, 2),
	"plannedDurationSec" integer
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	"deletedAt" timestamp with time zone,
	"serverVersion" bigint DEFAULT 0 NOT NULL,
	"name" text NOT NULL,
	"notes" text,
	"sortOrder" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	"deletedAt" timestamp with time zone,
	"serverVersion" bigint DEFAULT 0 NOT NULL,
	"unit" "weight_unit" DEFAULT 'kg' NOT NULL,
	"defaultRestSeconds" integer DEFAULT 120 NOT NULL,
	"defaultShareWithFriends" boolean DEFAULT true NOT NULL,
	"notificationsMuted" boolean DEFAULT false NOT NULL,
	"notifyFriendWorkouts" boolean DEFAULT true NOT NULL,
	"notifyReactions" boolean DEFAULT true NOT NULL,
	"notifyFriendRequests" boolean DEFAULT true NOT NULL,
	"notifyRestTimer" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_events" ADD CONSTRAINT "feed_events_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_events" ADD CONSTRAINT "feed_events_sessionId_sessions_id_fk" FOREIGN KEY ("sessionId") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_mutes" ADD CONSTRAINT "friend_mutes_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_mutes" ADD CONSTRAINT "friend_mutes_mutedUserId_user_id_fk" FOREIGN KEY ("mutedUserId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requesterId_user_id_fk" FOREIGN KEY ("requesterId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_addresseeId_user_id_fk" FOREIGN KEY ("addresseeId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_records" ADD CONSTRAINT "personal_records_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_records" ADD CONSTRAINT "personal_records_exerciseId_exercises_id_fk" FOREIGN KEY ("exerciseId") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_records" ADD CONSTRAINT "personal_records_setId_sets_id_fk" FOREIGN KEY ("setId") REFERENCES "public"."sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_records" ADD CONSTRAINT "personal_records_sessionId_sessions_id_fk" FOREIGN KEY ("sessionId") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_sessionId_sessions_id_fk" FOREIGN KEY ("sessionId") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_pushes" ADD CONSTRAINT "scheduled_pushes_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_pushes" ADD CONSTRAINT "scheduled_pushes_sessionId_sessions_id_fk" FOREIGN KEY ("sessionId") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_index" ON "account" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "session_userId_index" ON "session" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "verification_identifier_index" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "feed_events_userId_createdAt_index" ON "feed_events" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "friendships_pair_unique" ON "friendships" USING btree (LEAST("requesterId", "addresseeId"),GREATEST("requesterId", "addresseeId"));--> statement-breakpoint
CREATE INDEX "friendships_addresseeId_index" ON "friendships" USING btree ("addresseeId");--> statement-breakpoint
CREATE INDEX "notifications_userId_createdAt_index" ON "notifications" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "personal_records_userId_exerciseId_index" ON "personal_records" USING btree ("userId","exerciseId");--> statement-breakpoint
CREATE INDEX "personal_records_sessionId_index" ON "personal_records" USING btree ("sessionId");--> statement-breakpoint
CREATE INDEX "push_subscriptions_userId_index" ON "push_subscriptions" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "reactions_userId_sessionId_index" ON "reactions" USING btree ("userId","sessionId");--> statement-breakpoint
CREATE INDEX "reactions_sessionId_index" ON "reactions" USING btree ("sessionId");--> statement-breakpoint
CREATE INDEX "scheduled_pushes_pending" ON "scheduled_pushes" USING btree ("fireAt") WHERE "sentAt" IS NULL AND "cancelledAt" IS NULL;--> statement-breakpoint
CREATE INDEX "exercises_userId_serverVersion_index" ON "exercises" USING btree ("userId","serverVersion");--> statement-breakpoint
CREATE INDEX "exercises_isPreset_serverVersion_index" ON "exercises" USING btree ("isPreset","serverVersion");--> statement-breakpoint
CREATE INDEX "session_exercises_userId_serverVersion_index" ON "session_exercises" USING btree ("userId","serverVersion");--> statement-breakpoint
CREATE INDEX "session_exercises_sessionId_index" ON "session_exercises" USING btree ("sessionId");--> statement-breakpoint
CREATE INDEX "session_exercises_userId_exerciseId_index" ON "session_exercises" USING btree ("userId","exerciseId");--> statement-breakpoint
CREATE INDEX "sessions_userId_serverVersion_index" ON "sessions" USING btree ("userId","serverVersion");--> statement-breakpoint
CREATE INDEX "sessions_userId_localDate_index" ON "sessions" USING btree ("userId","localDate");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_one_active_per_user" ON "sessions" USING btree ("userId") WHERE "finishedAt" IS NULL AND "deletedAt" IS NULL;--> statement-breakpoint
CREATE INDEX "sets_userId_serverVersion_index" ON "sets" USING btree ("userId","serverVersion");--> statement-breakpoint
CREATE INDEX "sets_sessionExerciseId_index" ON "sets" USING btree ("sessionExerciseId");--> statement-breakpoint
CREATE INDEX "template_exercises_userId_serverVersion_index" ON "template_exercises" USING btree ("userId","serverVersion");--> statement-breakpoint
CREATE INDEX "template_exercises_templateId_index" ON "template_exercises" USING btree ("templateId");--> statement-breakpoint
CREATE INDEX "template_sets_userId_serverVersion_index" ON "template_sets" USING btree ("userId","serverVersion");--> statement-breakpoint
CREATE INDEX "template_sets_templateExerciseId_index" ON "template_sets" USING btree ("templateExerciseId");--> statement-breakpoint
CREATE INDEX "templates_userId_serverVersion_index" ON "templates" USING btree ("userId","serverVersion");--> statement-breakpoint
CREATE INDEX "user_settings_userId_serverVersion_index" ON "user_settings" USING btree ("userId","serverVersion");