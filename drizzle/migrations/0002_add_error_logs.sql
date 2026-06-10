-- Migration: add error_severity enum and error_logs table
DO $$ BEGIN CREATE TYPE error_severity AS ENUM('info', 'warning', 'error', 'critical'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "error_logs" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "message"         text NOT NULL,
  "stack"           text,
  "route"           varchar(500),
  "method"          varchar(10),
  "status_code"     integer,
  "user_id"         text,
  "severity"        "error_severity" NOT NULL DEFAULT 'error',
  "context"         jsonb,
  "sentry_event_id" varchar(100),
  "resolved_at"     timestamp with time zone,
  "resolved_by"     text,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "error_logs_created_at_idx" ON "error_logs" ("created_at");
CREATE INDEX IF NOT EXISTS "error_logs_severity_idx"   ON "error_logs" ("severity");
CREATE INDEX IF NOT EXISTS "error_logs_resolved_at_idx" ON "error_logs" ("resolved_at");
