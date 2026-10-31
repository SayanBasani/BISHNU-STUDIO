CREATE TABLE IF NOT EXISTS "db_sync_outbox" (
  "id" text PRIMARY KEY NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "operation" text NOT NULL,
  "payload_json" text NOT NULL,
  "fencing_token" integer DEFAULT 1 NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "retry_count" integer DEFAULT 0 NOT NULL,
  "error_message" text,
  "conflict_details" text,
  "created_at" bigint DEFAULT (EXTRACT(epoch FROM now()) * 1000)::bigint NOT NULL,
  "synced_at" bigint
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_pg_sync_outbox_status" ON "db_sync_outbox" ("status", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_pg_sync_outbox_entity" ON "db_sync_outbox" ("entity_type", "entity_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_pg_sync_outbox_fencing" ON "db_sync_outbox" ("fencing_token");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "db_sync_history" (
  "id" text PRIMARY KEY NOT NULL,
  "fencing_token" integer NOT NULL,
  "source_provider" text NOT NULL,
  "target_provider" text NOT NULL,
  "events_count" integer DEFAULT 0 NOT NULL,
  "synced_count" integer DEFAULT 0 NOT NULL,
  "conflicts_count" integer DEFAULT 0 NOT NULL,
  "failures_count" integer DEFAULT 0 NOT NULL,
  "status" text DEFAULT 'in_progress' NOT NULL,
  "details_json" text,
  "executed_by_user_id" text,
  "started_at" bigint DEFAULT (EXTRACT(epoch FROM now()) * 1000)::bigint NOT NULL,
  "completed_at" bigint
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_pg_sync_history_started" ON "db_sync_history" ("started_at");
