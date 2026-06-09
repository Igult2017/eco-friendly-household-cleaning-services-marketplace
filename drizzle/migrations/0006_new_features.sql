-- Messaging
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  attachment_url TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS messages_booking_idx ON messages(booking_id);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages(created_at);

-- Recurring schedules
CREATE TYPE IF NOT EXISTS recurring_frequency AS ENUM ('weekly','biweekly','monthly');
CREATE TYPE IF NOT EXISTS recurring_status AS ENUM ('active','paused','cancelled');
CREATE TABLE IF NOT EXISTS recurring_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES providers(id),
  service_id UUID NOT NULL REFERENCES provider_services(id),
  frequency recurring_frequency NOT NULL,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  preferred_time TEXT NOT NULL,
  service_address JSONB NOT NULL,
  eco_options JSONB DEFAULT '[]',
  special_instructions TEXT,
  status recurring_status NOT NULL DEFAULT 'active',
  next_booking_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS recurring_customer_idx ON recurring_schedules(customer_id);
CREATE INDEX IF NOT EXISTS recurring_provider_idx ON recurring_schedules(provider_id);

-- Promo codes
CREATE TYPE IF NOT EXISTS discount_type AS ENUM ('percentage','fixed');
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  discount_type discount_type NOT NULL,
  discount_value INTEGER NOT NULL,
  min_order_cents INTEGER NOT NULL DEFAULT 0,
  max_discount_cents INTEGER,
  max_uses INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS promo_code_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id UUID NOT NULL REFERENCES promo_codes(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  booking_id UUID REFERENCES bookings(id),
  discount_amount INTEGER NOT NULL,
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS promo_usage_code_idx ON promo_code_usages(promo_code_id);
CREATE INDEX IF NOT EXISTS promo_usage_user_idx ON promo_code_usages(user_id);

-- Bookings: add new columns
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS before_photo_urls JSONB DEFAULT '[]';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS promo_code_id UUID;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS discount_amount INTEGER NOT NULL DEFAULT 0;

-- Notifications: extend enum
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'new_message';
