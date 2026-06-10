-- Add view_count column to job_posts for tracking provider impressions
ALTER TABLE job_posts ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;
