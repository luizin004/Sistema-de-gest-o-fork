-- Add instance_id to posts for lead-per-instance deduplication
ALTER TABLE posts ADD COLUMN IF NOT EXISTS instance_id uuid;
