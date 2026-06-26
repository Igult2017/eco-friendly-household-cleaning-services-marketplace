// Idempotent guarantee that the referral tables exist in the connected database.
//
// Background: drizzle-kit's migration journal on production recorded
// 0011_referrals / 0013_ensure_referrals as "applied" while the tables were
// never actually created (journal/DB drift). `drizzle-kit migrate` therefore
// skips them forever, and the admin Referral page throws on every query.
//
// This runs in the build/deploy step (where the internal DB host resolves) and
// applies the referral DDL directly, NOT through the journal. Every statement is
// IF NOT EXISTS / duplicate-safe, so it is harmless to run on every deploy.
//
// Non-fatal by design: a connection problem logs and exits 0 so it can never
// turn a deploy red — worst case is the status quo, never a regression.
import postgres from "postgres"

const DDL = `
DO $$ BEGIN CREATE TYPE referral_status AS ENUM ('pending','active','invalid'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE commission_status AS ENUM ('pending','credited','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS referral_codes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT        NOT NULL UNIQUE REFERENCES users(id),
  code       VARCHAR(20) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS referral_codes_user_idx ON referral_codes(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS referral_codes_code_idx ON referral_codes(code);

CREATE TABLE IF NOT EXISTS referrals (
  id                            UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id                   TEXT            NOT NULL REFERENCES users(id),
  referred_id                   TEXT            NOT NULL UNIQUE REFERENCES users(id),
  code                          VARCHAR(20)     NOT NULL,
  status                        referral_status NOT NULL DEFAULT 'pending',
  activated_at                  TIMESTAMPTZ,
  total_commission_earned_cents INTEGER         NOT NULL DEFAULT 0,
  created_at                    TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
CREATE INDEX        IF NOT EXISTS referrals_referrer_idx ON referrals(referrer_id);
CREATE UNIQUE INDEX IF NOT EXISTS referrals_referred_idx ON referrals(referred_id);

CREATE TABLE IF NOT EXISTS referral_commissions (
  id                   UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id          UUID              NOT NULL REFERENCES referrals(id),
  booking_id           UUID              NOT NULL REFERENCES bookings(id),
  referrer_id          TEXT              NOT NULL REFERENCES users(id),
  booking_amount_cents INTEGER           NOT NULL,
  commission_cents     INTEGER           NOT NULL,
  status               commission_status NOT NULL DEFAULT 'pending',
  credited_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS ref_commissions_booking_idx  ON referral_commissions(booking_id);
CREATE INDEX        IF NOT EXISTS ref_commissions_referral_idx ON referral_commissions(referral_id);
CREATE INDEX        IF NOT EXISTS ref_commissions_referrer_idx ON referral_commissions(referrer_id);

CREATE TABLE IF NOT EXISTS referral_credits (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               TEXT        NOT NULL UNIQUE REFERENCES users(id),
  balance_cents         INTEGER     NOT NULL DEFAULT 0,
  lifetime_earned_cents INTEGER     NOT NULL DEFAULT 0,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS referral_credits_user_idx ON referral_credits(user_id);

ALTER TABLE users ADD COLUMN IF NOT EXISTS dual_role_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS recurring_discount_pct integer NOT NULL DEFAULT 0;

-- Optional per-post author display name (overrides the author's account name on the blog).
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS author_name varchar(160);

-- Cleaner-defined paid add-ons selectable at booking.
CREATE TABLE IF NOT EXISTS provider_addons (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID         NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  name        VARCHAR(120) NOT NULL,
  price_cents INTEGER      NOT NULL,
  is_active   BOOLEAN      NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS provider_addons_provider_idx ON provider_addons(provider_id);

-- Provider → customer reviews (two-way reviews).
CREATE TABLE IF NOT EXISTS customer_reviews (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID        NOT NULL REFERENCES bookings(id),
  provider_id UUID        NOT NULL REFERENCES providers(id),
  customer_id TEXT        NOT NULL REFERENCES users(id),
  rating      INTEGER     NOT NULL,
  body        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS customer_reviews_booking_idx   ON customer_reviews(booking_id);
CREATE INDEX        IF NOT EXISTS customer_reviews_customer_idx  ON customer_reviews(customer_id);
CREATE INDEX        IF NOT EXISTS customer_reviews_provider_idx  ON customer_reviews(provider_id);

-- Service categories seed. The DB seed (lib/db/seed.ts) never ran in prod, so the
-- category list was empty — the provider "Add service" dropdown had no options and
-- cleaners could not price/list any service. Idempotent upsert on slug.
CREATE TABLE IF NOT EXISTS service_categories (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(100) NOT NULL,
  slug            VARCHAR(100) NOT NULL,
  description     TEXT,
  icon_url        TEXT,
  base_eco_points INTEGER      NOT NULL DEFAULT 0,
  is_active       BOOLEAN      NOT NULL DEFAULT true,
  sort_order      INTEGER      NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS service_categories_slug_idx ON service_categories(slug);

INSERT INTO service_categories (name, slug, description, icon_url, base_eco_points, is_active, sort_order) VALUES
  ('Regular Cleaning','regular-cleaning','Routine maintenance cleaning: vacuuming, mopping, surfaces, bathrooms, kitchen.','🌿',10,true,1),
  ('Deep Cleaning','deep-cleaning','Thorough top-to-bottom clean covering all surfaces, appliances, and hidden areas.','✨',20,true,2),
  ('Move-in / Move-out','move-cleaning','End-of-tenancy or pre-move-in clean to prepare a property for new occupants.','📦',25,true,3),
  ('Office Cleaning','office-cleaning','Professional eco-cleaning for offices, co-working spaces, and commercial premises.','🏢',15,true,4),
  ('Laundry','laundry','Washing, drying, folding and ironing using eco-certified detergents.','👕',8,true,5),
  ('Window Cleaning','window-cleaning','Interior and exterior window cleaning with streak-free, plant-based solutions.','🪟',12,true,6),
  ('Appliance Cleaning','appliance-cleaning','Deep cleaning of ovens, fridges, dishwashers, and washing machines.','🔧',18,true,7)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon_url = EXCLUDED.icon_url,
  base_eco_points = EXCLUDED.base_eco_points,
  is_active = true,
  sort_order = EXCLUDED.sort_order;

-- Platform settings (key/value config used by the admin Settings page). Migration
-- 0014 was recorded as applied but the table was never created on prod (journal
-- drift), so every save threw a 500. Create + seed defaults; never overwrite values.
CREATE TABLE IF NOT EXISTS platform_settings (
  key        VARCHAR(100) PRIMARY KEY,
  value      TEXT         NOT NULL,
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
INSERT INTO platform_settings (key, value) VALUES
  ('commission_pct','15'),
  ('referral_pct','5'),
  ('payout_schedule','weekly'),
  ('max_service_radius_km','100'),
  ('platform_name','DORIXÉ')
ON CONFLICT (key) DO NOTHING;

-- AI email marketing: campaigns + per-recipient send log.
DO $$ BEGIN CREATE TYPE email_campaign_type   AS ENUM ('welcome','value','soft_sell','hard_sell','custom'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE email_campaign_status AS ENUM ('draft','scheduled','sending','completed','failed');  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE email_send_status     AS ENUM ('queued','sent','delivered','opened','bounced','failed','skipped'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS email_campaigns (
  id                   UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 VARCHAR(160)          NOT NULL,
  type                 email_campaign_type   NOT NULL DEFAULT 'custom',
  status               email_campaign_status NOT NULL DEFAULT 'draft',
  subject              VARCHAR(240),
  brief                TEXT,
  body_html            TEXT,
  ai_generated         BOOLEAN               NOT NULL DEFAULT false,
  personalize_per_user BOOLEAN               NOT NULL DEFAULT true,
  audience             JSONB,
  scheduled_at         TIMESTAMPTZ,
  created_by           TEXT                  REFERENCES users(id),
  total_recipients     INTEGER               NOT NULL DEFAULT 0,
  sent_count           INTEGER               NOT NULL DEFAULT 0,
  failed_count         INTEGER               NOT NULL DEFAULT 0,
  sent_at              TIMESTAMPTZ,
  created_at           TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ           NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS email_campaigns_status_idx ON email_campaigns(status);
CREATE INDEX IF NOT EXISTS email_campaigns_type_idx   ON email_campaigns(type);

CREATE TABLE IF NOT EXISTS email_sends (
  id                UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id       UUID                REFERENCES email_campaigns(id) ON DELETE CASCADE,
  user_id           TEXT                NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email             VARCHAR(320)        NOT NULL,
  type              email_campaign_type NOT NULL,
  status            email_send_status   NOT NULL DEFAULT 'queued',
  subject           VARCHAR(240),
  resend_message_id VARCHAR(120),
  error             TEXT,
  sent_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS email_sends_campaign_user_idx ON email_sends(campaign_id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS email_sends_welcome_user_idx  ON email_sends(user_id) WHERE type = 'welcome';
CREATE INDEX        IF NOT EXISTS email_sends_user_idx          ON email_sends(user_id);
CREATE INDEX        IF NOT EXISTS email_sends_type_idx          ON email_sends(type);

-- ── job_posts reconciliation ──────────────────────────────────────────────
-- Posting a job 500'd on prod: migration 0010 (view_count) and/or migration
-- 0001 (PostGIS service_location column + sync_job_location BEFORE-INSERT
-- trigger) were recorded "applied" in the journal but never actually ran
-- (journal/DB drift), so every INSERT into job_posts failed. Idempotent fix:

-- 1) view_count column (migration 0010)
ALTER TABLE job_posts ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

-- 2) PostGIS geo columns + sync triggers (migration 0001). When PostGIS is
--    available, (re)create the column/index/trigger correctly. When it is NOT
--    installed, DROP the sync triggers so a trigger referencing a missing column
--    or ST_* function can never break an INSERT (geo falls back to lat/lng math).
DO $$ BEGIN CREATE EXTENSION IF NOT EXISTS postgis; EXCEPTION WHEN OTHERS THEN RAISE NOTICE '[ensure] postgis unavailable: %', SQLERRM; END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    ALTER TABLE job_posts ADD COLUMN IF NOT EXISTS service_location geography(Point, 4326);
    CREATE INDEX IF NOT EXISTS job_posts_location_gist ON job_posts USING GIST(service_location);
    ALTER TABLE providers ADD COLUMN IF NOT EXISTS location geography(Point, 4326);
    CREATE INDEX IF NOT EXISTS providers_location_gist ON providers USING GIST(location);

    CREATE OR REPLACE FUNCTION sync_job_location() RETURNS TRIGGER AS $fn$
    BEGIN
      IF NEW.service_latitude IS NOT NULL AND NEW.service_longitude IS NOT NULL THEN
        NEW.service_location = ST_SetSRID(ST_MakePoint(NEW.service_longitude, NEW.service_latitude), 4326)::geography;
      END IF;
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;
    DROP TRIGGER IF EXISTS job_location_sync ON job_posts;
    CREATE TRIGGER job_location_sync BEFORE INSERT OR UPDATE ON job_posts FOR EACH ROW EXECUTE FUNCTION sync_job_location();

    CREATE OR REPLACE FUNCTION sync_provider_location() RETURNS TRIGGER AS $fn$
    BEGIN
      IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
        NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
      END IF;
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;
    DROP TRIGGER IF EXISTS provider_location_sync ON providers;
    CREATE TRIGGER provider_location_sync BEFORE INSERT OR UPDATE ON providers FOR EACH ROW EXECUTE FUNCTION sync_provider_location();
  ELSE
    DROP TRIGGER IF EXISTS job_location_sync ON job_posts;
    DROP TRIGGER IF EXISTS provider_location_sync ON providers;
  END IF;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE '[ensure] job_posts geo reconcile failed: %', SQLERRM;
END $$;

-- Job posts no longer auto-expire (they stay on the board until assigned/cancelled). Push existing
-- open/bidding posts' expiry far into the future so they don't lapse under the old 72h rule.
UPDATE job_posts SET expires_at = NOW() + INTERVAL '100 years'
  WHERE status IN ('open','bidding') AND expires_at < NOW() + INTERVAL '90 years';

-- Prevent OVERLAPPING bookings for the same cleaner at the DB level. The unique index only blocks
-- identical start times; this exclusion constraint also closes the concurrent-overlap race the
-- app-level check can't. Needs btree_gist (for '=' on provider_id within a gist exclusion); both
-- statements are exception-safe so a deploy never fails if the extension/constraint can't be added.
DO $$ BEGIN CREATE EXTENSION IF NOT EXISTS btree_gist; EXCEPTION WHEN OTHERS THEN RAISE NOTICE '[ensure] btree_gist unavailable: %', SQLERRM; END $$;
DO $$ BEGIN
  ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
    EXCLUDE USING gist (
      provider_id WITH =,
      tstzrange(scheduled_at, COALESCE(scheduled_end_at, scheduled_at + INTERVAL '2 hours')) WITH &&
    ) WHERE (status IN ('payment_authorized','confirmed','in_progress','pending_capture'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN OTHERS THEN RAISE NOTICE '[ensure] bookings_no_overlap not added: %', SQLERRM;
END $$;

-- Booking-number fallback sequence (used by createBooking when Redis is unavailable). Started high
-- so its range can't collide with the existing Redis-issued booking numbers.
CREATE SEQUENCE IF NOT EXISTS booking_seq START WITH 500000;

-- Self-bid fraud prevention: record the poster's IP on each job so the feed + bid API can hide and
-- block the poster's own jobs even from a second account on the same connection.
ALTER TABLE job_posts ADD COLUMN IF NOT EXISTS posted_ip varchar(64);

-- Per-provider IANA timezone (platform spans EU + US) — for availability checks + booking-time display.
ALTER TABLE providers ADD COLUMN IF NOT EXISTS timezone varchar(64);
`

function isValidUrl(url) {
  try {
    const p = new URL(url ?? "")
    return p.protocol === "postgresql:" || p.protocol === "postgres:"
  } catch {
    return false
  }
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!isValidUrl(url)) {
    console.log("[ensure-referrals] no valid DATABASE_URL — skipping")
    return
  }
  const sql = postgres(url, { max: 1, prepare: false })
  try {
    await sql.unsafe(DDL)
    console.log("[ensure-referrals] referral + customer_reviews + service_categories + platform_settings + job_posts(view_count/geo) ensured ✓")
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main().catch((err) => {
  // Never fail the build over this — log and move on.
  console.error("[ensure-referrals] failed (non-fatal):", err?.message ?? err)
  process.exit(0)
})
