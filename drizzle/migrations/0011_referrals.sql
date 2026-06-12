-- Referral system

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
  id                          UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id                 TEXT              NOT NULL REFERENCES users(id),
  referred_id                 TEXT              NOT NULL UNIQUE REFERENCES users(id),
  code                        VARCHAR(20)       NOT NULL,
  status                      referral_status   NOT NULL DEFAULT 'pending',
  activated_at                TIMESTAMPTZ,
  total_commission_earned_cents INTEGER         NOT NULL DEFAULT 0,
  created_at                  TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON referrals(referrer_id);
CREATE UNIQUE INDEX IF NOT EXISTS referrals_referred_idx ON referrals(referred_id);

CREATE TABLE IF NOT EXISTS referral_commissions (
  id                    UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id           UUID              NOT NULL REFERENCES referrals(id),
  booking_id            UUID              NOT NULL REFERENCES bookings(id),
  referrer_id           TEXT              NOT NULL REFERENCES users(id),
  booking_amount_cents  INTEGER           NOT NULL,
  commission_cents      INTEGER           NOT NULL,
  status                commission_status NOT NULL DEFAULT 'pending',
  credited_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ref_commissions_referral_idx ON referral_commissions(referral_id);
CREATE INDEX IF NOT EXISTS ref_commissions_referrer_idx ON referral_commissions(referrer_id);

CREATE TABLE IF NOT EXISTS referral_credits (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               TEXT        NOT NULL UNIQUE REFERENCES users(id),
  balance_cents         INTEGER     NOT NULL DEFAULT 0,
  lifetime_earned_cents INTEGER     NOT NULL DEFAULT 0,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS referral_credits_user_idx ON referral_credits(user_id);
