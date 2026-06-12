-- Platform-wide configuration stored as key/value rows.
-- Only one row per key is allowed (upsert pattern).
CREATE TABLE IF NOT EXISTS platform_settings (
  key        VARCHAR(100) PRIMARY KEY,
  value      TEXT         NOT NULL,
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Seed defaults (idempotent — will not overwrite existing values)
INSERT INTO platform_settings (key, value)
VALUES
  ('commission_pct',      '15'),
  ('referral_pct',         '5'),
  ('payout_schedule',     'weekly'),
  ('max_service_radius_km','100'),
  ('platform_name',       'DORIXÉ')
ON CONFLICT (key) DO NOTHING;
