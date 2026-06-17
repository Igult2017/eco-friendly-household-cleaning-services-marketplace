-- Cleaner-defined paid add-ons (e.g. oven cleaning, ironing) selectable at booking.
CREATE TABLE IF NOT EXISTS provider_addons (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID         NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  name        VARCHAR(120) NOT NULL,
  price_cents INTEGER      NOT NULL,
  is_active   BOOLEAN      NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS provider_addons_provider_idx ON provider_addons(provider_id);
