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
-- Case-insensitive uniqueness so vanity codes can't collide only by case (e.g. "Jane" vs "jane").
CREATE UNIQUE INDEX IF NOT EXISTS referral_codes_code_lower_idx ON referral_codes(LOWER(code));

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
ALTER TABLE users ADD COLUMN IF NOT EXISTS locale varchar(5);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_reminders boolean NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS recurring_interest varchar(12);
ALTER TABLE job_posts ADD COLUMN IF NOT EXISTS recurring_frequency varchar(12);
ALTER TABLE job_posts ADD COLUMN IF NOT EXISTS estimated_duration_minutes integer;
ALTER TABLE store_products ADD COLUMN IF NOT EXISTS pack_id uuid;
ALTER TABLE messages ALTER COLUMN booking_id DROP NOT NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS job_post_id uuid;
CREATE INDEX IF NOT EXISTS messages_job_post_idx ON messages(job_post_id);
CREATE TABLE IF NOT EXISTS support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  sender_id text NOT NULL,
  from_admin boolean NOT NULL DEFAULT false,
  body text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_messages_user_idx ON support_messages(user_id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS requested_frequency varchar(12);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS requested_days jsonb;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pending_proposal jsonb;
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

-- Services can belong to multiple categories (findable under each) + free-text custom labels.
ALTER TABLE provider_services ADD COLUMN IF NOT EXISTS category_ids jsonb DEFAULT '[]'::jsonb;
ALTER TABLE provider_services ADD COLUMN IF NOT EXISTS custom_categories jsonb DEFAULT '[]'::jsonb;
-- Backfill the array from the existing single category so pre-existing services are findable via it.
UPDATE provider_services SET category_ids = jsonb_build_array(category_id::text)
  WHERE (category_ids IS NULL OR category_ids = '[]'::jsonb) AND category_id IS NOT NULL;

-- Recurring auto-renewal consent: timestamp of the customer's affirmative authorization to auto-charge
-- the saved card each cycle (US Click-to-Cancel / state auto-renewal laws + EU). The create API
-- requires consent=true, so this is set whenever a schedule is created.
ALTER TABLE recurring_schedules ADD COLUMN IF NOT EXISTS auto_renew_consent_at timestamptz;

-- Dual completion confirmation: payment releases to the cleaner only when BOTH the cleaner and the
-- client mark the job done (or an admin releases it manually with the cleaner's proof). Track each.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS provider_completed_at timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS client_confirmed_at timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_released_by varchar(20);

-- Overdue tracking: a job past its scheduled end that the cleaner hasn't marked done. The cleaner
-- loses 5%/day (late_penalty_amount, capped at their payout) credited back to the client.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS overdue_since timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS overdue_escalated_at timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS last_overdue_nudge_at timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS late_penalty_amount integer NOT NULL DEFAULT 0;

-- Eco-store: admin-curated affiliate products + business starter packs (outbound purchase links).
DO $$ BEGIN CREATE TYPE store_product_type AS ENUM ('product','starter_pack'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE store_product_status AS ENUM ('draft','published'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS store_products (
  id            UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
  type          store_product_type   NOT NULL DEFAULT 'product',
  slug          VARCHAR(200)         NOT NULL,
  title         VARCHAR(300)         NOT NULL,
  description   TEXT,
  brand         VARCHAR(160),
  image_url     TEXT,
  affiliate_url TEXT                 NOT NULL,
  price_cents   INTEGER,
  currency      VARCHAR(3),
  benefits      JSONB                NOT NULL DEFAULT '[]'::jsonb,
  category      VARCHAR(100),
  tags          JSONB                NOT NULL DEFAULT '[]'::jsonb,
  featured      BOOLEAN              NOT NULL DEFAULT false,
  status        store_product_status NOT NULL DEFAULT 'draft',
  clicks        INTEGER              NOT NULL DEFAULT 0,
  sort_order    INTEGER              NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ          NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS store_products_slug_idx     ON store_products(slug);
CREATE INDEX        IF NOT EXISTS store_products_status_idx   ON store_products(status);
CREATE INDEX        IF NOT EXISTS store_products_type_idx     ON store_products(type);
CREATE INDEX        IF NOT EXISTS store_products_featured_idx ON store_products(featured);

-- Cancellation & no-show policy: admin-configurable fee tiers + travel compensation, immutable
-- audit log, and per-transaction consent timestamps (client_no_show/cleaner_no_show enum values are
-- added separately below — ALTER TYPE ADD VALUE can't run in the same transaction as its use).
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS travel_compensation_amount integer NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_policy_accepted_at timestamptz;
ALTER TABLE bids ADD COLUMN IF NOT EXISTS cancellation_policy_accepted_at timestamptz;

DO $$ BEGIN CREATE TYPE cancellation_actor AS ENUM ('client','cleaner','admin','system'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE cancellation_action AS ENUM ('cancelled','client_no_show','cleaner_no_show','admin_override'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS booking_cancellation_events (
  id                          UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id                  UUID                NOT NULL REFERENCES bookings(id),
  actor_user_id                TEXT                REFERENCES users(id),
  actor_role                  cancellation_actor  NOT NULL,
  action                      cancellation_action NOT NULL,
  scheduled_at                TIMESTAMPTZ         NOT NULL,
  status_before               VARCHAR(32)         NOT NULL,
  cancellation_fee_amount     INTEGER             NOT NULL DEFAULT 0,
  travel_compensation_amount  INTEGER             NOT NULL DEFAULT 0,
  refund_amount               INTEGER             NOT NULL DEFAULT 0,
  is_admin_override           BOOLEAN             NOT NULL DEFAULT false,
  override_reason             TEXT,
  reason                      TEXT,
  created_at                  TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS booking_cancellation_events_booking_idx ON booking_cancellation_events(booking_id);
CREATE INDEX IF NOT EXISTS booking_cancellation_events_created_idx ON booking_cancellation_events(created_at);

-- Cancellation & no-show admin-configurable defaults (percentages/windows/grace period/travel comp).
INSERT INTO platform_settings (key, value) VALUES
  ('cancel_tier1_hours','24'),
  ('cancel_tier2_hours','6'),
  ('cancel_tier3_hours','2'),
  ('cancel_fee_low_pct','10'),
  ('cancel_fee_medium_pct','30'),
  ('cancel_fee_late_pct','100'),
  ('cancel_travel_comp_cents','500'),
  ('cancel_noshow_grace_minutes','15')
ON CONFLICT (key) DO NOTHING;

-- Referral/discount programme expansion: cleaner→cleaner referrals cap at the invited cleaner's
-- first 3 completed jobs; client referrals earn a spendable/withdrawable discount balance instead
-- of cash; the recurring-booking discount moves from a per-cleaner setting to one admin-set rate.
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS qualifying_orders_count integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_payout_account_id varchar(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_payout_account_status varchar(32);

DO $$ BEGIN CREATE TYPE referral_payout_status AS ENUM ('pending','paid','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS referral_payouts (
  id                 UUID                   PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            TEXT                   NOT NULL REFERENCES users(id),
  amount_cents       INTEGER                NOT NULL,
  stripe_transfer_id VARCHAR(64),
  status             referral_payout_status NOT NULL DEFAULT 'pending',
  failure_reason     TEXT,
  created_at         TIMESTAMPTZ            NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS referral_payouts_user_idx ON referral_payouts(user_id);

INSERT INTO platform_settings (key, value) VALUES
  ('cleaner_peer_referral_pct','10'),
  ('client_referral_discount_pct','5'),
  ('recurring_discount_pct','10')
ON CONFLICT (key) DO NOTHING;

-- Minimum hourly wage floor (cents) — applies to a client's job-post rate AND a cleaner's own
-- per-hour service rate. 1500 = €15.00/hr.
INSERT INTO platform_settings (key, value) VALUES
  ('min_hourly_rate_cents','1500')
ON CONFLICT (key) DO NOTHING;

-- A completed booking must be able to credit TWO independent referrals (one for the referred
-- customer, one for the referred cleaner assigned to it) — the old single-column unique index on
-- booking_id blocked that. Swap it for a composite (booking_id, referral_id) unique index.
DROP INDEX IF EXISTS ref_commissions_booking_idx;
CREATE UNIQUE INDEX IF NOT EXISTS ref_commissions_booking_referral_idx ON referral_commissions(booking_id, referral_id);

-- Client referral discount balance spendable at checkout (separate column from the promo-code
-- discount_amount) + a client's own lightweight Connect account for withdrawing that balance.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS referral_credit_applied_cents integer NOT NULL DEFAULT 0;

-- Recurring-cleaning discount now caps at the schedule's first 2 occurrences (client's 2nd/3rd
-- cleaning overall) instead of applying forever — this counter tracks how many this schedule has
-- generated so far. Also funded entirely from platform commission now, never the cleaner's payout
-- (see calculateDiscountedBookingAmounts in lib/stripe/client.ts).
ALTER TABLE recurring_schedules ADD COLUMN IF NOT EXISTS occurrences_created integer NOT NULL DEFAULT 0;

-- Client-visible responsiveness signals on a cleaner's profile: last time they were active on the
-- platform (throttled stamp on /provider/* page loads, no cron) and a running-mean reply time
-- (folded in inline on every message send, no cron) — see app/(provider)/layout.tsx and
-- lib/providers/responseTime.ts.
ALTER TABLE providers ADD COLUMN IF NOT EXISTS last_active_at timestamptz;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS avg_response_time_minutes double precision;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS response_time_sample_count integer NOT NULL DEFAULT 0;

-- "Take Job" instant-assignment job type: emergency jobs skip bidding entirely, first eligible
-- provider to claim wins. job_type is a plain varchar (see lib/db/schema/jobs.ts comment) so it
-- needs no enum DDL. instant_jobs_available is the provider's opt-in "free right now" toggle.
ALTER TABLE job_posts ADD COLUMN IF NOT EXISTS job_type varchar(12) NOT NULL DEFAULT 'standard';
ALTER TABLE providers ADD COLUMN IF NOT EXISTS instant_jobs_available boolean NOT NULL DEFAULT false;

-- A service can be listed with no fixed price ("ask on booking") instead of always requiring one —
-- excluded from instant/direct booking's service picker; see lib/bookings/create.ts's guard.
ALTER TABLE provider_services ALTER COLUMN base_price DROP NOT NULL;

-- Append-only payment history: one row per real money movement (authorized/captured/refunded/
-- transferred/payout). See lib/payments/ledger.ts recordPaymentEvent().
DO $$ BEGIN CREATE TYPE payment_event_kind AS ENUM ('authorized','captured','refunded','transferred','payout_succeeded','payout_failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS payment_events (
  id                UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id        UUID                REFERENCES bookings(id),
  user_id           TEXT                REFERENCES users(id),
  kind              payment_event_kind  NOT NULL,
  amount_cents      INTEGER             NOT NULL,
  stripe_object_id  VARCHAR(128),
  status            VARCHAR(32)         NOT NULL,
  metadata          JSONB,
  created_at        TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS payment_events_booking_idx     ON payment_events(booking_id);
CREATE INDEX IF NOT EXISTS payment_events_user_idx        ON payment_events(user_id);
CREATE INDEX IF NOT EXISTS payment_events_created_at_idx  ON payment_events(created_at);

-- Lets the hourly job-assignment sweep find a job stuck "assigned" with no real booking ever
-- created (e.g. the client abandoned payment) and free it automatically.
ALTER TABLE job_posts ADD COLUMN IF NOT EXISTS assigned_at timestamptz;

-- Dead column: never read anywhere in the app — the real payout schedule is hardcoded per-account
-- at Stripe Connect account creation (lib/stripe/connect.ts), not configurable per-cleaner. Kept
-- this column around was misleading, implying a setting that doesn't actually do anything.
ALTER TABLE providers DROP COLUMN IF EXISTS payout_schedule;
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
    // New enum value for the standalone affiliate role — must run on its own statement (can't be used
    // in the same transaction as the value is added). IF NOT EXISTS makes it idempotent across deploys.
    try { await sql.unsafe(`ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'affiliate'`) }
    catch (e) { console.warn("[ensure-referrals] affiliate enum add skipped:", e?.message ?? e) }
    // New booking_status values for no-show handling — same same-transaction restriction as above.
    try { await sql.unsafe(`ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'client_no_show'`) }
    catch (e) { console.warn("[ensure-referrals] client_no_show enum add skipped:", e?.message ?? e) }
    try { await sql.unsafe(`ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'cleaner_no_show'`) }
    catch (e) { console.warn("[ensure-referrals] cleaner_no_show enum add skipped:", e?.message ?? e) }
    // New notification_type value for "your Take Job was claimed" — same same-transaction restriction.
    try { await sql.unsafe(`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'job_taken'`) }
    catch (e) { console.warn("[ensure-referrals] job_taken enum add skipped:", e?.message ?? e) }
    try { await sql.unsafe(`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment_automation_failed'`) }
    catch (e) { console.warn("[ensure-referrals] payment_automation_failed enum add skipped:", e?.message ?? e) }
    await sql.unsafe(DDL)
    console.log("[ensure-referrals] referral + customer_reviews + service_categories + platform_settings + job_posts(view_count/geo/job_type) + cancellation_policy + recurring_schedules(occurrences) + providers(last_active/response_time/instant_jobs) + payment_events ensured ✓")
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main().catch((err) => {
  // Never fail the build over this — log and move on.
  console.error("[ensure-referrals] failed (non-fatal):", err?.message ?? err)
  process.exit(0)
})
