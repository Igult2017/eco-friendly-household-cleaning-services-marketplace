-- Enable dual-role accounts: one user can hold both customer and provider/cleaner capabilities.
-- The active role is tracked via a session cookie (dorix_active_role) set at login/switch time.
ALTER TABLE users ADD COLUMN IF NOT EXISTS dual_role_enabled boolean NOT NULL DEFAULT false;
