-- ============================================================
-- 0000_initial_schema.sql
-- Complete baseline schema — must run before all other migrations.
-- All tables created in FK dependency order.
-- Uses IF NOT EXISTS everywhere so re-runs are safe.
-- NOTE: error_logs / error_severity intentionally omitted here;
--       they are created by 0002_add_error_logs.sql.
-- ============================================================

-- ── Enums ────────────────────────────────────────────────────
-- Use DO blocks for conditional type creation: CREATE TYPE IF NOT EXISTS
-- requires PostgreSQL 16+. DO blocks work on PostgreSQL 12+.

DO $$ BEGIN CREATE TYPE user_role AS ENUM ('customer','provider','admin'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE eco_level AS ENUM ('basic','certified','premium','zero_impact'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE verification_status AS ENUM ('not_started','pending','verified','rejected','requires_resubmission'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE payout_schedule AS ENUM ('weekly','biweekly','monthly'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- booking_status includes 'pending_capture' (added in 0005) from the start
DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM (
    'pending_payment','payment_authorized','confirmed','in_progress',
    'pending_capture','completed','cancelled','disputed','refunded'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE job_status AS ENUM ('open','bidding','assigned','completed','cancelled','expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE bid_status AS ENUM ('pending','accepted','rejected','withdrawn'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- payment_status includes 'cancelled' (added in 0005) from the start
DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM (
    'pending','authorized','captured','refunded','partially_refunded','failed','disputed','cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE payout_status AS ENUM ('pending','processing','paid','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE dispute_status AS ENUM ('open','under_review','resolved_customer','resolved_provider','escalated','closed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- notification_type includes all values added through 0004, 0006, 0007
DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM (
    'new_job_request','bid_received','bid_accepted','bid_rejected',
    'booking_confirmed','booking_reminder','booking_completed','booking_cancelled',
    'payment_received','payout_processed','dispute_opened','dispute_resolved',
    'review_received','provider_approved','provider_rejected','provider_suspended',
    'provider_unsuspended','identity_verified','new_message',
    'booking_rescheduled','booking_started','recurring_booking_created'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- added in 0006
DO $$ BEGIN CREATE TYPE discount_type AS ENUM ('percentage','fixed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE recurring_frequency AS ENUM ('weekly','biweekly','monthly'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE recurring_status AS ENUM ('active','paused','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Tables ───────────────────────────────────────────────────

-- 1. users (no foreign keys)
CREATE TABLE IF NOT EXISTS users (
  id                TEXT        PRIMARY KEY,                        -- Clerk user ID
  email             VARCHAR(320) NOT NULL,
  first_name        VARCHAR(100),
  last_name         VARCHAR(100),
  phone             VARCHAR(30),
  stripe_customer_id VARCHAR(100),                                  -- added in 0007
  role              user_role   NOT NULL DEFAULT 'customer',
  avatar_url        TEXT,
  is_active         BOOLEAN     NOT NULL DEFAULT TRUE,
  gdpr_consent_at   TIMESTAMPTZ,
  marketing_consent BOOLEAN     NOT NULL DEFAULT FALSE,
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (email);
CREATE        INDEX IF NOT EXISTS users_role_idx  ON users (role);

-- 2. service_categories (no foreign keys)
CREATE TABLE IF NOT EXISTS service_categories (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(100) NOT NULL,
  slug            VARCHAR(100) NOT NULL,
  description     TEXT,
  icon_url        TEXT,
  base_eco_points INTEGER     NOT NULL DEFAULT 0,
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order      INTEGER     NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS service_categories_slug_idx ON service_categories (slug);

-- 3. providers (FK: users)
CREATE TABLE IF NOT EXISTS providers (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug                  VARCHAR(120) NOT NULL,
  business_name         VARCHAR(200) NOT NULL,
  bio                   TEXT,
  latitude              DOUBLE PRECISION,
  longitude             DOUBLE PRECISION,
  address_line1         VARCHAR(255),
  address_line2         VARCHAR(255),
  city                  VARCHAR(100),
  state                 VARCHAR(100),
  postal_code           VARCHAR(20),
  country               VARCHAR(2)  NOT NULL DEFAULT 'DE',
  service_radius_km     INTEGER     NOT NULL DEFAULT 25,
  eco_level             eco_level   NOT NULL DEFAULT 'basic',
  eco_score             INTEGER     NOT NULL DEFAULT 0,
  certifications        JSONB                DEFAULT '[]',
  carbon_offset_enabled BOOLEAN     NOT NULL DEFAULT FALSE,
  verification_status   verification_status NOT NULL DEFAULT 'not_started',
  stripe_account_id     VARCHAR(64),
  stripe_account_status VARCHAR(32),
  payout_schedule       payout_schedule NOT NULL DEFAULT 'weekly',
  is_approved           BOOLEAN     NOT NULL DEFAULT FALSE,
  is_suspended          BOOLEAN     NOT NULL DEFAULT FALSE,
  suspended_reason      TEXT,
  average_rating        DOUBLE PRECISION     DEFAULT 0,
  total_reviews         INTEGER     NOT NULL DEFAULT 0,
  total_jobs_completed  INTEGER     NOT NULL DEFAULT 0,
  profile_photo_url     TEXT,
  gallery_urls          JSONB                DEFAULT '[]',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS providers_user_id_idx          ON providers (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS providers_slug_idx             ON providers (slug);
CREATE UNIQUE INDEX IF NOT EXISTS providers_stripe_account_idx   ON providers (stripe_account_id) WHERE stripe_account_id IS NOT NULL;
CREATE        INDEX IF NOT EXISTS providers_city_idx             ON providers (city);
CREATE        INDEX IF NOT EXISTS providers_eco_level_idx        ON providers (eco_level);
CREATE        INDEX IF NOT EXISTS providers_is_approved_idx      ON providers (is_approved);

-- 4. provider_services (FK: providers, service_categories)
CREATE TABLE IF NOT EXISTS provider_services (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id           UUID        NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  category_id           UUID        NOT NULL REFERENCES service_categories(id),
  name                  VARCHAR(200) NOT NULL,
  description           TEXT,
  base_price            INTEGER     NOT NULL,
  price_unit            VARCHAR(20) NOT NULL DEFAULT 'per_job',
  min_duration_minutes  INTEGER     NOT NULL DEFAULT 60,
  max_duration_minutes  INTEGER,
  eco_products_used     JSONB                DEFAULT '[]',
  is_active             BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS provider_services_provider_idx  ON provider_services (provider_id);
CREATE INDEX IF NOT EXISTS provider_services_category_idx  ON provider_services (category_id);

-- 5. provider_availability (FK: providers)
CREATE TABLE IF NOT EXISTS provider_availability (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id  UUID    NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  day_of_week  INTEGER NOT NULL,
  start_time   TIME    NOT NULL,
  end_time     TIME    NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS provider_availability_provider_idx ON provider_availability (provider_id);

-- 6. provider_blackout_dates (FK: providers)
CREATE TABLE IF NOT EXISTS provider_blackout_dates (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID        NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  date        DATE        NOT NULL,
  reason      VARCHAR(200)
);
CREATE INDEX IF NOT EXISTS blackout_provider_date_idx ON provider_blackout_dates (provider_id, date);

-- 7. job_posts (FK: users, service_categories)
CREATE TABLE IF NOT EXISTS job_posts (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id        TEXT        NOT NULL REFERENCES users(id),
  category_id        UUID        REFERENCES service_categories(id),
  title              VARCHAR(200) NOT NULL,
  description        TEXT        NOT NULL,
  status             job_status  NOT NULL DEFAULT 'open',
  budget_min         INTEGER,
  budget_max         INTEGER,
  desired_date       DATE,
  desired_time_range JSONB,
  service_address    JSONB       NOT NULL,
  service_latitude   DOUBLE PRECISION NOT NULL,
  service_longitude  DOUBLE PRECISION NOT NULL,
  radius_km          INTEGER     NOT NULL DEFAULT 25,
  eco_requirements   JSONB                DEFAULT '[]',
  accepted_bid_id    UUID,
  expires_at         TIMESTAMPTZ NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS job_posts_customer_idx   ON job_posts (customer_id);
CREATE INDEX IF NOT EXISTS job_posts_status_idx     ON job_posts (status);
CREATE INDEX IF NOT EXISTS job_posts_expires_at_idx ON job_posts (expires_at);

-- 8. payouts (FK: providers) — must precede payments due to FK from payments.payout_id
CREATE TABLE IF NOT EXISTS payouts (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id       UUID          NOT NULL REFERENCES providers(id),
  stripe_transfer_id VARCHAR(100),
  stripe_payout_id  VARCHAR(100),
  status            payout_status NOT NULL DEFAULT 'pending',
  amount            INTEGER       NOT NULL,
  currency          VARCHAR(3)    NOT NULL DEFAULT 'eur',
  period_start      DATE          NOT NULL,
  period_end        DATE          NOT NULL,
  booking_ids       JSONB         NOT NULL,
  failure_reason    TEXT,
  processed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS payouts_transfer_idx  ON payouts (stripe_transfer_id) WHERE stripe_transfer_id IS NOT NULL;
CREATE        INDEX IF NOT EXISTS payouts_provider_idx  ON payouts (provider_id);
CREATE        INDEX IF NOT EXISTS payouts_status_idx    ON payouts (status);
CREATE        INDEX IF NOT EXISTS payouts_period_idx    ON payouts (period_start, period_end);

-- 9. bookings (FK: users, providers, provider_services)
--    Includes before_photo_urls, promo_code_id, discount_amount added in 0006
CREATE TABLE IF NOT EXISTS bookings (
  id                    UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_number        VARCHAR(20)    NOT NULL,
  customer_id           TEXT           NOT NULL REFERENCES users(id),
  provider_id           UUID           NOT NULL REFERENCES providers(id),
  service_id            UUID           REFERENCES provider_services(id),
  status                booking_status NOT NULL DEFAULT 'pending_payment',
  scheduled_at          TIMESTAMPTZ    NOT NULL,
  scheduled_end_at      TIMESTAMPTZ,
  actual_start_at       TIMESTAMPTZ,
  actual_end_at         TIMESTAMPTZ,
  service_address       JSONB          NOT NULL,
  service_latitude      DOUBLE PRECISION,
  service_longitude     DOUBLE PRECISION,
  special_instructions  TEXT,
  eco_options           JSONB                   DEFAULT '[]',
  platform_fee_pct      INTEGER        NOT NULL DEFAULT 15,
  subtotal_amount       INTEGER        NOT NULL,
  platform_fee_amount   INTEGER        NOT NULL,
  total_amount          INTEGER        NOT NULL,
  provider_payout       INTEGER        NOT NULL,
  carbon_offset_amount  INTEGER        NOT NULL DEFAULT 0,
  completion_photos     JSONB                   DEFAULT '[]',
  before_photo_urls     JSONB                   DEFAULT '[]',
  promo_code_id         UUID,
  discount_amount       INTEGER        NOT NULL DEFAULT 0,
  cancellation_reason   TEXT,
  cancelled_at          TIMESTAMPTZ,
  cancelled_by          TEXT,
  created_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS bookings_number_idx             ON bookings (booking_number);
CREATE UNIQUE INDEX IF NOT EXISTS bookings_provider_scheduled_idx ON bookings (provider_id, scheduled_at);
CREATE        INDEX IF NOT EXISTS bookings_customer_idx           ON bookings (customer_id);
CREATE        INDEX IF NOT EXISTS bookings_provider_idx           ON bookings (provider_id);
CREATE        INDEX IF NOT EXISTS bookings_status_idx             ON bookings (status);
CREATE        INDEX IF NOT EXISTS bookings_scheduled_at_idx       ON bookings (scheduled_at);

-- 10. bids (FK: job_posts, providers, bookings)
CREATE TABLE IF NOT EXISTS bids (
  id                        UUID       PRIMARY KEY DEFAULT gen_random_uuid(),
  job_post_id               UUID       NOT NULL REFERENCES job_posts(id) ON DELETE CASCADE,
  provider_id               UUID       NOT NULL REFERENCES providers(id),
  status                    bid_status NOT NULL DEFAULT 'pending',
  amount                    INTEGER    NOT NULL,
  message                   TEXT,
  estimated_duration_minutes INTEGER,
  proposed_date             DATE,
  proposed_time_start       TIME,
  booking_id                UUID       REFERENCES bookings(id),
  expires_at                TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS bids_provider_job_idx ON bids (provider_id, job_post_id);
CREATE        INDEX IF NOT EXISTS bids_job_post_idx     ON bids (job_post_id);
CREATE        INDEX IF NOT EXISTS bids_provider_idx     ON bids (provider_id);
CREATE        INDEX IF NOT EXISTS bids_status_idx       ON bids (status);

-- 11. payments (FK: bookings, users, payouts)
--     Includes payout_id column added in 0005
CREATE TABLE IF NOT EXISTS payments (
  id                       UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id               UUID           NOT NULL REFERENCES bookings(id),
  customer_id              TEXT           NOT NULL REFERENCES users(id),
  stripe_payment_intent_id VARCHAR(100)   NOT NULL,
  stripe_customer_id       VARCHAR(100),
  status                   payment_status NOT NULL DEFAULT 'pending',
  amount                   INTEGER        NOT NULL,
  captured_amount          INTEGER,
  refunded_amount          INTEGER        NOT NULL DEFAULT 0,
  currency                 VARCHAR(3)     NOT NULL DEFAULT 'eur',
  captured_at              TIMESTAMPTZ,
  failure_code             VARCHAR(50),
  failure_message          TEXT,
  metadata                 JSONB,
  idempotency_key          VARCHAR(128),
  payout_id                UUID           REFERENCES payouts(id),
  created_at               TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS payments_intent_idx   ON payments (stripe_payment_intent_id);
CREATE        INDEX IF NOT EXISTS payments_booking_idx  ON payments (booking_id);
CREATE        INDEX IF NOT EXISTS payments_customer_idx ON payments (customer_id);
CREATE        INDEX IF NOT EXISTS payments_status_idx   ON payments (status);
CREATE        INDEX IF NOT EXISTS payments_payout_idx   ON payments (payout_id);

-- 12. reviews (FK: bookings, users, providers)
CREATE TABLE IF NOT EXISTS reviews (
  id                   UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id           UUID    NOT NULL REFERENCES bookings(id),
  customer_id          TEXT    NOT NULL REFERENCES users(id),
  provider_id          UUID    NOT NULL REFERENCES providers(id),
  overall_rating       INTEGER NOT NULL,
  cleanliness_rating   INTEGER,
  punctuality_rating   INTEGER,
  eco_compliance_rating INTEGER,
  communication_rating INTEGER,
  title                VARCHAR(200),
  body                 TEXT,
  is_public            BOOLEAN     NOT NULL DEFAULT TRUE,
  is_flagged           BOOLEAN     NOT NULL DEFAULT FALSE,
  admin_note           TEXT,
  provider_response    TEXT,
  provider_responded_at TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS reviews_booking_idx   ON reviews (booking_id);
CREATE        INDEX IF NOT EXISTS reviews_provider_idx  ON reviews (provider_id);
CREATE        INDEX IF NOT EXISTS reviews_customer_idx  ON reviews (customer_id);
CREATE        INDEX IF NOT EXISTS reviews_rating_idx    ON reviews (overall_rating);

-- 13. disputes (FK: bookings, users)
CREATE TABLE IF NOT EXISTS disputes (
  id                 UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id         UUID           NOT NULL REFERENCES bookings(id),
  opened_by          TEXT           NOT NULL REFERENCES users(id),
  responded_by       TEXT           REFERENCES users(id),
  assigned_admin_id  TEXT           REFERENCES users(id),
  status             dispute_status NOT NULL DEFAULT 'open',
  reason             VARCHAR(100)   NOT NULL,
  description        TEXT           NOT NULL,
  evidence_urls      JSONB                   DEFAULT '[]',
  resolution         TEXT,
  resolution_amount  INTEGER,
  stripe_dispute_id  VARCHAR(100),
  resolved_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS disputes_booking_idx   ON disputes (booking_id);
CREATE        INDEX IF NOT EXISTS disputes_status_idx    ON disputes (status);
CREATE        INDEX IF NOT EXISTS disputes_opened_by_idx ON disputes (opened_by);

-- 14. dispute_messages (FK: disputes, users)
CREATE TABLE IF NOT EXISTS dispute_messages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id      UUID        NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  sender_id       TEXT        NOT NULL REFERENCES users(id),
  body            TEXT        NOT NULL,
  attachment_urls JSONB                DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS dispute_messages_dispute_idx ON dispute_messages (dispute_id);

-- 15. notifications (FK: users)
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT              NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       notification_type NOT NULL,
  title      VARCHAR(200)      NOT NULL,
  body       TEXT              NOT NULL,
  link       VARCHAR(500),
  is_read    BOOLEAN           NOT NULL DEFAULT FALSE,
  metadata   JSONB,
  created_at TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON notifications (user_id, is_read);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx  ON notifications (created_at);

-- 16. eco_certifications (FK: providers)
CREATE TABLE IF NOT EXISTS eco_certifications (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id           UUID        NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  name                  VARCHAR(200) NOT NULL,
  issuing_body          VARCHAR(200),
  certification_number  VARCHAR(100),
  document_url          TEXT        NOT NULL,
  verified_at           TIMESTAMPTZ,
  expires_at            DATE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS eco_certs_provider_idx ON eco_certifications (provider_id);

-- 17. carbon_offset_contributions (FK: bookings, users, providers)
CREATE TABLE IF NOT EXISTS carbon_offset_contributions (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id             UUID        NOT NULL REFERENCES bookings(id),
  customer_id            TEXT        NOT NULL REFERENCES users(id),
  provider_id            UUID        NOT NULL REFERENCES providers(id),
  amount                 INTEGER     NOT NULL,
  offset_provider        VARCHAR(100),
  offset_certificate_url TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS carbon_booking_idx ON carbon_offset_contributions (booking_id);

-- 18. provider_identity_verifications (FK: providers, users)
CREATE TABLE IF NOT EXISTS provider_identity_verifications (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id                 UUID        NOT NULL REFERENCES providers(id),
  stripe_session_id           VARCHAR(100),
  status                      VARCHAR(30) NOT NULL DEFAULT 'not_started',
  document_type               VARCHAR(50),
  document_front_url          TEXT,
  document_back_url           TEXT,
  selfie_url                  TEXT,
  reviewed_by                 TEXT        REFERENCES users(id),
  reviewed_at                 TIMESTAMPTZ,
  rejection_reason            TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS identity_provider_idx ON provider_identity_verifications (provider_id);

-- 19. messages (FK: bookings, users) — added in 0006
CREATE TABLE IF NOT EXISTS messages (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id     UUID        NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  sender_id      TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body           TEXT        NOT NULL,
  attachment_url TEXT,
  is_read        BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS messages_booking_idx    ON messages (booking_id);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages (created_at);

-- 20. promo_codes (FK: users) — added in 0006
CREATE TABLE IF NOT EXISTS promo_codes (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  code              VARCHAR(50)  NOT NULL UNIQUE,
  discount_type     discount_type NOT NULL,
  discount_value    INTEGER      NOT NULL,
  min_order_cents   INTEGER      NOT NULL DEFAULT 0,
  max_discount_cents INTEGER,
  max_uses          INTEGER,
  used_count        INTEGER      NOT NULL DEFAULT 0,
  expires_at        TIMESTAMPTZ,
  is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
  created_by        TEXT         NOT NULL REFERENCES users(id),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS promo_codes_code_idx ON promo_codes (code);

-- 21. promo_code_usages (FK: promo_codes, users, bookings) — added in 0006
CREATE TABLE IF NOT EXISTS promo_code_usages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id   UUID        NOT NULL REFERENCES promo_codes(id),
  user_id         TEXT        NOT NULL REFERENCES users(id),
  booking_id      UUID        REFERENCES bookings(id),
  discount_amount INTEGER     NOT NULL,
  used_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS promo_usage_code_idx ON promo_code_usages (promo_code_id);
CREATE INDEX IF NOT EXISTS promo_usage_user_idx ON promo_code_usages (user_id);

-- 22. recurring_schedules (FK: users, providers, provider_services)
--     Includes stripe_payment_method_id, timezone added in 0007
CREATE TABLE IF NOT EXISTS recurring_schedules (
  id                       UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id              TEXT               NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id              UUID               NOT NULL REFERENCES providers(id),
  service_id               UUID               NOT NULL REFERENCES provider_services(id),
  frequency                recurring_frequency NOT NULL,
  day_of_week              SMALLINT           NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  preferred_time           TEXT               NOT NULL,
  service_address          JSONB              NOT NULL,
  eco_options              JSONB                       DEFAULT '[]',
  special_instructions     TEXT,
  stripe_payment_method_id VARCHAR(100),
  timezone                 TEXT               NOT NULL DEFAULT 'Europe/Amsterdam',
  status                   recurring_status   NOT NULL DEFAULT 'active',
  next_booking_at          TIMESTAMPTZ,
  created_at               TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS recurring_customer_idx ON recurring_schedules (customer_id);
CREATE INDEX IF NOT EXISTS recurring_provider_idx ON recurring_schedules (provider_id);
